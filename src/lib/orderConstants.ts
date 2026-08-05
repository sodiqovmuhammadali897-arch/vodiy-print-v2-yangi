import type { OrderStatus } from "./types";

export const PRODUCT_CATEGORIES = [
  "Tipografiya",
  "Poligrafiya",
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
