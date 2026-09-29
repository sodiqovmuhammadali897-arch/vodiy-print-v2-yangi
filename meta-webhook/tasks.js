// Tasks over the bot's private chats (the chat each employee linked for
// attendance, staff.telegram_chat_id):
//
//   • a new task → its assignee gets it with [▶️ Ishga oldim] [✅ Bajardim];
//     after ✅ the bot takes a note or photo as the task's result / proof;
//   • a task marked done (site or button) → whoever gave it gets
//     "✅ Vazifa bajarildi" with the note and proof photos; tasks from an
//     agent (Bosh agent) go to the admins who linked Telegram;
//   • comments (tasks/{id}/comments) reach the other side; replying to that
//     message in Telegram adds a comment back;
//   • 07:00 — recurring tasks (task_templates) due today are created;
//   • 09:00 (Mon–Sat) — each employee gets their open tasks (overdue, due
//     today, due tomorrow, the rest), and the giver of each newly overdue
//     task is told once.
//
// Every notice is claimed once in Firestore (…_notified_at fields, daily
// run docs), so restarts and double events never send it twice; only
// things from the last day are notified, so a first start doesn't replay
// history.
const { telegram, BOT_TOKEN } = require("./telegram");
const { clip, dayCodeOf, todayCode } = require("./shared");

const FRESH_MS = 24 * 3600 * 1000;
const PENDING_MS = 15 * 60 * 1000;
const MAX_FILE = 650 * 1024;
const LABEL = { new: "Yangi", in_progress: "Ishga olindi", done: "Bajarildi" };
const PRIORITY_ICON = { high: "🔴 ", normal: "", low: "" };
const RECURRING_AT_MIN = 7 * 60;
const DIGEST_AT_MIN = 9 * 60;
const TZ_MS = 5 * 3600 * 1000;

const fresh = (iso, ms = FRESH_MS) => Boolean(iso) && Date.now() - Date.parse(iso) < ms;
const tashkentTime = (iso) => new Date(Date.parse(iso) + TZ_MS).toISOString().slice(0, 16).replace("T", " ");
const shiftDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
const human = (day) => (day ? `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}` : "");
const isOpen = (t) => t.status !== "done";

