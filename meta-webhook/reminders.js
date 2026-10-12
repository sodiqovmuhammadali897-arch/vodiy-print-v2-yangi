// ⏰ Eslatma — personal reminders in the bot's private chat, for every
// employee who linked Telegram (staff.telegram_chat_id).
//
//   [⏰ Eslatma] → "what about?" → the employee writes it → time buttons
//   (30 daq, 1 soat, 2 soat, bugun 17:00, ertaga 10:00, or typed: "15:30",
//   "14.10 11:00", "ertaga 9:30") → saved in bot_reminders. At that time
//   the bot sends it with [✅ Bajarildi] [+30 daq] [+1 soat] [Ertaga].
//   [📋 Eslatmalarim] lists the pending ones, each with a cancel button.
//
// Nothing goes to amoCRM. The in-progress step lives in
// bot_reminder_drafts/{chatId} (30 minutes); a sent reminder is claimed in
// a transaction, so a restart never sends it twice.
const { telegram } = require("./telegram");
const { clip } = require("./shared");

const TZ_MS = 5 * 3600 * 1000;
const DRAFT_MS = 30 * 60 * 1000;
const TICK_MS = 30 * 1000;
const BTN = { add: "⏰ Eslatma", list: "📋 Eslatmalarim" };
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

// Tashkent wall clock ↔ ms.
const local = (ms) => new Date(ms + TZ_MS);
const atLocal = (y, m, d, h, mi) => Date.UTC(y, m, d, h, mi) - TZ_MS;
const dayParts = (ms) => {
  const t = local(ms);
  return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
};

// Preset buttons → the moment they mean.
function presetAt(key, now) {
  const [y, m, d] = dayParts(now);
  if (key === "30m") return now + 30 * 60 * 1000;
  if (key === "1h") return now + 60 * 60 * 1000;
  if (key === "2h") return now + 2 * 60 * 60 * 1000;
  if (key === "t17") return atLocal(y, m, d, 17, 0);
  if (key === "d10") return atLocal(y, m, d + 1, 10, 0);
  return null;
}

// What an employee types: "15:30", "15.30", "ertaga 9:30", "14.10 11:00",
// "14.10.2026 11:00", "14/10 11:00". A bare time already past today means
// tomorrow. null when it can't be read or is not in the future.
function parseWhen(text, now) {
  const s = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  const tm = s.match(/(\d{1,2})[:.](\d{2})$/);
  if (!tm) return null;
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (h > 23 || mi > 59) return null;
  const head = s.slice(0, tm.index).trim();
  let [y, m, d] = dayParts(now);
  if (head === "" || head === "bugun") {
    const at = atLocal(y, m, d, h, mi);
    return at > now ? at : atLocal(y, m, d + 1, h, mi);
  }
  if (head === "ertaga") return atLocal(y, m, d + 1, h, mi);
  if (head === "indinga") return atLocal(y, m, d + 2, h, mi);
  const dm = head.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!dm) return null;
  d = Number(dm[1]);
  m = Number(dm[2]) - 1;
  if (dm[3]) y = Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  let at = atLocal(y, m, d, h, mi);
  if (!dm[3] && at <= now) at = atLocal(y + 1, m, d, h, mi);
  return at > now ? at : null;
}

// "bugun 15:30", "ertaga 10:00", "14-oktyabr 11:00".
function whenLabel(at, now) {
  const t = local(at);
  const hm = `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  const [y, m, d] = dayParts(now);
  const same = (k) => {
    const [a, b, c] = dayParts(atLocal(y, m, d + k, 12, 0));
    return t.getUTCFullYear() === a && t.getUTCMonth() === b && t.getUTCDate() === c;
  };
  if (same(0)) return `bugun ${hm}`;
  if (same(1)) return `ertaga ${hm}`;
  return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]} ${hm}`;
}

const timeButtons = (now) => {
  const [y, m, d] = dayParts(now);
  const row1 = [
    { text: "30 daqiqa", callback_data: "rem:t:30m" },
    { text: "1 soat", callback_data: "rem:t:1h" },
    { text: "2 soat", callback_data: "rem:t:2h" },
  ];
  const row2 = [];
  if (atLocal(y, m, d, 17, 0) > now + 10 * 60 * 1000) row2.push({ text: "Bugun 17:00", callback_data: "rem:t:t17" });
  row2.push({ text: "Ertaga 10:00", callback_data: "rem:t:d10" });
  return { inline_keyboard: [row1, row2, [{ text: "✏️ Boshqa vaqt", callback_data: "rem:t:custom" }, { text: "Bekor qilish", callback_data: "rem:t:cancel" }]] };
};

const dueButtons = (id) => ({
  inline_keyboard: [
    [{ text: "✅ Bajarildi", callback_data: `rem:done:${id}` }],
    [
      { text: "+30 daq", callback_data: `rem:snz:${id}:30` },
      { text: "+1 soat", callback_data: `rem:snz:${id}:60` },
      { text: "Ertaga 10:00", callback_data: `rem:snz:${id}:d10` },
    ],
  ],
});

