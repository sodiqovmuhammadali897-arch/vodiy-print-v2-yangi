// Task notifications over the bot's private chats (the chat each employee
// linked for attendance, staff.telegram_chat_id):
//
//   • a new task → its assignee gets it with [▶️ Ishga oldim] [✅ Bajardim];
//   • a task marked done (on the site or with the button) → whoever gave
//     it gets "✅ Vazifa bajarildi" with the employee's note. Tasks given
//     by an agent (Bosh agent) go to the admins who linked Telegram.
//
// Changes are picked up with a Firestore listener, and each notice is
// claimed once in the task itself (assign_notified_at / done_notified_at),
// so restarts and double events never send it twice. Only tasks touched
// in the last day are notified, so the first start doesn't replay history.
const { telegram } = require("./telegram");
const { clip, dayCodeOf } = require("./shared");

const FRESH_MS = 24 * 3600 * 1000;
const LABEL = { new: "Yangi", in_progress: "Ishga olindi", done: "Bajarildi" };
const fresh = (iso) => Boolean(iso) && Date.now() - Date.parse(iso) < FRESH_MS;
const tashkentTime = (iso) => new Date(Date.parse(iso) + 5 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");

const create = (db) => {
  let unwatch = null;

  const staffByEmail = async (email) => {
    if (!email) return null;
    const snap = await db.collection("staff").doc(String(email).toLowerCase()).get().catch(() => null);
    return snap && snap.exists ? { email: snap.id, ...snap.data() } : null;
  };
  const linkedAdmins = async () =>
    (await db.collection("staff").get()).docs.map((d) => ({ email: d.id, ...d.data() })).filter((s) => s.role === "admin" && s.telegram_chat_id);

  // Sets `field` on the task unless already set; true if this call won.
  const claim = async (id, field) =>
    db.runTransaction(async (tx) => {
      const ref = db.collection("tasks").doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()[field]) return false;
      tx.update(ref, { [field]: new Date().toISOString() });
      return true;
    });

  const buttons = (id, status) => {
    const row = [];
    if (status === "new") row.push({ text: "▶️ Ishga oldim", callback_data: `task:start:${id}` });
    if (status !== "done") row.push({ text: "✅ Bajardim", callback_data: `task:done:${id}` });
    return row.length ? { inline_keyboard: [row] } : { inline_keyboard: [] };
  };

  const taskText = (t) => {
    const lines = ["📋 Yangi vazifa", "", t.title];
    if (t.description) lines.push(String(t.description).slice(0, 1500));
    const meta = [t.due_date ? `Muddat: ${dayCodeOf(t.due_date)}` : "", t.assigned_by_name ? `Bergan: ${t.assigned_by_name}` : ""].filter(Boolean);
    if (meta.length) lines.push("", ...meta);
    return lines.join("\n");
  };

  const notifyAssignee = async (id, t) => {
    const s = await staffByEmail(t.assigned_to_email);
    if (!s || !s.telegram_chat_id) return;
    await telegram("sendMessage", { chat_id: s.telegram_chat_id, text: taskText(t), reply_markup: buttons(id, t.status || "new") });
  };

  const notifyDone = async (t) => {
    const giver = await staffByEmail(t.assigned_by_email);
    const to = giver && giver.telegram_chat_id ? [giver] : await linkedAdmins();
    const text = [
      `✅ Vazifa bajarildi`,
      ``,
      t.title,
      `Xodim: ${t.assigned_to_name || t.assigned_to_email}`,
      t.completed_at ? `Vaqt: ${tashkentTime(t.completed_at)}` : "",
      t.result_note ? `Izoh: ${clip(t.result_note, 1000)}` : "",
      t.due_date && t.completed_at && dayCodeOf(t.completed_at) > dayCodeOf(t.due_date) ? `⚠️ Muddatdan kech (${dayCodeOf(t.due_date)})` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const seen = new Set();
    for (const s of to) {
      if (seen.has(s.telegram_chat_id) || s.email === String(t.assigned_to_email).toLowerCase()) continue;
      seen.add(s.telegram_chat_id);
      await telegram("sendMessage", { chat_id: s.telegram_chat_id, text });
    }
  };

  const onChange = async (id, t) => {
    if (!t) return;
    if (!t.assign_notified_at && t.status !== "done" && t.assigned_to_email && fresh(t.created_at)) {
      if (await claim(id, "assign_notified_at")) await notifyAssignee(id, t);
    }
    if (t.status === "done" && !t.done_notified_at && fresh(t.completed_at)) {
      if (await claim(id, "done_notified_at")) await notifyDone(t);
    }
  };

  // ✅ / ▶️ pressed in an employee's private chat.
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
    return answer(result.ok ? (next === "done" ? "Bajarildi ✅ — vazifa bergan odamga xabar ketdi" : "Ishga olindi ▶️") : `Vazifa allaqachon: ${LABEL[result.status] || result.status}`);
  };

  const start = () => {
    unwatch = db.collection("tasks").onSnapshot(
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type === "removed") continue;
          onChange(ch.doc.id, ch.doc.data()).catch((err) => console.error("Task notify failed", ch.doc.id, err.message));
        }
      },
      (err) => console.error("Tasks listener error", err.message),
    );
    console.log("Task notifications started");
  };
  const stop = () => {
    if (unwatch) unwatch();
    unwatch = null;
  };

  return { start, stop, handleCallback, _test: { onChange, taskText } };
};

module.exports = { create };
