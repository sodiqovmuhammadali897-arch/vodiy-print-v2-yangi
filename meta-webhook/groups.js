// The work group with Topics: every agent posts to its own topic instead of
// one shared channel. Linking is locked to a one-time code that only a
// signed-in ERP admin can get (Sozlamalar → Telegram guruh), so adding the
// bot to some other group never redirects company reports there.
//
// Config lives in telegram_config/main: { group_chat_id, group_title,
// topics: { it, sales, fin, prod, wh, hr, ig, bot: <message_thread_id> } }.
const crypto = require("crypto");
const { telegram } = require("./telegram");
const { staffFromRequest } = require("./auth");

const CODE_TTL_MS = 30 * 60 * 1000;
const CONFIG_TTL_MS = 60 * 1000;
// icon_color must be one of Telegram's six topic colours.
const TOPICS = [
  { key: "bot", name: "🧮 Hisobchi", color: 0x6fb9f0, intro: "Shu yerda savol bering yoki buyruq yozing: «Bizdan qancha qarzdorlik bor?», «Paket 45 narxini PDF qil», «VP-125 ni Tayyor qil». Tasdiqlash tugmalari ham shu yerda chiqadi." },
  { key: "it", name: "🤖 IT", color: 0x8eee98, intro: "Har kuni 08:00 da: sayt, server, deploy, testlar va xatolar holati." },
  { key: "sales", name: "💼 Sotuv", color: 0xffd67e, intro: "Har kuni 08:00 da: javobsiz lidlar, qayta qo'ng'iroq qilinmagan raqamlar, konversiya." },
  { key: "fin", name: "💰 Moliya", color: 0xcb86db, intro: "Har kuni 08:00 da: tushum, xarajat, qarzdorlar, to'lanmagan buyurtmalar." },
  { key: "prod", name: "🏭 Ishlab chiqarish", color: 0xfb6f5f, intro: "Har kuni 08:00 da: kechikayotgan va bugun topshiriladigan buyurtmalar." },
  { key: "wh", name: "📦 Ombor / Ta'minot", color: 0x8eee98, intro: "Har kuni 08:00 da: tugayotgan materiallar, kirim-chiqim." },
  { key: "hr", name: "🧑‍💼 HR / Davomat", color: 0xff93b2, intro: "Davomat: ishga kelish/ketish rasmlari, 09:05 eslatmalari, kech qolganlar." },
  { key: "ig", name: "📸 Instagram Direct", color: 0xff93b2, intro: "Instagram Direct va izohlar: yangi murojaatlar, raqam qoldirganlar (Sotuv bo'limiga lid bo'lib tushadi)." },
];

