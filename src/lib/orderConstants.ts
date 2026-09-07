import type { LeadStatus, OrderStatus } from "./types";

export const PRODUCT_CATEGORIES = [
  "Tipografiya",
  "Poligrafiya",
  "Gift Box",
  "Textil",
  "Suvenir",
  "Tashqi reklama",
  "Dizayn xizmati",
  "Boshqa",
] as const;

export const CATEGORY_PRODUCTS: Record<string, string[]> = {
  Poligrafiya: [
    "Paket",
    "Blaknot",
    "Ruchka",
    "Vizitka",
    "Flayer",
    "Papka",
    "Katalog",
    "Buklet",
  ],
  "Gift Box": ["Sovg'a qutisi", "Set quti", "Brend quti", "Premium quti"],
  Textil: ["Futbolka", "Polo", "Kepka", "Xudi", "Svitshot", "Jilet", "Forma"],
  Suvenir: ["Bakal", "Termos", "Brelok", "Soat", "Stol bayrog'i"],
  "Tashqi reklama": [
    "Banner",
    "Roll-up",
    "Stend",
    "Peshlavha",
    "Hajmli harf",
    "Bayroq",
  ],
  Tipografiya: [
    "Konvert",
    "Blank",
    "Yorliq",
    "Kartochka",
    "Muqova",
  ],
  "Dizayn xizmati": ["Logo", "Fluer dizayn", "Katalog dizayn", "Banner dizayn"],
  Boshqa: [],
};

export const PRODUCTION_COMPANIES = [
  { key: "Vodiy Print", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "Alpha Print", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { key: "Kans Print", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "Prime Press", color: "bg-slate-200 text-slate-800 border-slate-300" },
  { key: "Boshqa", color: "bg-ink-100 text-ink-700 border-ink-200" },
] as const;

export const productionCompanyBadge = (name: string): string => {
  const found = PRODUCTION_COMPANIES.find((p) => p.key === name);
  return found?.color || "bg-ink-100 text-ink-700 border-ink-200";
};

export const CUSTOMER_SOURCES = [
  "Instagram",
  "Telegram",
  "Tavsiya",
  "Eski mijoz",
  "Tashqi reklama",
  "Google",
  "Sayt",
  "Sovuq qo'ng'iroq",
  "Ko'rgazma yoki tadbir",
  "Menejer topgan",
  "Boshqa",
] as const;

export const DESIGNER_STATUSES = [
  "Dizayn kerak emas",
  "Dizaynerga yuborildi",
  "Ishlanmoqda",
  "Mijozga yuborildi",
  "Tuzatish kiritilmoqda",
  "Tasdiqlandi",
] as const;

export const DELIVERY_TYPES = [
  "Ofisdan olib ketadi",
  "Vodiy Print yetkazadi",
  "Yandex orqali",
  "Pochta orqali",
  "Boshqa",
] as const;

export const PAYMENT_TYPES = [
  "Naqd",
  "Karta",
  "Hisob raqam",
  "Click",
  "Payme",
  "Aralash to'lov",
  "To'lov qilinmagan",
] as const;

export const FILE_LINK_TYPES = [
  "Telegram",
  "Rasm",
  "PDF",
  "Arxiv",
  "Dizayn",
  "Boshqa",
] as const;

// The subset of OrderStatus that a production line item (order_product)
// actually cycles through — the rest (delivered/closed/cancelled etc.) only
// ever apply to the order as a whole, never to an individual line.
export const PRODUCTION_LINE_STATUSES: OrderStatus[] = [
  "new",
  "accepted",
  "production",
  "quality_control",
  "ready",
];

// An order in one of these states is done, one way or another — its
// products have no business sitting in an active production queue
// (Ishlab chiqarish / Pechatnik) waiting to be assigned or worked on.
export const ORDER_CLOSED_STATUSES: OrderStatus[] = ["delivered", "closed", "cancelled"];

export const ORDER_STATUSES: { key: OrderStatus; label: string; cls: string }[] = [
  { key: "new", label: "Yangi", cls: "bg-sky-100 text-sky-700" },
  {
    key: "accepted",
    label: "Qabul qilindi",
    cls: "bg-indigo-100 text-indigo-700",
  },
  {
    key: "calculating",
    label: "Hisob-kitob qilinmoqda",
    cls: "bg-slate-100 text-slate-700",
  },
  {
    key: "awaiting_advance",
    label: "Avans kutilmoqda",
    cls: "bg-amber-100 text-amber-800",
  },
  { key: "design", label: "Dizaynda", cls: "bg-slate-100 text-slate-700" },
  {
    key: "approving",
    label: "Tasdiqlanmoqda",
    cls: "bg-slate-100 text-slate-700",
  },
  {
    key: "sent_to_production",
    label: "Ishlab chiqarishga yuborildi",
    cls: "bg-brand-100 text-brand-700",
  },
  {
    key: "production",
    label: "Ishlab chiqarishda",
    cls: "bg-slate-200 text-slate-800",
  },
  {
    key: "quality_control",
    label: "Sifat nazoratida",
    cls: "bg-amber-100 text-amber-800",
  },
  { key: "ready", label: "Tayyor", cls: "bg-emerald-100 text-emerald-700" },
  {
    key: "ready_to_deliver",
    label: "Yetkazishga tayyor",
    cls: "bg-emerald-100 text-emerald-800",
  },
  {
    key: "delivered",
    label: "Yetkazildi",
    cls: "bg-emerald-100 text-emerald-800",
  },
  { key: "closed", label: "Yopildi", cls: "bg-ink-200 text-ink-800" },
  { key: "cancelled", label: "Bekor qilindi", cls: "bg-rose-100 text-rose-700" },
];

export const orderStatusLabel = (s: OrderStatus): string =>
  ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;

export const orderStatusClass = (s: OrderStatus): string =>
  ORDER_STATUSES.find((x) => x.key === s)?.cls ?? "bg-ink-100 text-ink-700";

// A simplified 4-milestone view over the 14 real statuses, for the
// "Buyurtma jarayoni" stepper — staff still change the precise status via
// the full ORDER_STATUSES select, this is just the at-a-glance summary.
// "cancelled" deliberately has no group; callers should show it separately.
export const ORDER_STAGE_GROUPS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  {
    key: "new",
    label: "Yangi",
    statuses: ["new", "accepted", "calculating", "awaiting_advance", "design", "approving"],
  },
  {
    key: "production",
    label: "Ishlab chiqarilmoqda",
    statuses: ["sent_to_production", "production", "quality_control"],
  },
  { key: "ready", label: "Tayyor", statuses: ["ready", "ready_to_deliver"] },
  { key: "delivered", label: "Yetkazildi", statuses: ["delivered", "closed"] },
];

