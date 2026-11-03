// Mahsulot qo'llanmasi — the new seller's path through the products. The
// numbers come from guide_facts/{family}, written by the server
// (meta-webhook/guideFacts.js). The texts come from the Darslik lessons,
// so there is one place to edit them. The situations and the 5-day path
// are here. Kept free of React so it can be tested.

export type GuideModel = { id: string; name: string; image_url: string; min_qty: number | null; lead_days: number | null; tiers: { min_qty: number; price: number }[] };
export type GuideFacts = {
  id: string;
  key: string;
  title: string;
  lesson: string; // Darslik lesson key
  rank: number;
  orders: number;
  revenue: number;
  buyers: number;
  repeat_buyers: number;
  qty_median: number;
  qty_low: number;
  qty_high: number;
  unit_median: number;
  line_median: number;
  who: { name: string; n: number }[];
  who_unknown: number;
  with: { key: string; title: string; n: number }[];
  specs: { text: string; n: number }[];
  months: Record<string, number>;
  models: GuideModel[];
  price_from: number | null;
  lead_days: { min: number; max: number } | null;
  min_qty: number | null;
  updated_at?: string;
};
export type GuideMeta = {
  id: string;
  since: string;
  total_revenue: number;
  unmatched_revenue: number;
  top10_share: number;
  products_active: number;
  no_image: number;
  no_category: number;
  duplicate_names: string[];
  no_family: string[];
  lines_without_catalog: number;
  lines: number;
  families: string[];
  updated_at?: string;
};

export const TOP = 10;

// Customers come with a situation, not a product name.
export type Situation = { key: string; title: string; why: string; families: string[]; ask: string };
export const SITUATIONS: Situation[] = [
  {
    key: "dokon",
    title: "Do'kon, butik, savdo",
    why: "Har xaridni brendli paketda berish — paketni eng ko'p do'konlar oladi. Har oy kerak bo'ladi: doimiy mijoz.",
    families: ["paket", "vizitka", "stiker", "flayer"],
    ask: "Oyiga taxminan nechta xaridor bo'ladi? Paket hozir qayerdan olinadi?",
  },
  {
    key: "talim",
    title: "Maktab, o'quv markaz",
    why: "Reklama, qabul, bitiruv va ustozlar kuni — flayer, bloknot va gift boxni ko'p oladi.",
    families: ["flayer", "bloknot", "ruchka", "gift-box", "kalendar"],
    ask: "Qabul yoki bitiruv qachon? Nechta o'quvchi yoki xodim bor?",
  },
  {
    key: "korporativ",
    title: "Korporativ sovg'a, bayram",
    why: "Hamkor va xodimlarga — set bo'lib olinadi (paket + bloknot + ruchka + bakal). Yangi yil va Navro'zdan oldin ko'payadi.",
    families: ["gift-box", "bloknot", "bakal", "kalendar", "ruchka"],
    ask: "Kimlarga va nechta? Bir sovg'a uchun byudjet qancha? Qachongacha kerak?",
  },
  {
    key: "forma",
    title: "Xodimlar formasi",
    why: "Restoran, ishlab chiqarish, do'kon xodimlari — futbolka bilan kepka ko'pincha birga olinadi.",
    families: ["futbolka", "kepka", "ustki-kiyim"],
    ask: "Nechta xodim va qaysi o'lchamlar? Yozgi yoki qishki?",
  },
  {
    key: "ofis",
    title: "Qurilish, ko'chmas mulk, ofis",
    why: "Mijozlarga hujjat va taqdimot beriladi — papka, vizitka va bloknot.",
    families: ["papka", "vizitka", "bloknot", "paket"],
    ask: "Oyiga nechta mijoz bilan uchrashasiz? Vizitka nechta xodimga kerak?",
  },
  {
    key: "tadbir",
    title: "Tadbir, ko'rgazma, konferensiya",
    why: "Muddat qisqa — tayyor bo'lish sanasini birinchi so'rang. Beydjik, roll-up, bayroq va tarqatma.",
    families: ["suvenir", "banner", "flayer", "ruchka", "bloknot"],
    ask: "Tadbir sanasi qachon? Nechta ishtirokchi?",
  },
];