const create = (db, { keyboardFor = () => undefined } = {}) => {
  let timer = null;
  let running = false;
  const drafts = db.collection("bot_reminder_drafts");
  const col = db.collection("bot_reminders");

  const staffByChat = async (chatId) => {
    const snap = await db.collection("staff").where("telegram_chat_id", "==", Number(chatId)).limit(1).get();
    return snap.empty ? null : { email: snap.docs[0].id, ...snap.docs[0].data() };
  };
  const say = async (chatId, text, extra = {}) => telegram("sendMessage", { chat_id: chatId, text, ...extra });

  const save = async (chatId, s, text, at, now) => {
    const ref = col.doc();
    await ref.set({ chat_id: Number(chatId), email: s.email, text, at, status: "pending", created_at: new Date(now).toISOString() });
    await drafts.doc(String(chatId)).delete().catch(() => undefined);
    await say(chatId, `✅ ${whenLabel(at, now)} da eslataman:\n${text}`, {
      reply_markup: { inline_keyboard: [[{ text: "Bekor qilish", callback_data: `rem:x:${ref.id}` }]] },
    });
  };

  const listText = async (chatId, now) => {
    const rows = (await col.where("chat_id", "==", Number(chatId)).get()).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.at - b.at);
    if (!rows.length) return { text: "Kutilayotgan eslatma yo'q. Yangisini «⏰ Eslatma» tugmasi bilan qo'ying." };
    const shown = rows.slice(0, 10);
    return {
      text: ["📋 Kutilayotgan eslatmalar:", ...shown.map((r, i) => `${i + 1}. ${whenLabel(r.at, now)} — ${clip(r.text, 80)}`), rows.length > 10 ? `… yana ${rows.length - 10} ta` : ""].filter(Boolean).join("\n"),
      reply_markup: { inline_keyboard: shown.map((r, i) => [{ text: `❌ ${i + 1}. ${whenLabel(r.at, now)}`, callback_data: `rem:x:${r.id}` }]) },
    };
  };

  // True when the message was the reminder button, a step of a reminder
  // being set, or "Eslatmalarim" — nothing else should answer it then.
  const handlePrivateMessage = async (msg) => {
    const chatId = msg.chat && msg.chat.id;
    const text = (msg.text || "").trim();
    if (!chatId || !text) return false;
    const now = Date.now();
    if (text === BTN.add || /^\/eslatma\b/i.test(text)) {
      const s = await staffByChat(chatId);
      if (!s) return false;
      await drafts.doc(String(chatId)).set({ step: "text", until: now + DRAFT_MS });
      await say(chatId, "⏰ Nima haqida eslatay? Bitta xabar bilan yozing.\nMasalan: «Aziz aka, +998 90 123 45 67 — narxni aytish, ko'tarmadi»", { reply_markup: keyboardFor(s) });
      return true;
    }
    if (text === BTN.list || /^\/eslatmalar\b/i.test(text)) {
      const s = await staffByChat(chatId);
      if (!s) return false;
      const l = await listText(chatId, now);
      await say(chatId, l.text, l.reply_markup ? { reply_markup: l.reply_markup } : {});
      return true;
    }
    if (msg.reply_to_message || text.startsWith("/")) return false;
    const snap = await drafts.doc(String(chatId)).get();
    const draft = snap.exists ? snap.data() : null;
    if (!draft || draft.until < now) return false;
    if (/^(bekor|bekor qilish|cancel)$/i.test(text)) {
      await drafts.doc(String(chatId)).delete();
      await say(chatId, "Eslatma bekor qilindi.");
      return true;
    }
    if (draft.step === "text") {
      await drafts.doc(String(chatId)).set({ step: "time", text: clip(text, 500), until: now + DRAFT_MS });
      await say(chatId, "Qachon eslatay?", { reply_markup: timeButtons(now) });
      return true;
    }
    if (draft.step === "custom" || draft.step === "time") {
      const at = parseWhen(text, now);
      if (!at) {
        await say(chatId, "Vaqtni tushunmadim. Shunday yozing: «15:30», «ertaga 9:30» yoki «14.10 11:00». Bekor qilish uchun — «bekor».");
        return true;
      }
      const s = await staffByChat(chatId);
      if (!s) return false;
      await save(chatId, s, draft.text, at, now);
      return true;
    }
    return false;
  };

  const handleCallback = async (cq) => {
    const chatId = cq.message && cq.message.chat && cq.message.chat.id;
    const messageId = cq.message && cq.message.message_id;
    const data = cq.data || "";
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) });
    const now = Date.now();
    if (!chatId) return answer();

    let m = data.match(/^rem:t:(\w+)$/);
    if (m) {
      const snap = await drafts.doc(String(chatId)).get();
      const draft = snap.exists ? snap.data() : null;
      if (!draft || draft.until < now || !draft.text) {
        await answer("Bu eslatma eskirgan — qaytadan «⏰ Eslatma»ni bosing");
        return;
      }
      await telegram("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
      if (m[1] === "cancel") {
        await drafts.doc(String(chatId)).delete();
        await answer("Bekor qilindi");
        await say(chatId, "Eslatma bekor qilindi.");
        return;
      }
      if (m[1] === "custom") {
        await drafts.doc(String(chatId)).set({ ...draft, step: "custom", until: now + DRAFT_MS });
        await answer();
        await say(chatId, "Vaqtni yozing: «15:30», «ertaga 9:30» yoki «14.10 11:00».");
        return;
      }
      const at = presetAt(m[1], now);
      const s = await staffByChat(chatId);
      if (!at || !s) return answer();
      await answer();
      await save(chatId, s, draft.text, at, now);
      return;
    }

    m = data.match(/^rem:(x|done|snz):([\w-]+)(?::(\w+))?$/);
    if (!m) return answer();
    const ref = col.doc(m[2]);
    const snap = await ref.get();
    const r = snap.exists ? snap.data() : null;
    if (!r || Number(r.chat_id) !== Number(chatId)) return answer("Eslatma topilmadi");
    if (m[1] === "x") {
      if (r.status !== "pending") return answer("Bu eslatma allaqachon yuborilgan yoki bekor qilingan");
      await ref.update({ status: "cancelled", cancelled_at: new Date(now).toISOString() });
      await answer("Bekor qilindi");
      await say(chatId, `❌ Bekor qilindi: ${clip(r.text, 120)}`);
      return;
    }
    if (m[1] === "done") {
      await ref.update({ status: "done", done_at: new Date(now).toISOString() });
      await answer("Bajarildi");
      await telegram("editMessageText", { chat_id: chatId, message_id: messageId, text: `✅ Bajarildi: ${r.text}` }).catch(() => undefined);
      return;
    }
    const at = m[3] === "d10" ? presetAt("d10", now) : now + Number(m[3] || 30) * 60 * 1000;
    await ref.update({ status: "pending", at, snoozed: (r.snoozed || 0) + 1 });
    await answer(`${whenLabel(at, now)} da yana eslataman`);
    await telegram("editMessageText", { chat_id: chatId, message_id: messageId, text: `⏰ ${r.text}\n\n↪️ ${whenLabel(at, now)} ga ko'chirildi` }).catch(() => undefined);
  };

  // Every 30 seconds: send what is due. Claimed first, so it goes once.
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const due = (await col.where("status", "==", "pending").get()).docs.filter((d) => Number(d.data().at) <= now);
      for (const d of due) {
        const won = await db.runTransaction(async (tx) => {
          const s = await tx.get(d.ref);
          if (!s.exists || s.data().status !== "pending" || Number(s.data().at) > now) return false;
          tx.update(d.ref, { status: "sent", sent_at: new Date(now).toISOString() });
          return true;
        });
        if (!won) continue;
        const r = d.data();
        await say(r.chat_id, `⏰ Eslatma:\n${r.text}`, { reply_markup: dueButtons(d.id) }).catch((err) => console.error("Reminder send failed", err.message));
      }
    } catch (err) {
      console.error("Reminders tick failed", err.message);
    } finally {
      running = false;
    }
  };

  // Once per chat: tell everyone linked about the new buttons (and show
  // them — a reply keyboard stays until replaced).
  const announce = async () => {
    const staff = (await db.collection("staff").get()).docs.map((d) => ({ email: d.id, ...d.data() })).filter((s) => s.telegram_chat_id);
    for (const s of staff) {
      const ref = db.collection("tg_kb").doc(String(s.telegram_chat_id));
      const seen = await ref.get();
      if (seen.exists && seen.data().reminders) continue;
      await ref.set({ reminders: new Date().toISOString() }, { merge: true });
      await say(s.telegram_chat_id, "Yangi: pastda «⏰ Eslatma» tugmasi. Kimgadir qo'ng'iroq qildingiz-u, ko'tarmadimi — tugmani bosing, nima haqida ekanini yozing va vaqtni tanlang. Bot o'sha vaqtda eslatadi.\n«📋 Eslatmalarim» — kutilayotganlari.", {
        reply_markup: keyboardFor(s),
      }).catch(() => undefined);
    }
  };

  let announcer = null;
  const start = () => {
    timer = setInterval(() => void tick(), TICK_MS);
    // Newly linked employees get the buttons within half an hour.
    announcer = setInterval(() => void announce().catch((err) => console.error("Reminder announce failed", err.message)), 30 * 60 * 1000);
    void tick();
    void announce().catch((err) => console.error("Reminder announce failed", err.message));
    console.log("Reminders started");
  };
  const stop = () => {
    clearInterval(timer);
    clearInterval(announcer);
  };

  return { start, stop, tick, handlePrivateMessage, handleCallback };
};

module.exports = { create, presetAt, parseWhen, whenLabel, BTN };