export const orderStageIndex = (s: OrderStatus): number =>
  ORDER_STAGE_GROUPS.findIndex((g) => g.statuses.includes(s));

export const CUSTOMER_TYPES = [
  { key: "new", label: "Yangi mijoz", cls: "bg-sky-100 text-sky-700" },
  { key: "regular", label: "Doimiy mijoz", cls: "bg-emerald-100 text-emerald-700" },
  { key: "vip", label: "VIP mijoz", cls: "bg-amber-100 text-amber-800" },
  { key: "inactive", label: "Faol emas", cls: "bg-ink-200 text-ink-700" },
] as const;

export const customerTypeInfo = (t: string) =>
  CUSTOMER_TYPES.find((x) => x.key === t) || CUSTOMER_TYPES[0];

export const INDUSTRIES = [
  "Qurilish",
  "Ta'lim",
  "Ishlab chiqarish",
  "Chevarlik",
  "Ko'chmas mulk",
  "Diller",
  "Savdo",
  "Restoran/Kafe",
  "Sog'liqni saqlash",
  "IT/Texnologiya",
  "Moliya/Bank",
  "Avtomobil",
  "Go'zallik saloni",
  "Boshqa",
] as const;

export const EXPENSE_CATEGORIES = [
  "Ijara",
  "Maosh",
  "Xomashyo",
  "Transport",
  "Kommunal",
  "Soliq",
  "Reklama",
  "Boshqa",
] as const;

export const TEXTILE_SIZES = [
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
] as const;