// lesson_progress/{email}.guide — the path's own marks.
export type GuideProgress = { seen?: string[]; situations_at?: string | null; shadow_at?: string | null };
type LessonMark = { seen?: string[]; quiz?: number | null };
const READ_TABS = ["about", "script", "objections"];
const lessonRead = (p: LessonMark | undefined) => Boolean(p && READ_TABS.every((t) => (p.seen || []).includes(t)));
export const PASS = 80;

export type Day = { n: number; title: string; text: string; done: number; total: number; state: "done" | "now" | "next" };

// The five days: the top products, the situations, the lessons behind the
// top products read, their tests passed, then calls next to an experienced
// seller. A day is "now" when it is the first one not done.
export function guidePath(top: Pick<GuideFacts, "key" | "lesson">[], g: GuideProgress | undefined, lessons: Record<string, LessonMark>): { days: Day[]; ready: boolean } {
  const seen = new Set(g?.seen || []);
  const lessonKeys = [...new Set(top.map((f) => f.lesson))];
  const raw: Omit<Day, "state">[] = [
    { n: 1, title: "Top-10 mahsulot", text: "Nima, kimga, narx va tiraj mantig'i", done: top.filter((f) => seen.has(f.key)).length, total: top.length },
    { n: 2, title: "Mijoz vaziyatlari", text: "6 ta vaziyat va har biriga nima taklif qilinadi", done: g?.situations_at ? 1 : 0, total: 1 },
    { n: 3, title: "Qo'ng'iroq skripti", text: "Darslik: Kontakt → Ramka → SPIN → Yopish", done: lessonKeys.filter((k) => lessonRead(lessons[k])).length, total: lessonKeys.length },
    { n: 4, title: "Test", text: `Shu darslar testi — har biri ${PASS}% dan`, done: lessonKeys.filter((k) => Number(lessons[k]?.quiz ?? -1) >= PASS).length, total: lessonKeys.length },
    { n: 5, title: "Tajribali yonida", text: "5 ta qo'ng'iroqni eshitadi, 3 tasini o'zi qiladi", done: g?.shadow_at ? 1 : 0, total: 1 },
  ];
  let found = false;
  const days = raw.map((d): Day => {
    const complete = d.total > 0 && d.done >= d.total;
    if (complete) return { ...d, state: "done" };
    if (!found) {
      found = true;
      return { ...d, state: "now" };
    }
    return { ...d, state: "next" };
  });
  return { days, ready: days.every((d) => d.state === "done") };
}

// The price tiers worth showing (up to 6, always the first and the last),
// and how much cheaper a unit gets from the first to the last.
export function tierView(tiers: { min_qty: number; price: number }[]) {
  const t = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  if (!t.length) return { rows: [], times: null as number | null, first: null as null | { min_qty: number; price: number }, last: null as null | { min_qty: number; price: number } };
  const want = 6;
  const rows = t.length <= want ? t : [...Array.from({ length: want - 1 }, (_, i) => t[Math.round((i * (t.length - 1)) / (want - 1))]), t[t.length - 1]];
  const uniq = rows.filter((r, i) => rows.findIndex((x) => x.min_qty === r.min_qty) === i);
  const first = t[0];
  const last = t[t.length - 1];
  const times = last.price > 0 && first.price > last.price ? Math.round((first.price / last.price) * 10) / 10 : null;
  return { rows: uniq, times, first, last };
}

// The model whose prices to show first: the one named most like the
// family's top typed spec is not knowable, so the one with the most tiers.
export const mainModel = (models: GuideModel[]): GuideModel | null =>
  [...models].filter((m) => m.tiers.length).sort((a, b) => b.tiers.length - a.tiers.length || a.name.localeCompare(b.name))[0] || null;

// The first paragraph of a lesson's "about", one or two sentences.
export const oneLiner = (about: string): string => {
  const p = String(about || "").split(/\n\s*\n/)[0].trim();
  const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
  return sentences.slice(0, 2).map((s) => s.trim()).join(" ");
};

// "×2" style: 2 → "2 baravar", 1.5 → "1,5 baravar".
export const timesLabel = (n: number) => `${String(n).replace(".", ",")} baravar`;