const create = (db, { fallbackChatId }) => {
  let cached = null;
  let cachedAt = 0;
  let botId = null;

  const config = async () => {
    if (cached && Date.now() - cachedAt < CONFIG_TTL_MS) return cached;
    const snap = await db.collection("telegram_config").doc("main").get();
    cached = snap.exists ? snap.data() : {};
    cachedAt = Date.now();
    return cached;
  };

  // Where an agent's message goes: its topic in the work group, or the
  // old channel until a group is linked.
  const route = async (agent) => {
    const c = await config();
    if (c.group_chat_id) {
      const thread = c.topics && c.topics[agent];
      return { chat_id: c.group_chat_id, ...(thread ? { message_thread_id: thread } : {}) };
    }
    return { chat_id: fallbackChatId };
  };

  const isWorkChat = async (chatId) => {
    const c = await config();
    return String(chatId) === String(fallbackChatId) || (c.group_chat_id && String(chatId) === String(c.group_chat_id));
  };

  const isGroup = async (chatId) => {
    const c = await config();
    return Boolean(c.group_chat_id && String(chatId) === String(c.group_chat_id));
  };

  const botTopic = async () => (await config()).topics?.bot || null;

  const register = (app) => {
    app.post("/webhooks/tg-group/code", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin") return res.status(403).json({ error: "Faqat admin" });
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      await db.collection("tg_group_codes").doc(code).set({ email: who.email, created_at: new Date().toISOString() });
      const me = await telegram("getMe", {});
      res.json({ command: `/ulash ${code}`, bot: me?.result?.username || "", expires_minutes: CODE_TTL_MS / 60000 });
    });
  };

  // A linked group gets topics added later (a new agent) without having
  // to /ulash again — runs on start, quietly skips if the bot can't.
  const ensureTopics = async () => {
    const c = await config();
    if (!c.group_chat_id) return;
    const topics = { ...(c.topics || {}) };
    const created = [];
    for (const t of TOPICS) {
      if (topics[t.key]) continue;
      const r = await telegram("createForumTopic", { chat_id: c.group_chat_id, name: t.name, icon_color: t.color });
      if (!r.ok) return;
      topics[t.key] = r.result.message_thread_id;
      created.push(t);
    }
    if (!created.length) return;
    await db.collection("telegram_config").doc("main").set({ topics }, { merge: true });
    cached = null;
    for (const t of created) {
      await telegram("sendMessage", { chat_id: c.group_chat_id, message_thread_id: topics[t.key], text: `${t.name}\n${t.intro}` });
    }
    console.log(`Telegram work group: added topics ${created.map((t) => t.key).join(",")}`);
  };

  const reply = (msg, text) =>
    telegram("sendMessage", {
      chat_id: msg.chat.id,
      text,
      ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });

  // "/ulash CODE" (or "/ulash@bot CODE") posted in a group.
  const handleLinkCommand = async (msg) => {
    const m = /^\/ulash(?:@\w+)?\s+([A-F0-9]{8})\s*$/i.exec((msg.text || "").trim());
    if (!m) return false;
    const code = m[1].toUpperCase();
    const ref = db.collection("tg_group_codes").doc(code);
    const link = (await ref.get()).data();
    if (!link || Date.now() - Date.parse(link.created_at) > CODE_TTL_MS) {
      await reply(msg, "❌ Kod noto'g'ri yoki eskirgan. Saytdan (Sozlamalar → Telegram guruh) yangi kod oling.");
      return true;
    }
    if (!msg.chat.is_forum) {
      await reply(msg, "⚠️ Guruhda «Mavzular» (Topics) yoqilmagan. Guruh sozlamalari → Mavzular ni yoqing va /ulash ni qayta yuboring.");
      return true;
    }
    if (!botId) botId = (await telegram("getMe", {}))?.result?.id;
    const member = (await telegram("getChatMember", { chat_id: msg.chat.id, user_id: botId }))?.result || {};
    if (member.status !== "administrator" || !member.can_manage_topics) {
      await reply(msg, "⚠️ Botni guruhda admin qiling va «Mavzularni boshqarish» (Manage topics) huquqini bering, keyin /ulash ni qayta yuboring.");
      return true;
    }
    await ref.delete();

    // Re-linking the same group keeps existing topics and adds missing ones.
    const prev = (await config()) || {};
    const topics = String(prev.group_chat_id) === String(msg.chat.id) ? { ...(prev.topics || {}) } : {};
    const created = [];
    for (const t of TOPICS) {
      if (topics[t.key]) continue;
      const r = await telegram("createForumTopic", { chat_id: msg.chat.id, name: t.name, icon_color: t.color });
      if (r.ok) {
        topics[t.key] = r.result.message_thread_id;
        created.push(t);
      }
    }
    await db.collection("telegram_config").doc("main").set({
      group_chat_id: msg.chat.id,
      group_title: msg.chat.title || "",
      topics,
      linked_at: new Date().toISOString(),
      linked_by: link.email,
    });
    cached = null;
    for (const t of created) {
      await telegram("sendMessage", { chat_id: msg.chat.id, message_thread_id: topics[t.key], text: `${t.name}\n${t.intro}` });
    }
    await reply(msg, `✅ Guruh ulandi. ${created.length ? `${created.length} ta mavzu ochildi` : "Mavzular joyida"} — endi har bir agent o'z mavzusiga yozadi.`);
    console.log(`Telegram work group linked: ${msg.chat.id} (${msg.chat.title}) by ${link.email}`);
    return true;
  };

  return { route, isWorkChat, isGroup, botTopic, register, handleLinkCommand, ensureTopics, config, TOPICS };
};

module.exports = { create, TOPICS };
