// Instagram Direct agent: answers people who write to the business
// account's Direct (or comment under a post) with a short greeting asking
// for their name and phone, and once a phone number arrives turns the
// conversation into a lead in Sotuv bo'limi and tells the managers in the
// Telegram work group ("📸 Instagram" topic).
//
// It never chats on its own beyond that: at most greeting → one reminder
// → thank-you per person, and it steps back for good as soon as a manager
// answers from Instagram themselves.
//
// Webhooks arrive on the same Meta callback as Lead Ads (server.js hands
// over every body whose object is "instagram"); replies go through the
// Messenger Platform Send API with the same Page access token.
//
// Config: instagram_config/main { enabled, reply_comments, texts: {...} }
// (Sozlamalar → Instagram). Conversations: ig_conversations/{igsid}.
const { telegram } = require("./telegram");
const { staffFromRequest } = require("./auth");
const { emitEvent, clip } = require("./shared");
const { findByPhone, createLead } = require("./leads");

const DEFAULT_TEXTS = {
  greeting:
    "Assalomu alaykum! 😊 Vodiy Print mahsulotlariga qiziqish bildirganingiz uchun rahmat. Ismingiz va telefon raqamingizni qoldirsangiz, menejerlarimiz ish vaqtida siz bilan bog'lanishadi.",
  comment:
    "Assalomu alaykum! 😊 Postimizga izoh qoldirganingiz uchun rahmat. Ismingiz va telefon raqamingizni shu yerga yozib qoldirsangiz, menejerlarimiz ish vaqtida siz bilan bog'lanishadi.",
  nudge: "Iltimos, ismingiz va telefon raqamingizni yozib qoldiring (masalan: Aziz, 90 123 45 67) — menejerimiz siz bilan bog'lanadi.",
  thanks: "Rahmat, {ism}! ✅ Ma'lumotlaringiz qabul qilindi. Menejerlarimiz ish vaqtida {telefon} raqamiga bog'lanishadi.",
};
const REQUIRED_SCOPES = ["instagram_basic", "instagram_manage_messages", "pages_manage_metadata"];
const COMMENT_SCOPE = "instagram_manage_comments";
const CONFIG_TTL_MS = 60 * 1000;
// A person who comes back after this long is greeted again as new.
const FRESH_AFTER_MS = 30 * 24 * 3600 * 1000;
// Meta retries undelivered webhooks; never answer a message this old
// (the 24-hour reply window would reject it anyway).
const MAX_AGE_MS = 20 * 3600 * 1000;
const LEADS_URL = "https://printvodiy.uz/leads";

