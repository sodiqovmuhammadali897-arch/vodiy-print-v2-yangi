// Kompaniya sayti (website/) → ariza. The site's coupon form posts here:
// name, phone, product, quantity, an optional note and an optional logo or
// layout file. The request is checked (phone, size, a hidden honeypot
// field, a per-address limit), saved in site_leads/{id}, and sent to the
// work group's Sotuv topic (or the old channel) with the file attached.
const crypto = require("crypto");
const { telegram } = require("./telegram");
const push = require("./push");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const MAX_FILE = 8 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 5;
const PRODUCTS = ["Paket", "Futbolka / textil", "Gift box", "Vizitka / poligrafiya", "Banner / roll-up", "Suvenir", "Dizayn", "Boshqa"];
const FILE_TYPES = /^(image\/(png|jpeg|webp|svg\+xml|gif)|application\/pdf|application\/postscript|application\/illustrator|application\/x-coreldraw|application\/octet-stream)$/;

const clean = (v, max) => String(v || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// "+998 90 123-45-67", "90 1234567", "998901234567" → "+998901234567".
const normPhone = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 9) return `+998${d}`;
  if (d.length === 12 && d.startsWith("998")) return `+${d}`;
  return null;
};

// What the form sent → a lead, or { error } in Uzbek for the visitor.
function parseLead(body) {
  const b = body || {};
  if (b.website) return { spam: true }; // honeypot: people never see this field
  const name = clean(b.name, 80);
  const phone = normPhone(b.phone);
  if (!name) return { error: "Ismingizni yozing" };
  if (!phone) return { error: "Telefon raqamini to'liq yozing, masalan +998 90 123 45 67" };
  const product = PRODUCTS.includes(b.product) ? b.product : "Boshqa";
  const qty = clean(b.qty, 40);
  const note = clean(b.note, 600);
  let file = null;
  if (b.file && b.file.data) {
    const type = clean(b.file.type, 60) || "application/octet-stream";
    if (!FILE_TYPES.test(type)) return { error: "Fayl turi qabul qilinmaydi — rasm, PDF yoki AI/CDR yuboring" };
    const buf = Buffer.from(String(b.file.data), "base64");
    if (!buf.length || buf.length > MAX_FILE) return { error: "Fayl 8 MB dan oshmasin" };
    file = { name: clean(b.file.name, 80).replace(/[^\w.\- ]/g, "_") || "logotip", type, buf };
  }
  return { lead: { name, phone, product, qty, note }, file };
}

const leadText = (l, id) =>
  [
    "🌐 Saytdan yangi ariza",
    "",
    `👤 ${l.name}`,
    `📞 ${l.phone}`,
    `📦 ${l.product}${l.qty ? ` · ${l.qty}` : ""}`,
    l.note ? `💬 ${l.note}` : null,
    "",
    `#sayt ${id.slice(0, 6)}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

const create = (db, { route = null } = {}) => {
  const hits = new Map(); // address hash → timestamps

  const limited = (ip) => {
    const key = crypto.createHash("sha1").update(String(ip || "")).digest("hex").slice(0, 16);
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
    list.push(now);
    hits.set(key, list);
    return list.length > PER_WINDOW;
  };

  const sendFile = async (target, file, caption) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(target)) fd.append(k, String(v));
    fd.append("document", new Blob([file.buf], { type: file.type }), file.name);
    fd.append("caption", caption.slice(0, 1000));
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(`sendDocument: ${JSON.stringify(data).slice(0, 200)}`);
  };

  const register = (app) => {
    app.post("/webhooks/site-lead", require("express").json({ limit: "12mb" }), async (req, res) => {
      try {
        if (limited(req.get("X-Real-IP") || req.ip)) return res.status(429).json({ error: "Juda ko'p urinish — birozdan keyin qayta yuboring yoki qo'ng'iroq qiling" });
        const out = parseLead(req.body);
        if (out.spam) return res.json({ ok: true });
        if (out.error) return res.status(400).json({ error: out.error });
        const ref = db.collection("site_leads").doc();
        await ref.set({ ...out.lead, has_file: Boolean(out.file), file_name: out.file ? out.file.name : null, status: "new", created_at: new Date().toISOString() });
        res.json({ ok: true });
        await push.toAdmins("admin", leadText(out.lead, ref.id), "/");
        // Telegram after answering: the visitor doesn't wait on it.
        if (!BOT_TOKEN || !route) return;
        const target = await route("sales");
        const text = leadText(out.lead, ref.id);
        if (out.file) await sendFile(target, out.file, text).catch(async (err) => {
          console.error("Site lead file failed", err.message);
          await telegram("sendMessage", { ...target, text: `${text}\n\n(fayl yuborilmadi)` });
        });
        else await telegram("sendMessage", { ...target, text });
      } catch (err) {
        console.error("Site lead failed", err);
        if (!res.headersSent) res.status(500).json({ error: "Yuborib bo'lmadi — iltimos, qo'ng'iroq qiling: +998 77 200 88 55" });
      }
    });
  };

  return { register };
};

module.exports = { create, parseLead, normPhone, leadText, PRODUCTS };