const create = (db) => {
  const unwatch = [];
  let timer = null;

  // ── helpers ────────────────────────────────────────────────────────
  const allStaff = async () => (await db.collection("staff").get()).docs.map((d) => ({ email: d.id, ...d.data() }));
  const staffByEmail = async (email) => {
    if (!email) return null;
    const snap = await db.collection("staff").doc(String(email).toLowerCase()).get().catch(() => null);
    return snap && snap.exists ? { email: snap.id, ...snap.data() } : null;
  };
  const staffByChat = async (chatId) => (await allStaff()).find((s) => Number(s.telegram_chat_id) === Number(chatId)) || null;
  const linkedAdmins = async () => (await allStaff()).filter((s) => s.role === "admin" && s.telegram_chat_id);
  // Whoever gave the task, or — for agent-given tasks — the admins.
  const giversOf = async (t) => {
    const giver = await staffByEmail(t.assigned_by_email);
    return giver && giver.telegram_chat_id ? [giver] : linkedAdmins();
  };

  // Sets `field` on a document unless already set; true if this call won.
  const claimOn = async (ref, field) =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()[field]) return false;
      tx.update(ref, { [field]: new Date().toISOString() });
      return true;
    });
  const claim = (id, field) => claimOn(db.collection("tasks").doc(id), field);

  // Remember which task a sent message was about, so a reply to it becomes
  // a comment on that task.
  const rememberMsg = async (sent, taskId) => {
    const m = sent && sent.result;
    if (m && m.chat) await db.collection("tg_task_msgs").doc(`${m.chat.id}_${m.message_id}`).set({ task_id: taskId, at: new Date().toISOString() }).catch(() => undefined);
  };

  const sendPhoto = async (chatId, dataUrl, caption, name = "fayl") => {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
    if (!m) return null;
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    const isImage = m[1].startsWith("image/");
    fd.append(isImage ? "photo" : "document", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), isImage ? "rasm.jpg" : name);
    if (caption) fd.append("caption", caption.slice(0, 1000));
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${isImage ? "sendPhoto" : "sendDocument"}`, { method: "POST", body: fd });
    return res.json().catch(() => null);
  };

  const buttons = (id, status) => {
    const row = [];
    if (status === "new") row.push({ text: "▶️ Ishga oldim", callback_data: `task:start:${id}` });
    if (status !== "done") row.push({ text: "✅ Bajardim", callback_data: `task:done:${id}` });
    return { inline_keyboard: row.length ? [row] : [] };
  };

  const taskText = (t) => {
    const lines = [`📋 Yangi vazifa${t.priority === "high" ? " · 🔴 SHOSHILINCH" : ""}`, "", t.title];
    if (t.description) lines.push(String(t.description).slice(0, 1500));
    const meta = [
      t.due_date ? `Muddat: ${dayCodeOf(t.due_date)}` : "",
      t.order_number ? `Buyurtma: ${t.order_number}` : "",
      t.customer_name ? `Mijoz: ${t.customer_name}` : "",
      t.assigned_by_name ? `Bergan: ${t.assigned_by_name}` : "",
      t.template_id ? "🔁 Takroriy vazifa" : "",
    ].filter(Boolean);
    if (meta.length) lines.push("", ...meta);
    lines.push("", "Savol bo'lsa — shu xabarga javob yozing.");
    return lines.join("\n");
  };

  // ── notices ────────────────────────────────────────────────────────
  const notifyAssignee = async (id, t) => {
    const s = await staffByEmail(t.assigned_to_email);
    if (!s || !s.telegram_chat_id) return;
    const sent = await telegram("sendMessage", { chat_id: s.telegram_chat_id, text: taskText(t), reply_markup: buttons(id, t.status || "new") });
    await rememberMsg(sent, id);
  };

  const notifyDone = async (id, t) => {
    const text = [
      `✅ Vazifa bajarildi`,
      ``,
      `${PRIORITY_ICON[t.priority] || ""}${t.title}`,
      `Xodim: ${t.assigned_to_name || t.assigned_to_email}`,
      t.completed_at ? `Vaqt: ${tashkentTime(t.completed_at)}` : "",
      t.order_number ? `Buyurtma: ${t.order_number}` : "",
      t.result_note ? `Izoh: ${clip(t.result_note, 1000)}` : "",
      t.due_date && t.completed_at && dayCodeOf(t.completed_at) > dayCodeOf(t.due_date) ? `⚠️ Muddatdan kech (${human(dayCodeOf(t.due_date))})` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const files = (await db.collection("tasks").doc(id).collection("files").get()).docs.map((d) => d.data()).slice(0, 3);
    const seen = new Set();
    for (const s of await giversOf(t)) {
      if (seen.has(s.telegram_chat_id) || s.email === String(t.assigned_to_email).toLowerCase()) continue;
      seen.add(s.telegram_chat_id);
      await rememberMsg(await telegram("sendMessage", { chat_id: s.telegram_chat_id, text }), id);
      for (const f of files) await sendPhoto(s.telegram_chat_id, f.data, `📎 ${t.title}`, f.name);
    }
  };

  const onTaskChange = async (id, t) => {
    if (!t) return;
    if (!t.assign_notified_at && t.status !== "done" && t.assigned_to_email && fresh(t.created_at)) {
      if (await claim(id, "assign_notified_at")) await notifyAssignee(id, t);
    }
    if (t.status === "done" && !t.done_notified_at && fresh(t.completed_at)) {
      if (await claim(id, "done_notified_at")) await notifyDone(id, t);
    }
  };

  // A comment reaches everyone on the task except its author.
  const onComment = async (ref, c) => {
    const taskRef = ref.parent.parent;
    const snap = await taskRef.get();
    if (!snap.exists) return;
    const t = snap.data();
    // Listeners replay every comment on start — only write when it changed.
    const count = (await taskRef.collection("comments").get()).size;
    if (count !== t.comment_count) await taskRef.update({ comment_count: count, last_comment_at: c.created_at || new Date().toISOString() });
    if (!fresh(c.created_at, 30 * 60 * 1000) || !(await claimOn(ref, "notified_at"))) return;
    const author = String(c.by_email || "").toLowerCase();
    const to = [];
    const assignee = await staffByEmail(t.assigned_to_email);
    if (assignee && assignee.email !== author) to.push(assignee);
    for (const g of await giversOf(t)) if (g.email !== author) to.push(g);
    const seen = new Set();
    for (const s of to) {
      if (!s.telegram_chat_id || seen.has(s.telegram_chat_id)) continue;
      seen.add(s.telegram_chat_id);
      const sent = await telegram("sendMessage", {
        chat_id: s.telegram_chat_id,
        text: `💬 Izoh — «${t.title}»\n${c.by_name || c.by_email}: ${clip(c.text, 1500)}\n\nJavob yozish uchun shu xabarga javob (reply) qiling.`,
      });
      await rememberMsg(sent, taskRef.id);
    }
  };

  // Files: keep the count, and send proof added after the task was done.
  const onFile = async (ref, f) => {
    const taskRef = ref.parent.parent;
    const snap = await taskRef.get();
    if (!snap.exists) return;
    const t = snap.data();
    const count = (await taskRef.collection("files").get()).size;
    if (count !== t.file_count) await taskRef.update({ file_count: count });
    if (!f || !fresh(f.created_at, 30 * 60 * 1000) || t.status !== "done" || !t.done_notified_at) return;
    if (!(await claimOn(ref, "notified_at"))) return;
    for (const s of await giversOf(t)) {
      if (s.email === String(t.assigned_to_email).toLowerCase()) continue;
      await sendPhoto(s.telegram_chat_id, f.data, `📎 Isbot — «${t.title}» (${f.by_name || ""})`, f.name);
    }
  };

  // ── Telegram: buttons and private messages ─────────────────────────
  const handleCallback = async (cq) => {
    const answer = (text, alert = false) => telegram("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });
    const m = /^task:(start|done):([A-Za-z0-9]+)$/.exec(cq.data || "");
    if (!m) return answer("Noma'lum tugma");
    const ref = db.collection("tasks").doc(m[2]);
    const snap = await ref.get();
    if (!snap.exists) return answer("Vazifa topilmadi (o'chirilgan bo'lishi mumkin)", true);
    const t = snap.data();
    const s = await staffByEmail(t.assigned_to_email);
    if (!s || Number(s.telegram_chat_id) !== Number(cq.from.id)) return answer("Bu vazifa sizga berilmagan", true);

    const next = m[1] === "start" ? "in_progress" : "done";
    const now = new Date().toISOString();
    const result = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data();
      if (cur.status === "done") return { ok: false, status: cur.status };
      if (next === "in_progress" && cur.status !== "new") return { ok: false, status: cur.status };
      tx.update(ref, {
        status: next,
        started_at: cur.started_at || now,
        completed_at: next === "done" ? now : null,
        history: [...(cur.history || []), { status: next, at: now, by_name: s.full_name || s.email, by_email: s.email, note: "Telegram orqali" }],
        updated_at: now,
      });
      return { ok: true, status: next };
    });
    if (cq.message) {
      await telegram("editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: `${String(cq.message.text || "").replace(/\n\nHolat: [\s\S]*$/, "")}\n\nHolat: ${LABEL[result.status] || result.status}${result.ok ? ` (${tashkentTime(now)})` : ""}`.slice(0, 4000),
        reply_markup: buttons(m[2], result.status),
      });
    }
    if (result.ok && next === "done") {
      // The next message (a note or a photo) becomes the result / proof.
      await db.collection("tg_task_pending").doc(String(cq.from.id)).set({ task_id: m[2], until: new Date(Date.now() + PENDING_MS).toISOString() });
      await telegram("sendMessage", { chat_id: cq.from.id, text: "Xohlasangiz, natija haqida izoh yoki rasm (chek, tayyor mahsulot) yuboring — vazifaga qo'shaman." });
    }
    return answer(result.ok ? (next === "done" ? "Bajarildi ✅ — vazifa bergan odamga xabar ketdi" : "Ishga olindi ▶️") : `Vazifa allaqachon: ${LABEL[result.status] || result.status}`);
  };

  const downloadAsDataUrl = async (fileId, mime) => {
    const info = await telegram("getFile", { file_id: fileId });
    const path = info && info.result && info.result.file_path;
    if (!path) throw new Error("Faylni olib bo'lmadi");
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE) throw new Error("Fayl juda katta (650 KB gacha)");
    return { data: `data:${mime};base64,${buf.toString("base64")}`, size: buf.length };
  };

  // Private message from an employee: a reply to a task message becomes a
  // comment; right after ✅ a note/photo becomes the result or proof.
  // Returns true when handled (otherwise the HR agent gets it).
  const handlePrivateMessage = async (msg) => {
    const chatId = msg.chat && msg.chat.id;
    if (!chatId || (msg.text && msg.text.startsWith("/"))) return false;
    let taskId = null;
    let mode = null;
    if (msg.reply_to_message) {
      const link = await db.collection("tg_task_msgs").doc(`${chatId}_${msg.reply_to_message.message_id}`).get();
      if (link.exists) {
        taskId = link.data().task_id;
        mode = "comment";
      }
    }
    if (!taskId) {
      const pending = await db.collection("tg_task_pending").doc(String(chatId)).get();
      if (pending.exists && pending.data().until > new Date().toISOString()) {
        taskId = pending.data().task_id;
        mode = "proof";
      }
    }
    if (!taskId) return false;
    const s = await staffByChat(chatId);
    if (!s) return false;
    const taskRef = db.collection("tasks").doc(taskId);
    const tSnap = await taskRef.get();
    if (!tSnap.exists) {
      await telegram("sendMessage", { chat_id: chatId, text: "Bu vazifa o'chirilgan." });
      return true;
    }
    const t = tSnap.data();
    const allowed = [String(t.assigned_to_email).toLowerCase(), String(t.assigned_by_email).toLowerCase()].includes(s.email) || s.role === "admin";
    if (!allowed) return false;
    const now = new Date().toISOString();
    const by = { by_email: s.email, by_name: s.full_name || s.email };
    try {
      const photo = Array.isArray(msg.photo) && msg.photo.length ? [...msg.photo].reverse().find((p) => !p.file_size || p.file_size <= MAX_FILE) : null;
      const doc = msg.document && msg.document.file_size <= MAX_FILE ? msg.document : null;
      if (msg.document && !doc) throw new Error("fayl juda katta (650 KB gacha). Rasm sifatida yuboring yoki saytdan qo'shing");
      if (photo || doc) {
        const mime = photo ? "image/jpeg" : doc.mime_type || "application/octet-stream";
        const { data, size } = await downloadAsDataUrl((photo || doc).file_id, mime);
        await taskRef.collection("files").add({ task_id: taskId, name: doc ? doc.file_name || "fayl" : "telegram-rasm.jpg", mime, data, size, ...by, via: "telegram", created_at: now });
      }
      const text = (msg.text || msg.caption || "").trim();
      if (text) {
        if (mode === "proof" && !t.result_note && String(t.assigned_to_email).toLowerCase() === s.email) await taskRef.update({ result_note: clip(text, 1000) });
        else await taskRef.collection("comments").add({ task_id: taskId, text: clip(text, 2000), ...by, via: "telegram", created_at: now });
      }
      if (!photo && !doc && !text) return false;
      await telegram("sendMessage", {
        chat_id: chatId,
        text: `${photo || doc ? "📎 Fayl" : mode === "proof" ? "📝 Izoh" : "💬 Izoh"} «${t.title}» vazifasiga qo'shildi ✅`,
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    } catch (err) {
      await telegram("sendMessage", { chat_id: chatId, text: `Qo'shib bo'lmadi: ${err.message}` });
    }
    return true;
  };

  // ── daily jobs ─────────────────────────────────────────────────────
  const tzNow = () => new Date(Date.now() + TZ_MS);
  const isoWeekday = (d) => ((d.getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday

  const templateDueToday = (tpl, today, d) => {
    const r = tpl.repeat || {};
    if (r.type === "daily") return isoWeekday(d) !== 7;
    if (r.type === "weekly") return Number(r.weekday) === isoWeekday(d);
    if (r.type === "monthly") return Number(r.day) === Number(today.slice(8, 10));
    return false;
  };

  const createRecurring = async () => {
    const today = todayCode();
    const d = tzNow();
    const templates = (await db.collection("task_templates").get()).docs;
    let created = 0;
    for (const doc of templates) {
      const tpl = doc.data();
      if (!tpl.active || tpl.last_created_date === today || !templateDueToday(tpl, today, d)) continue;
      const won = await db.runTransaction(async (tx) => {
        const cur = (await tx.get(doc.ref)).data();
        if (cur.last_created_date === today) return false;
        tx.update(doc.ref, { last_created_date: today });
        return true;
      });
      if (!won) continue;
      const now = new Date().toISOString();
      await db.collection("tasks").add({
        title: tpl.title,
        description: tpl.description || "",
        assigned_to_email: tpl.assigned_to_email,
        assigned_to_name: tpl.assigned_to_name,
        assigned_by_email: tpl.assigned_by_email,
        assigned_by_name: tpl.assigned_by_name,
        priority: tpl.priority || "normal",
        due_date: shiftDay(today, Number(tpl.due_in_days) || 0),
        status: "new",
        started_at: null,
        completed_at: null,
        template_id: doc.id,
        history: [{ status: "new", at: now, by_name: "Takroriy vazifa", by_email: tpl.assigned_by_email }],
        created_at: now,
      });
      created++;
    }
    if (created) console.log(`Recurring tasks created: ${created}`);
  };

  const morningDigest = async () => {
    const today = todayCode();
    const tomorrow = shiftDay(today, 1);
    const tasks = (await db.collection("tasks").get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter(isOpen);
    const staff = await allStaff();
    let sent = 0;
    for (const s of staff.filter((x) => x.telegram_chat_id)) {
      const mine = tasks.filter((t) => String(t.assigned_to_email).toLowerCase() === s.email);
      if (!mine.length) continue;
      const due = (t) => (t.due_date ? dayCodeOf(t.due_date) : "");
      const line = (t) => `• ${PRIORITY_ICON[t.priority] || ""}${t.title}${t.due_date ? ` (${human(due(t))})` : ""}${t.status === "in_progress" ? " — ishlanmoqda" : ""}`;
      const overdue = mine.filter((t) => due(t) && due(t) < today);
      const todayList = mine.filter((t) => due(t) === today);
      const tomorrowList = mine.filter((t) => due(t) === tomorrow);
      const rest = mine.filter((t) => !overdue.includes(t) && !todayList.includes(t) && !tomorrowList.includes(t));
      const L = [`☀️ Xayrli tong, ${String(s.full_name || "").split(" ")[0] || ""}! Vazifalaringiz: ${mine.length} ta`];
      if (overdue.length) L.push("", `🔴 Kechikkan (${overdue.length}):`, ...overdue.map(line));
      if (todayList.length) L.push("", `📅 Bugun muddati (${todayList.length}):`, ...todayList.map(line));
      if (tomorrowList.length) L.push("", `⏰ Ertaga muddati (${tomorrowList.length}):`, ...tomorrowList.map(line));
      if (rest.length) L.push("", `📋 Boshqalar (${rest.length}):`, ...rest.slice(0, 10).map(line), ...(rest.length > 10 ? [`… va yana ${rest.length - 10} ta`] : []));
      L.push("", "Saytda: Vazifalar bo'limi.");
      await telegram("sendMessage", { chat_id: s.telegram_chat_id, text: L.join("\n") });
      sent++;
    }
    // Newly overdue → the giver is told once.
    let overdueSent = 0;
    for (const t of tasks) {
      const d = t.due_date ? dayCodeOf(t.due_date) : "";
      if (!d || d >= today || t.overdue_notified_at) continue;
      if (!(await claim(t.id, "overdue_notified_at"))) continue;
      for (const g of await giversOf(t)) {
        if (g.email === String(t.assigned_to_email).toLowerCase()) continue;
        const m = await telegram("sendMessage", {
          chat_id: g.telegram_chat_id,
          text: `⚠️ Vazifa kechikdi\n\n${PRIORITY_ICON[t.priority] || ""}${t.title}\nXodim: ${t.assigned_to_name || t.assigned_to_email}\nMuddat: ${human(d)} · Holat: ${LABEL[t.status] || t.status}`,
        });
        await rememberMsg(m, t.id);
      }
      overdueSent++;
    }
    console.log(`Task digest: ${sent} employees, ${overdueSent} overdue notices`);
  };

  const runOnce = async (name, fn) => {
    const ref = db.collection("task_runs").doc(`${todayCode()}_${name}`);
    try {
      await ref.create({ started_at: new Date().toISOString() });
    } catch {
      return;
    }
    try {
      await fn();
      await ref.update({ done_at: new Date().toISOString() });
    } catch (err) {
      console.error(`Task job ${name} failed`, err);
      await ref.update({ error: err.message }).catch(() => undefined);
    }
  };

  const tick = async () => {
    const d = tzNow();
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (min >= RECURRING_AT_MIN && min < RECURRING_AT_MIN + 12 * 60) await runOnce("recurring", createRecurring);
    if (isoWeekday(d) !== 7 && min >= DIGEST_AT_MIN && min < DIGEST_AT_MIN + 3 * 60) await runOnce("digest", morningDigest);
  };

  // ── start ──────────────────────────────────────────────────────────
  const watch = (query, fn, label) =>
    query.onSnapshot(
      (snap) => {
        for (const ch of snap.docChanges()) fn(ch).catch((err) => console.error(`${label} failed`, ch.doc.id, err.message));
      },
      (err) => console.error(`${label} listener error`, err.message),
    );
  const underTask = (ref) => ref.parent.parent && ref.parent.parent.parent.id === "tasks";

  const start = () => {
    unwatch.push(watch(db.collection("tasks"), async (ch) => ch.type !== "removed" && onTaskChange(ch.doc.id, ch.doc.data()), "Task notify"));
    unwatch.push(
      watch(db.collectionGroup("comments"), async (ch) => ch.type === "added" && underTask(ch.doc.ref) && onComment(ch.doc.ref, ch.doc.data()), "Task comment"),
    );
    unwatch.push(
      watch(db.collectionGroup("files"), async (ch) => underTask(ch.doc.ref) && ch.type !== "modified" && onFile(ch.doc.ref, ch.type === "added" ? ch.doc.data() : null), "Task file"),
    );
    void tick().catch((err) => console.error("Task tick failed", err));
    timer = setInterval(() => tick().catch((err) => console.error("Task tick failed", err)), 60 * 1000);
    console.log("Task notifications started (recurring 07:00, digest 09:00)");
  };
  const stop = () => {
    unwatch.splice(0).forEach((u) => u());
    clearInterval(timer);
  };

  return { start, stop, handleCallback, handlePrivateMessage, _test: { onTaskChange, onComment, onFile, taskText, createRecurring, morningDigest, tick } };
};

module.exports = { create };