export const TEXTILE_COLORS = [
  "Oq",
  "Qora",
  "Kulrang",
  "Ko'k",
  "To'q ko'k",
  "Qizil",
  "Yashil",
  "Sariq",
  "Binafsha",
  "Pushti",
  "Jigarrang",
  "To'q sariq",
  "Boshqa",
] as const;

// Every column the Kanban board can render. The first five are real,
// stored Lead.status values a person picks from a dropdown. The middle
// four (design/production/ready/delivered) are never stored on the lead
// itself — once a lead is converted (status "awaiting_advance") it has a
// real linked Order, and those columns are computed live from that
// Order's own status via orderStatusToLeadBucket below. "cancelled"
// mirrors an Order that got cancelled after conversion.
export type LeadColumnKey = LeadStatus | "design" | "production" | "ready" | "delivered" | "cancelled";

export const LEAD_STATUSES: { key: LeadColumnKey; label: string; cls: string; dot: string }[] = [
  { key: "new", label: "Yangi lid", cls: "bg-brand-100 text-brand-700", dot: "#0062db" },
  { key: "contacted", label: "Bog'lanildi", cls: "bg-violet-100 text-violet-700", dot: "#7c3aed" },
  { key: "telegram", label: "Telegramga o'tdi", cls: "bg-cyan-100 text-cyan-800", dot: "#0891b2" },
  { key: "awaiting_advance", label: "Avans kutilmoqda", cls: "bg-amber-100 text-amber-800", dot: "#b45309" },
  { key: "design", label: "Dizayn", cls: "bg-indigo-100 text-indigo-700", dot: "#4f46e5" },
  { key: "production", label: "Ishlab chiqarilmoqda", cls: "bg-slate-200 text-slate-800", dot: "#475569" },
  { key: "ready", label: "Tayyor", cls: "bg-emerald-100 text-emerald-700", dot: "#059669" },
  { key: "delivered", label: "Yetkazildi", cls: "bg-emerald-100 text-emerald-800", dot: "#047857" },
  { key: "cancelled", label: "Bekor qilindi", cls: "bg-ink-200 text-ink-700", dot: "#64748b" },
  { key: "lost", label: "Rad etildi", cls: "bg-rose-100 text-rose-700", dot: "#e11d48" },
];

// The stages a person can pick directly from a lead's status dropdown —
// only what's still under manual control. Picking "awaiting_advance"
// converts the lead (Customer + draft Order created); the four
// production-line columns after it are read-only, driven by the Order.
export const LEAD_STATUS_OPTIONS: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Yangi lid" },
  { key: "contacted", label: "Bog'lanildi" },
  { key: "telegram", label: "Telegramga o'tdi" },
  { key: "awaiting_advance", label: "Avans kutilmoqda" },
  { key: "lost", label: "Rad etildi" },
];

export const leadStatusInfo = (s: LeadColumnKey) =>
  LEAD_STATUSES.find((x) => x.key === s) || LEAD_STATUSES[0];

// Maps a converted lead's linked Order status onto one of the four
// post-conversion Kanban columns, so the lead card's position always
// reflects the Order's real, current state.
export const orderStatusToLeadBucket = (
  s: OrderStatus,
): "awaiting_advance" | "design" | "production" | "ready" | "delivered" | "cancelled" => {
  if (s === "cancelled") return "cancelled";
  if (s === "design" || s === "approving") return "design";
  if (s === "sent_to_production" || s === "production" || s === "quality_control") return "production";
  if (s === "ready" || s === "ready_to_deliver") return "ready";
  if (s === "delivered" || s === "closed") return "delivered";
  return "awaiting_advance"; // new / accepted / calculating / awaiting_advance
};

export const WAREHOUSE_CATEGORIES = [
  "Xomashyo",
  "Suvenir",
  "Gift Box",
  "Aksessuar",
  "Textil",
  "Boshqa",
] as const;

export const UZBEKISTAN_REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon",
  "Buxoro",
  "Farg'ona",
  "Jizzax",
  "Xorazm",
  "Namangan",
  "Navoiy",
  "Qashqadaryo",
  "Qoraqalpog'iston Respublikasi",
  "Samarqand",
  "Sirdaryo",
  "Surxondaryo",
] as const;
