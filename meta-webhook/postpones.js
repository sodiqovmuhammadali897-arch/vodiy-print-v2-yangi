// Surilgan zadacha → sabab → admin qarori.
//
// When a manager moves an open amoCRM task off today (or an earlier day)
// to a later day (amocrm.js spots it), the bot asks the manager why, with
// a [✍️ Sababini yozish] button (a reply to the message works too). The
// reason goes to the admins with [✅ Tasdiqlash] [❌ Rad etish]. Approved →
// the postponement is excused at once: it no longer counts late in the KPI
// (amo_task_misses entry gets `excused`); the amoCRM task itself stays at
// its new date. Rejected, or no answer — it stays late. No reason within an
// hour → the admins get it anyway, marked "sabab yozilmadi", with the same
// buttons. Everything lives in amo_postpones/{id}.
const { telegram } = require("./telegram");
const { clip } = require("./shared");

const ASK_MS = 60 * 60 * 1000;
const DRAFT_MS = 30 * 60 * 1000;
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const dayLabel = (ms) => {
  const t = new Date(ms + 5 * 3600 * 1000);
  return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]}`;
};

// What the admins read.
function adminText(p) {
  const head = `⚠️ ${p.manager}: ${p.who ? `${p.who} — ` : ""}zadacha${p.task ? ` «${p.task}»` : ""} ${dayLabel(p.from_due)}dan ${dayLabel(p.to_due)}ga surildi.`;
  return p.reason ? `${head}\n\n📝 Sababi: ${p.reason}` : `${head}\n\n📝 Sabab yozilmadi (1 soat ichida).`;
}
const decisionButtons = (id) => ({ inline_keyboard: [[{ text: "✅ Tasdiqlash", callback_data: `pp:ok:${id}` }, { text: "❌ Rad etish", callback_data: `pp:no:${id}` }]] });

const create = (db) => {
  const col = db.collection("amo_postpones");
  const drafts = db.collection("bot_reason_drafts");

  const admins = async () =>
    (await db.collection("staff").where("role", "==", "admin").get()).docs
      .map((d) => d.data())
      .filter((s) => s.telegram_chat_id && !s.report_manager_id)
      .map((s) => Number(s.telegram_chat_id));

  const toAdmins = async (id, p) => {
    const sent = [];
    for (const chat of await admins()) {
      if (p.manager_chat && chat === Number(p.manager_chat)) continue;
      const r = await telegram("sendMessage", { chat_id: chat, text: adminText(p), reply_markup: decisionButtons(id) }).catch(() => null);
      if (r && r.result) sent.push({ chat, message_id: r.result.message_id });
    }
    await col.doc(id).update({ admin_msgs: sent });
  };

  // amocrm.js: a task was put off. Ask the manager; if there is no chat to
  // ask in, go straight to the admins.
  const ask = async (p, managerText) => {
    const ref = col.doc();
    const doc = { ...p, status: p.manager_chat ? "asked" : "no_reason", asked_at: Date.now(), created_at: new Date().toISOString() };
    await ref.set(doc);
    if (!p.manager_chat) return toAdmins(ref.id, doc);
    const r = await telegram("sendMessage", {
      chat_id: p.manager_chat,
      text: managerText,
      reply_markup: { inline_keyboard: [[{ text: "✍️ Sababini yozish", callback_data: `pp:why:${ref.id}` }]] },
    }).catch(() => null);
    if (r && r.result) await db.collection("tg_postpone_msgs").doc(`${p.manager_chat}_${r.result.message_id}`).set({ id: ref.id });
  };

  // Asked an hour ago and still no reason: tell the admins anyway.
  const tick = async (now = Date.now()) => {
    const open = (await col.where("status", "==", "asked").get()).docs.filter((d) => now - Number(d.data().asked_at || 0) >= ASK_MS);
    for (const d of open) {
      const won = await db.runTransaction(async (tx) => {
        const s = await tx.get(d.ref);
        if (!s.exists || s.data().status !== "asked") return false;
        tx.update(d.ref, { status: "no_reason" });
        return true;
      });
      if (won) await toAdmins(d.id, { ...d.data(), status: "no_reason" });
    }
  };

  const takeReason = async (id, chatId, text) => {
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const p = snap.data();
    if (Number(p.manager_chat) !== Number(chatId)) return false;
    if (p.status === "decided") {
      await telegram("sendMessage", { chat_id: chatId, text: "Bu surish bo'yicha rahbar allaqachon qaror qilgan." });
      return true;
    }
    const reason = clip(text, 500);
    await ref.update({ reason, reason_at: Date.now(), status: "reason" });
    await drafts.doc(String(chatId)).delete().catch(() => undefined);
    await telegram("sendMessage", { chat_id: chatId, text: "✅ Sabab rahbarga yuborildi. Tasdiqlansa — KPI'da kechikkan sanalmaydi." });
    if (p.status === "no_reason" && (p.admin_msgs || []).length) {
      // The admins already have it without a reason: update that message.
      for (const m of p.admin_msgs) {
        await telegram("editMessageText", { chat_id: m.chat, message_id: m.message_id, text: adminText({ ...p, reason }), reply_markup: decisionButtons(id) }).catch(() => undefined);
      }
      return true;
    }
    await toAdmins(id, { ...p, reason });
    return true;
  };

  // A manager's private message: the reason, if they pressed the button
  // (or replied to the bot's question). True when it was taken.
  const handlePrivateMessage = async (msg) => {
    const chatId = msg.chat && msg.chat.id;
    const text = (msg.text || "").trim();
    if (!chatId || !text || text.startsWith("/")) return false;
    if (msg.reply_to_message) {
      const link = await db.collection("tg_postpone_msgs").doc(`${chatId}_${msg.reply_to_message.message_id}`).get();
      if (link.exists) return takeReason(link.data().id, chatId, text);
    }
    const d = await drafts.doc(String(chatId)).get();
    if (!d.exists || Number(d.data().until) < Date.now()) return false;
    return takeReason(d.data().id, chatId, text);
  };

  const handleCallback = async (cq) => {
    const chatId = cq.message && cq.message.chat && cq.message.chat.id;
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) });
    const m = (cq.data || "").match(/^pp:(why|ok|no):([\w-]+)$/);
    if (!m || !chatId) return answer();
    const ref = col.doc(m[2]);
    const snap = await ref.get();
    if (!snap.exists) return answer("Topilmadi");
    const p = snap.data();

    if (m[1] === "why") {
      if (Number(p.manager_chat) !== Number(chatId)) return answer();
      if (p.status === "decided") return answer("Rahbar allaqachon qaror qilgan");
      await drafts.doc(String(chatId)).set({ id: m[2], until: Date.now() + DRAFT_MS });
      await answer();
      await telegram("sendMessage", { chat_id: chatId, text: "Sababini bitta xabar bilan yozing. Masalan: «Mijoz ko'tarmadi» yoki «17-da qo'ng'iroq qilishni so'radi»." });
      return;
    }

    // Only an admin decides.
    if (!(await admins()).includes(Number(chatId))) return answer("Faqat admin qaror qiladi");
    const ok = m[1] === "ok";
    const won = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists || s.data().status === "decided") return false;
      tx.update(ref, { status: "decided", decision: ok ? "approved" : "rejected", decided_at: new Date().toISOString(), decided_chat: Number(chatId) });
      return true;
    });
    if (!won) return answer("Allaqachon qaror qilingan");
    if (ok) {
      // amocrm.js reloads these each sync: an excused miss stops counting.
      await db
        .collection("amo_task_misses")
        .doc(p.month)
        .set({ month: p.month, ids: { [p.task_id]: { excused: true, excused_at: Date.now() } } }, { merge: true });
    }
    await answer(ok ? "Tasdiqlandi" : "Rad etildi");
    const verdict = ok ? "✅ Tasdiqlandi — KPI'da kechikkan sanalmaydi." : "❌ Rad etildi — KPI'da kechikkan bo'lib qoladi.";
    for (const x of p.admin_msgs || []) {
      await telegram("editMessageText", { chat_id: x.chat, message_id: x.message_id, text: `${adminText(p)}\n\n${verdict}` }).catch(() => undefined);
    }
    if (p.manager_chat) {
      const what = p.who ? `«${p.who}» zadachasini` : "Zadachani";
      const text = ok ? `✅ Rahbar tasdiqladi: ${what} surish uzrli — KPI'da kechikkan sanalmaydi.` : `❌ Rahbar rad etdi: ${what} surish — KPI'da kechikkan bo'lib qoladi.`;
      await telegram("sendMessage", { chat_id: p.manager_chat, text }).catch(() => undefined);
    }
  };

  return { ask, tick, handlePrivateMessage, handleCallback };
};

module.exports = { create, adminText };
