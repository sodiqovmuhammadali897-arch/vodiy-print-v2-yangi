// Yutqazilganlar (admin): amo_lost/{YYYY-MM-DD} docs written by the server
// (meta-webhook/amoLost.js) — lost amoCRM deals with the reason the
// manager picked — summed for a day, a week or a month. Free of React so
// it can be tested.

export type LostGroup = "price" | "competitor" | "no_answer" | "wrong_number" | "cancelled" | "other" | "none";
export type LostItem = {
  id: number;
  name: string;
  price: number;
  user: number;
  manager: string;
  reason: string;
  group: LostGroup;
  stage: string;
  closed: string;
};
export type LostDay = { id: string; day: string; total: number; sum: number; counts: Partial<Record<LostGroup, number>>; items: LostItem[] };
export type Period = "today" | "yesterday" | "week" | "month";

// Order, labels and colors of the groups (cards, chips and bars).
export const GROUPS: { key: LostGroup; title: string; icon: string }[] = [
  { key: "price", title: "Qimmat", icon: "💸" },
  { key: "competitor", title: "Raqobatchi", icon: "🏁" },
  { key: "no_answer", title: "Aloqa yo'q", icon: "📵" },
  { key: "wrong_number", title: "Xato raqam", icon: "☎️" },
  { key: "cancelled", title: "Bekor bo'ldi", icon: "🚫" },
  { key: "other", title: "Boshqa sabab", icon: "▫️" },
  { key: "none", title: "Tanlanmagan", icon: "❓" },
];

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// The days a period covers, up to `today` (Tashkent date).
export function periodDays(period: Period, today: string): { from: string; to: string } {
  if (period === "today") return { from: today, to: today };
  if (period === "yesterday") return { from: shift(today, -1), to: shift(today, -1) };
  if (period === "week") return { from: shift(today, -6), to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export type LostSummary = {
  total: number;
  sum: number;
  byGroup: Record<LostGroup, { n: number; sum: number }>;
  managers: { user: number; name: string; n: number; byGroup: Partial<Record<LostGroup, number>> }[];
  reasons: { reason: string; group: LostGroup; n: number }[];
  items: LostItem[];
};

// Everything lost in [from, to], optionally for one amoCRM user.
export function summarize(days: LostDay[], from: string, to: string, user: number | null = null): LostSummary {
  const items = days
    .filter((d) => d.day >= from && d.day <= to)
    .flatMap((d) => d.items)
    .filter((it) => user === null || it.user === user)
    .sort((a, b) => b.price - a.price || b.closed.localeCompare(a.closed));
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g.key, { n: 0, sum: 0 }])) as LostSummary["byGroup"];
  const managers = new Map<number, LostSummary["managers"][number]>();
  const reasons = new Map<string, { reason: string; group: LostGroup; n: number }>();
  for (const it of items) {
    const g = byGroup[it.group] || byGroup.other;
    g.n++;
    g.sum += it.price;
    const m = managers.get(it.user) || { user: it.user, name: it.manager || "Mas'ul yo'q", n: 0, byGroup: {} };
    m.n++;
    m.byGroup[it.group] = (m.byGroup[it.group] || 0) + 1;
    managers.set(it.user, m);
    const key = it.reason || "Sabab tanlanmagan";
    const r = reasons.get(key) || { reason: key, group: it.group, n: 0 };
    r.n++;
    reasons.set(key, r);
  }
  return {
    total: items.length,
    sum: items.reduce((s, it) => s + it.price, 0),
    byGroup,
    managers: [...managers.values()].sort((a, b) => b.n - a.n),
    reasons: [...reasons.values()].sort((a, b) => b.n - a.n),
    items,
  };
}

// Month by month: how many lost, and the price / competitor share.
export function monthTrend(days: LostDay[]): { month: string; total: number; price: number; competitor: number }[] {
  const by = new Map<string, { month: string; total: number; price: number; competitor: number }>();
  for (const d of days) {
    const m = d.day.slice(0, 7);
    const r = by.get(m) || { month: m, total: 0, price: 0, competitor: 0 };
    r.total += d.total;
    r.price += d.counts.price || 0;
    r.competitor += d.counts.competitor || 0;
    by.set(m, r);
  }
  return [...by.values()].filter((r) => r.total > 0).sort((a, b) => a.month.localeCompare(b.month));
}
