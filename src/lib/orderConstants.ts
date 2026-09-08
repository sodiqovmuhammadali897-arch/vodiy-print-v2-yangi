import type { Lead, LeadStatus, LeadTaskType, Order, OrderStatus } from "./types";

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

// Every column the Kanban board can render, in order. "design" through
// "delivered" are never stored on the lead itself once it's converted
// (status "advance") — the lead has a real linked Order at that point,
// and those four columns are computed live from that Order's own status
// via orderStatusToLeadStage below; dragging a card into one of them
// writes the matching status straight onto the Order. "cancelled"
// mirrors an Order that got cancelled after conversion.
export type LeadColumnKey = LeadStatus | "cancelled";

export const LEAD_STATUSES: { key: LeadColumnKey; label: string; cls: string; dot: string; bg: string; text: string }[] = [
  { key: "new", label: "Yangi lid", cls: "bg-sky-100 text-sky-700", dot: "#38bdf8", bg: "#e0f2fe", text: "#0369a1" },
  { key: "info_given", label: "Ma'lumot berildi", cls: "bg-violet-100 text-violet-700", dot: "#a78bfa", bg: "#ede9fe", text: "#6d28d9" },
  { key: "telegram", label: "Telegramga o'tdi", cls: "bg-blue-100 text-blue-700", dot: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8" },
  { key: "advance", label: "Avans", cls: "bg-amber-100 text-amber-800", dot: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  { key: "design", label: "Dizayn", cls: "bg-pink-100 text-pink-700", dot: "#ec4899", bg: "#fce7f3", text: "#be185d" },
  { key: "production", label: "Ishlab chiqarilmoqda", cls: "bg-green-100 text-green-700", dot: "#22c55e", bg: "#dcfce7", text: "#15803d" },
  { key: "ready", label: "Tayyor", cls: "bg-emerald-100 text-emerald-700", dot: "#10b981", bg: "#d1fae5", text: "#047857" },
  { key: "delivered", label: "Topshirildi", cls: "bg-emerald-200 text-emerald-900", dot: "#15803d", bg: "#bbf7d0", text: "#14532d" },
  { key: "cancelled", label: "Bekor qilindi", cls: "bg-ink-200 text-ink-700", dot: "#64748b", bg: "#e2e8f0", text: "#334155" },
  { key: "lost", label: "Yo'qotilgan", cls: "bg-rose-100 text-rose-700", dot: "#f43f5e", bg: "#ffe4e6", text: "#be123c" },
];

// The full pipeline, selectable directly from the lead's own status
// dropdown (an alternative to dragging the Kanban card). Picking
// "advance" converts the lead (Customer + draft Order created) if it
// hasn't been already; picking one of the four production stages
// before that happens is rejected by moveLead with a clear "convert it
// first" error, since there's no Order yet to represent that state.
export const LEAD_STATUS_OPTIONS: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Yangi lid" },
  { key: "info_given", label: "Ma'lumot berildi" },
  { key: "telegram", label: "Telegramga o'tdi" },
  { key: "advance", label: "Avans" },
  { key: "design", label: "Dizayn" },
  { key: "production", label: "Ishlab chiqarilmoqda" },
  { key: "ready", label: "Tayyor" },
  { key: "delivered", label: "Topshirildi" },
  { key: "lost", label: "Yo'qotilgan" },
];

export const leadStatusInfo = (s: LeadColumnKey) =>
  LEAD_STATUSES.find((x) => x.key === s) || LEAD_STATUSES[0];

// Maps a converted lead's linked Order status onto one of the five
// post-conversion Kanban columns, so the lead card's position always
// reflects the Order's real, current state — including finer-grained
// statuses the Production/Pechatnik modules use that the Lead board
// itself never sets directly (approving, quality_control, etc.).
export const orderStatusToLeadStage = (
  s: OrderStatus,
): "advance" | "design" | "production" | "ready" | "delivered" | "cancelled" => {
  if (s === "cancelled") return "cancelled";
  if (s === "design" || s === "approving") return "design";
  if (s === "sent_to_production" || s === "production" || s === "quality_control") return "production";
  if (s === "ready" || s === "ready_to_deliver") return "ready";
  if (s === "delivered" || s === "closed") return "delivered";
  return "advance"; // new / accepted / calculating / awaiting_advance
};

// The Order status written when a converted lead's card is dropped onto
// one of the four production columns — a coarse, sales-side nudge;
// finer-grained transitions (approving, quality_control, ...) stay the
// Production/Pechatnik modules' job.
export const LEAD_STAGE_TO_ORDER_STATUS: Record<"design" | "production" | "ready" | "delivered", OrderStatus> = {
  design: "design",
  production: "production",
  ready: "ready",
  delivered: "delivered",
};

export const LEAD_SOURCES = [
  "Instagram Target",
  "Facebook Lead Ads",
  "Telegram",
  "Sayt",
  "Referral",
  "Qo'lda kiritish",
] as const;

export const LEAD_TASK_TYPES: { key: LeadTaskType; label: string }[] = [
  { key: "call", label: "Qo'ng'iroq qilish" },
  { key: "telegram", label: "Telegramdan yozish" },
  { key: "send_price", label: "Narxni yuborish" },
  { key: "advance_reminder", label: "Avansni eslatish" },
  { key: "design_approval", label: "Dizaynni tasdiqlatish" },
  { key: "follow_up", label: "Qayta aloqa" },
  { key: "ready_notice", label: "Tayyor buyurtma haqida xabar berish" },
  { key: "other", label: "Boshqa vazifa" },
];

export const leadTaskTypeLabel = (t: LeadTaskType): string =>
  LEAD_TASK_TYPES.find((x) => x.key === t)?.label ?? t;

// Where a lead's card actually sits on the Kanban right now — pre-
// conversion stages read straight off the lead, post-conversion stages
// are computed from its linked Order's live status.
export const columnForLead = (lead: Lead, orders: Record<string, Order>): LeadColumnKey => {
  if (lead.status !== "advance") return lead.status;
  const order = lead.converted_order_id ? orders[lead.converted_order_id] : undefined;
  return order ? orderStatusToLeadStage(order.status) : "advance";
};

export const LOST_LEAD_REASONS = [
  "Qimmat",
  "Hozir kerak emas",
  "Tiraj kam",
  "Javob bermadi",
  "Raqobatchini tanladi",
  "Noto'g'ri lid",
  "Boshqa",
] as const;

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
