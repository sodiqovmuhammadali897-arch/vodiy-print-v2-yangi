// Helpers shared by the Hisobchi bot's read tools (assistant.js) and its
// confirm-before-write actions (actions.js).
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent

const VENDOR_EXPENSE_CATEGORY = "Ta'minotchiga to'lov";
// Mirror src/lib/orderConstants.ts.
const EXPENSE_CATEGORIES = ["Ijara", "Maosh", "Xomashyo", VENDOR_EXPENSE_CATEGORY, "Transport", "Kommunal", "Soliq", "Reklama", "Boshqa"];
const PAYMENT_TYPES = ["Naqd", "Karta", "Hisob raqam", "Click", "Payme", "Aralash to'lov"];
const ORDER_STATUS_LABELS = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  calculating: "Hisob-kitob qilinmoqda",
  awaiting_advance: "Avans kutilmoqda",
  design: "Dizaynda",
  approving: "Tasdiqlanmoqda",
  sent_to_production: "Ishlab chiqarishga yuborildi",
  production: "Ishlab chiqarishda",
  quality_control: "Sifat nazoratida",
  ready: "Tayyor",
  ready_to_deliver: "Yetkazishga tayyor",
  delivered: "Yetkazildi",
  closed: "Yopildi",
  cancelled: "Bekor qilindi",
};

const todayCode = () => new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
const dayCodeOf = (v) => (!v ? "" : v.length === 10 ? v : new Date(Date.parse(v) + TZ_OFFSET_MS).toISOString().slice(0, 10));
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s,  ]/g, " ")} so'm`;
const orderDebt = (o) =>
  Number(o.remaining_amount || 0) || Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
const customerName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.phone || "Noma'lum";

// Loose text matching: case, apostrophe variants, and Cyrillic vs Latin
// spelling of the same name ("Тахмина" / "Taxmina") all match.
const CYR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h" };
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const matches = (query, ...fields) => {
  const q = norm(query);
  if (!q) return true;
  const hay = norm(fields.join(" "));
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 5 && fields.join(" ").replace(/\D/g, "").includes(digits)) return true;
  return q.split(" ").every((w) => hay.includes(w));
};

// Per-question Firestore reader: each collection is fetched at most once.
const createReader = (db) => {
  const cache = new Map();
  return (col) => {
    if (!cache.has(col)) cache.set(col, db.collection(col).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return cache.get(col);
  };
};

module.exports = {
  VENDOR_EXPENSE_CATEGORY,
  EXPENSE_CATEGORIES,
  PAYMENT_TYPES,
  ORDER_STATUS_LABELS,
  todayCode,
  dayCodeOf,
  money,
  orderDebt,
  customerName,
  norm,
  matches,
  createReader,
};