// ── Contact parsing ──────────────────────────────────────────────────
// "+998 90 123-45-67", "90 1234567", "(90) 123 45 67", "998901234567"…
const PHONE_RE = /(?<!\d)(?:\+?\s*998[\s\-().]*)?\(?(\d{2})\)?[\s\-.]*(\d{3})[\s\-.]*(\d{2})[\s\-.]*(\d{2})(?!\d)/;
// Words people wrap their details in ("Ismim Aziz, raqamim 90…" → "Aziz")
// and everyday enquiry words, so "narxi qancha" or "vizitka kerak edi" is
// never mistaken for a name.
const FILLER = new Set("izoh ism ismim ismi mening meni men man mana bu shu menga имя меня зовут мое моё мой".split(" "));
const NOT_NAME = new Set(
  (
    "raqam raqamim raqami nomer nomerim nomeri tel telefon telefonim iltimos salom assalomu assalom alaykum va bilan ga " +
    "qongiroq qiling qilinglar qilib yozing aloqa aloqaga bizga sizga siz biz ham emas yana ertaga bugun hozir qachon " +
    "narx narxi narxlar qancha necha nechpul bormi bor kerak kerakmi kerakli edi edim qanday qayerda manzil manzilingiz " +
    "rahmat ok okey ha yoq xop olmoqchiman olmoqchimiz qilmoqchiman bering yuboring uchun haqida malumot batafsil koproq tayyor " +
    "zakaz buyurtma paket paketlar vizitka katalog pechat dona sum som mahsulot mahsulotlar firma kompaniya mchj ooo " +
    "номер телефон тел звоните привет здравствуйте спасибо цена сколько нужно"
  ).split(" "),
);
const cleanWord = (w) => w.toLowerCase().replace(/[ʻʼ'`‘’]/g, "");

// `strict` (a message without a phone number): the whole message must be
// just a name. Otherwise the words left around the number are the name.
const nameFrom = (text, strict = true) => {
  if (!text || /[?@#/]|https?:/.test(text)) return "";
  const words = text
    .replace(/[^\p{L}ʻʼ'`‘’\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER.has(cleanWord(w)));
  if (strict && words.some((w) => NOT_NAME.has(cleanWord(w)))) return "";
  const kept = words.filter((w) => !NOT_NAME.has(cleanWord(w)));
  if (!kept.length || kept.length > 3 || kept.some((w) => w.length < 2 || w.length > 20)) return "";
  return kept.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
};

const parseContact = (text) => {
  const t = String(text || "");
  const m = PHONE_RE.exec(t);
  if (!m) return { phone: "", name: "" };
  return { phone: `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`, name: nameFrom(t.replace(m[0], " "), false) };
};

const render = (template, { name, phone }) =>
  (name ? template.replace(/\{ism\}/g, name) : template.replace(/[,\s]*\{ism\}/g, "")).replace(/\{telefon\}/g, phone || "");

// ── Agent ────────────────────────────────────────────────────────────
const create = (db, { graphVersion, pageToken, appSecret, verifyToken, callbackBase, route }) => {
  let cached = null;
  let cachedAt = 0;
  const sentMids = new Set(); // our own replies, to tell them apart from a manager's
  const seen = new Set(); // webhook retries
  const chains = new Map(); // one person's messages are handled in order
  let selfUsername = ""; // our own account, so its comments are skipped

  const remember = (set, id) => {
    set.add(id);
    if (set.size > 5000) set.delete(set.values().next().value);
  };

  const config = async () => {
    if (cached && Date.now() - cachedAt < CONFIG_TTL_MS) return cached;
    const snap = await db.collection("instagram_config").doc("main").get().catch(() => null);
    const c = (snap && snap.exists && snap.data()) || {};
    const texts = {};
    for (const k of Object.keys(DEFAULT_TEXTS)) texts[k] = (c.texts && String(c.texts[k] || "").trim()) || DEFAULT_TEXTS[k];
    cached = { enabled: c.enabled !== false, reply_comments: c.reply_comments !== false, texts };
    cachedAt = Date.now();
    return cached;
  };

  const graph = async (method, path, params = {}, token = pageToken) => {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${path}`);
    let body;
    if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    else body = JSON.stringify(params);
    url.searchParams.set("access_token", token);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (data.error) {
      const err = new Error(data.error.message || "Graph API xatosi");
      err.graph = data.error;
      throw err;
    }
    return data;
  };

  const notify = async (text) => {
    if (!route) return;
    try {
      await telegram("sendMessage", { ...(await route("ig")), text, link_preview_options: { is_disabled: true } });
    } catch (err) {
      console.error("Instagram → Telegram notify failed", err.message);
    }
  };

  const convoRef = (igsid) => db.collection("ig_conversations").doc(String(igsid));

  const send = async (recipient, text) => {
    const r = await graph("POST", "me/messages", { recipient, messaging_type: "RESPONSE", message: { text } });
    if (r.message_id) remember(sentMids, r.message_id);
    return r;
  };

  const profileOf = async (igsid) => {
    try {
      const p = await graph("GET", String(igsid), { fields: "name,username" });
      return { name: p.name || "", username: p.username || "" };
    } catch {
      return { name: "", username: "" };
    }
  };

  const who = (c) => (c.username ? `@${c.username}` : c.name || "Instagram foydalanuvchisi");

  // A phone number arrived: make (or touch) the lead and say thank you.
  // `silent`: a manager is already chatting — record the lead, don't reply.
  const capture = async (igsid, convo, phone, name, cfg, silent = false) => {
    const now = new Date().toISOString();
    const display = name || convo.name || (convo.username ? `@${convo.username}` : "Instagram mijoz");
    const source = convo.via === "comment" ? "Instagram izoh" : "Instagram Direct";
    const history = (convo.texts || []).map((t) => `— ${t}`).join("\n");
    let lead = await findByPhone(db, "leads", phone);
    let isNew = false;
    if (lead) {
      await db.collection("lead_activities").add({
        lead_id: lead.id,
        text: `📸 ${source} orqali yana yozdi (${who(convo)})${history ? `:\n${history}` : ""}`,
        actor_email: "system",
        actor_name: "Instagram agent",
        created_at: now,
      });
      await db.collection("leads").doc(lead.id).update({ updated_at: now });
    } else {
      const customer = await findByPhone(db, "customers", phone);
      lead = await createLead(db, {
        full_name: display,
        phone,
        source,
        note: [
          `Instagram: ${who(convo)}`,
          customer ? `Mijozlar bazasida bor: ${customer.company || [customer.first_name, customer.last_name].filter(Boolean).join(" ")}` : "",
          history ? `Yozganlari:\n${history}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        instagram_username: convo.username || "",
        instagram_id: String(igsid),
      });
      isNew = true;
      await db.collection("lead_activities").add({
        lead_id: lead.id,
        text: `📸 ${source} orqali murojaat — Instagram agent lid yaratdi`,
        actor_email: "system",
        actor_name: "Instagram agent",
        created_at: now,
      });
    }

    const reply = render(cfg.texts.thanks, { name: name || convo.name || "", phone });
    if (!silent) await send({ id: igsid }, reply);
    await convoRef(igsid).set(
      {
        state: silent ? "human" : "done",
        lead_id: lead.id,
        lead_number: lead.lead_number || "",
        phone,
        name: name || convo.name || "",
        ...(silent ? {} : { last_bot_text: reply }),
        updated_at: now,
      },
      { merge: true },
    );
    await notify(
      [
        isNew ? `✅ Yangi lid ${lead.lead_number} — ${source}` : `🔁 ${source}: mavjud lid ${lead.lead_number || ""} qayta yozdi`,
        `👤 ${display}${convo.username ? ` (@${convo.username})` : ""}`,
        `📞 ${phone}`,
        history ? `💬 ${clip(history.replace(/\n/g, " "), 300)}` : "",
        LEADS_URL,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    await emitEvent(db, {
      agent: "ig",
      kind: "report",
      text: `${isNew ? "Yangi lid" : "Qayta murojaat"}: ${display}, ${phone}`,
      bubble: isNew ? `Yangi lid: ${clip(display, 24)} 📞` : "Mavjud mijoz yozdi",
      visit: isNew ? "sales" : null,
      source: "instagram",
    });
    console.log(`Instagram lead ${isNew ? "created" : "touched"}: ${lead.lead_number || lead.id} (${who(convo)}, ${phone})`);
  };

  const onDirect = async (igsid, text) => {
    const cfg = await config();
    const now = new Date().toISOString();
    const snap = await convoRef(igsid).get();
    let convo = snap.exists ? snap.data() : null;
    const fresh = !convo || Date.now() - Date.parse(convo.last_in_at || convo.updated_at || 0) > FRESH_AFTER_MS;
    const texts = [...(fresh ? [] : convo.texts || []), clip(text || "(rasm/fayl)", 300)].slice(-6);

    if (fresh) {
      const profile = convo && convo.username ? { name: convo.name_profile || "", username: convo.username } : await profileOf(igsid);
      convo = {
        igsid: String(igsid),
        username: profile.username,
        name_profile: profile.name,
        name: "",
        via: "direct",
        state: "new",
        nudges: 0,
        created_at: now,
      };
    }
    // Only a comment reply that we just started counts as the same thread.
    if (!fresh && convo.state === "commented") convo.state = "asked";
    await convoRef(igsid).set({ ...convo, texts, last_in_at: now, updated_at: now }, { merge: true });
    convo.texts = texts;

    const found = parseContact(text);
    // Name from the same message, else from an earlier short one.
    const nameNow = () => found.name || [...texts].slice(0, -1).reverse().map((t) => nameFrom(t)).find(Boolean) || "";
    if (convo.state === "human") {
      // A manager is talking to them: no replies, but a phone they leave
      // still becomes a lead so it isn't lost in the chat.
      if (found.phone && !convo.lead_id) return capture(igsid, convo, found.phone, nameNow(), cfg, true);
      return;
    }
    if (convo.state === "done") {
      await notify(`💬 ${who(convo)} (${convo.lead_number || "lid"}) yana yozdi:\n${clip(text || "(rasm/fayl)", 500)}\n\nJavobni Instagram'dan yozing.`);
      return;
    }
    if (!cfg.enabled) return;

    if (found.phone) return capture(igsid, convo, found.phone, nameNow(), cfg);
    const name = nameFrom(text);
    if (name && !convo.name) await convoRef(igsid).set({ name }, { merge: true });

    if (convo.state === "new") {
      await send({ id: igsid }, cfg.texts.greeting);
      await convoRef(igsid).set({ state: "asked", last_bot_text: cfg.texts.greeting }, { merge: true });
      await notify(`📩 Direct'ga yangi murojaat — ${who(convo)}:\n${clip(text || "(rasm/fayl)", 500)}\n\nAgent ism va raqam so'radi.`);
      await emitEvent(db, { agent: "ig", kind: "report", text: `Direct: ${who(convo)} — ${clip(text || "(rasm/fayl)", 120)}`, bubble: clip(text || "📷", 60), source: "instagram" });
      return;
    }
    if ((convo.nudges || 0) < 1) {
      await send({ id: igsid }, cfg.texts.nudge);
      await convoRef(igsid).set({ nudges: (convo.nudges || 0) + 1, last_bot_text: cfg.texts.nudge }, { merge: true });
      return;
    }
    // Asked twice already — stay quiet, but let the managers see it.
    await notify(`💬 ${who(convo)} raqam qoldirmadi, lekin yozdi:\n${clip(text || "(rasm/fayl)", 500)}\n\nJavobni Instagram'dan yozing.`);
  };

  // A manager wrote from Instagram (an echo we didn't send): step back.
  const onEcho = async (igsid, mid, text) => {
    if (sentMids.has(mid)) return;
    const ref = convoRef(igsid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const c = snap.data();
    if (c.state === "human" || (text && text === c.last_bot_text)) return;
    await ref.set({ state: "human", human_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { merge: true });
  };

  const onComment = async (igId, v) => {
    const cfg = await config();
    if (!cfg.enabled || !cfg.reply_comments) return;
    const from = v.from || {};
    if (!v.id || !from.id || String(from.id) === String(igId)) return;
    if (selfUsername && from.username === selfUsername) return;
    const existing = await convoRef(from.id).get();
    if (existing.exists && Date.now() - Date.parse(existing.data().updated_at || 0) < FRESH_AFTER_MS) return;
    let r;
    try {
      r = await send({ comment_id: v.id }, cfg.texts.comment);
    } catch (err) {
      console.error("Instagram private reply failed", err.message);
      return;
    }
    const igsid = String(r.recipient_id || from.id);
    const now = new Date().toISOString();
    await convoRef(igsid).set({
      igsid,
      username: from.username || "",
      name_profile: "",
      name: "",
      via: "comment",
      state: "commented",
      nudges: 0,
      texts: [clip(`(izoh) ${v.text || ""}`, 300)],
      comment_id: v.id,
      media_id: (v.media && v.media.id) || "",
      last_bot_text: cfg.texts.comment,
      created_at: now,
      last_in_at: now,
      updated_at: now,
    });
    await notify(`💬 ${from.username ? `@${from.username}` : "Kimdir"} post ostida izoh qoldirdi:\n«${clip(v.text, 300)}»\n\nAgent unga Direct'dan yozdi.`);
    await emitEvent(db, { agent: "ig", kind: "report", text: `Izoh: ${from.username ? `@${from.username}` : ""} — ${clip(v.text, 120)}`, bubble: clip(v.text || "💬", 60), source: "instagram" });
  };

  const queue = (key, fn) => {
    const prev = chains.get(key) || Promise.resolve();
    const next = prev.then(fn).catch((err) => console.error("Instagram agent error", err.graph || err.message));
    chains.set(key, next);
    next.finally(() => chains.get(key) === next && chains.delete(key));
    return next;
  };

  // Called by server.js for a signed webhook body with object "instagram".
  const handleWebhook = (body) => {
    for (const entry of body.entry || []) {
      const igId = entry.id;
      for (const ev of entry.messaging || []) {
        const m = ev.message;
        if (!m || !m.mid || seen.has(m.mid)) continue;
        remember(seen, m.mid);
        if (m.is_deleted || m.is_unsupported) continue;
        if (m.is_echo) {
          const igsid = ev.recipient && ev.recipient.id;
          if (igsid) queue(igsid, () => onEcho(igsid, m.mid, m.text || ""));
          continue;
        }
        const igsid = ev.sender && ev.sender.id;
        if (!igsid || String(igsid) === String(igId)) continue;
        if (ev.timestamp && Date.now() - Number(ev.timestamp) > MAX_AGE_MS) continue;
        // Story mentions and reactions to stories aren't enquiries.
        if (!m.text && (m.attachments || []).every((a) => a.type === "story_mention")) continue;
        queue(igsid, () => onDirect(igsid, (m.text || "").trim()));
      }
      for (const ch of entry.changes || []) {
        if (ch.field !== "comments" || !ch.value) continue;
        const v = ch.value;
        if (seen.has(v.id)) continue;
        remember(seen, v.id);
        queue(v.from && v.from.id ? v.from.id : v.id, () => onComment(igId, v));
      }
    }
  };

  // ── Setup check (Sozlamalar → Instagram) ──────────────────────────
  const status = async () => {
    const out = { ok: false, page: null, instagram: null, app: null, scopes: [], missing: [], comments_scope: false, subscription: null, error: "" };
    if (!pageToken || !appSecret) {
      out.error = "Serverda META_PAGE_ACCESS_TOKEN / META_APP_SECRET yo'q";
      return out;
    }
    try {
      const page = await graph("GET", "me", { fields: "id,name,instagram_business_account{id,username,name}" });
      out.page = { id: page.id, name: page.name };
      if (page.instagram_business_account) out.instagram = page.instagram_business_account;
      const app = await graph("GET", "app", { fields: "id,name" });
      out.app = { id: app.id, name: app.name };
      const appToken = `${app.id}|${appSecret}`;
      const dbg = await graph("GET", "debug_token", { input_token: pageToken }, appToken);
      out.scopes = (dbg.data && dbg.data.scopes) || [];
      out.missing = REQUIRED_SCOPES.filter((s) => !out.scopes.includes(s));
      out.comments_scope = out.scopes.includes(COMMENT_SCOPE);
      const subs = await graph("GET", `${app.id}/subscriptions`, {}, appToken);
      const ig = (subs.data || []).find((s) => s.object === "instagram");
      out.subscription = ig ? { active: ig.active !== false, fields: (ig.fields || []).map((f) => f.name || f) } : null;
    } catch (err) {
      out.error = err.message;
    }
    out.ok = Boolean(
      out.instagram && !out.missing.length && out.subscription && out.subscription.active && out.subscription.fields.includes("messages"),
    );
    return out;
  };

  // Subscribes the app to the instagram webhook (messages + comments) so
  // nobody has to click through the Meta dashboard. Safe on every start.
  const ensureSubscription = async () => {
    if (!pageToken || !appSecret || !verifyToken) return;
    try {
      const app = await graph("GET", "app", { fields: "id" });
      const appToken = `${app.id}|${appSecret}`;
      const subs = await graph("GET", `${app.id}/subscriptions`, {}, appToken);
      const pageSub = (subs.data || []).find((s) => s.object === "page");
      const ig = (subs.data || []).find((s) => s.object === "instagram");
      const have = ig ? (ig.fields || []).map((f) => f.name || f) : [];
      const want = ["messages", "comments"];
      if (ig && ig.active !== false && want.every((f) => have.includes(f))) {
        console.log("Instagram webhook already subscribed:", have.join(","));
        return;
      }
      const callback = (pageSub && pageSub.callback_url) || `${callbackBase}/webhooks/meta-leads`;
      await graph(
        "POST",
        `${app.id}/subscriptions`,
        { object: "instagram", callback_url: callback, fields: [...new Set([...have, ...want])].join(","), verify_token: verifyToken, include_values: true },
        appToken,
      );
      console.log("Instagram webhook subscribed:", callback);
    } catch (err) {
      console.error("Instagram webhook subscribe failed:", err.message);
    }
  };

  const start = async () => {
    await ensureSubscription();
    const s = await status();
    if (s.instagram) selfUsername = s.instagram.username || "";
    if (s.ok) console.log(`Instagram Direct agent ready (@${s.instagram.username})`);
    else
      console.log(
        "Instagram Direct agent not ready:",
        s.error || [!s.instagram && "no Instagram account on the Page", s.missing.length && `missing ${s.missing.join(",")}`, !s.subscription && "no webhook"].filter(Boolean).join("; "),
      );
  };

  const register = (app) => {
    app.get("/webhooks/instagram/status", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin") return res.status(403).json({ error: "Faqat admin" });
      res.json(await status());
    });
    // "Tekshirish" in settings re-runs the subscription before checking.
    app.post("/webhooks/instagram/status", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin") return res.status(403).json({ error: "Faqat admin" });
      await ensureSubscription();
      cached = null;
      res.json(await status());
    });
  };

  return { handleWebhook, register, start, status };
};

module.exports = { create, parseContact, nameFrom, render, DEFAULT_TEXTS };
