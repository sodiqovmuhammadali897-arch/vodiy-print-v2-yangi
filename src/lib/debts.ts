// Qarzdorlik (Moliya): unpaid orders filtered by period (order date),
// status group and manager, with the sums the panel shows. Free of React
// so it can be tested.
import type { Order, OrderStatus } from "./types";

export type DebtPeriod = "all" | "week" | "month" | "last_month" | "year";
export type DebtGroup = "all" | "new" | "production" | "ready" | "delivered";

export const DEBT_PERIODS: [DebtPeriod, string][] = [
  ["all", "Hammasi"],
  ["week", "Hafta"],
  ["month", "Oy"],
  ["last_month", "O'tgan oy"],
  ["year", "Yil"],
];

// The order's status in four steps; delivered (or closed) and still unpaid
// is the money to collect first.
export const DEBT_GROUPS: { key: Exclude<DebtGroup, "all">; label: string; statuses: OrderStatus[] }[] = [
  { key: "new", label: "Yangi / dizayn", statuses: ["new", "accepted", "calculating", "awaiting_advance", "design", "approving"] },
  { key: "production", label: "Ishlab chiqarilmoqda", statuses: ["sent_to_production", "production", "quality_control"] },
  { key: "ready", label: "Tayyor", statuses: ["ready", "ready_to_deliver"] },
  { key: "delivered", label: "Yetkazildi — pul yo'q", statuses: ["delivered", "closed"] },
];
export const groupOfStatus = (s: OrderStatus | string | undefined): Exclude<DebtGroup, "all"> =>
  (DEBT_GROUPS.find((g) => g.statuses.includes(s as OrderStatus)) || DEBT_GROUPS[0]).key;

export const debtOf = (o: Pick<Order, "remaining_amount" | "total_amount" | "paid_amount">) =>
  Number(o.remaining_amount || 0) || Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
export const NO_MANAGER = "Menejersiz";
export const managerOf = (o: Pick<Order, "manager_name">) => String(o.manager_name || "").trim() || NO_MANAGER;
const dayOfOrder = (o: Pick<Order, "order_date" | "created_at">) => String(o.order_date || o.created_at || "").slice(0, 10);

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const monthBefore = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

// The order days a period covers (inclusive), for `today` in Tashkent.
export function periodRange(period: DebtPeriod, today: string): { from: string; to: string } | null {
  if (period === "week") return { from: shift(today, -6), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "last_month") {
    const m = monthBefore(today.slice(0, 7));
    return { from: `${m}-01`, to: `${m}-31` };
  }
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return null;
}

export type DebtRow<O extends Order = Order> = { order: O; remaining: number; group: Exclude<DebtGroup, "all">; manager: string; day: string };
type Sum = { n: number; sum: number };

export type DebtView<O extends Order = Order> = {
  rows: DebtRow<O>[]; // after every filter, biggest debt first
  total: Sum; // after every filter
  byGroup: Record<Exclude<DebtGroup, "all">, Sum> & { all: Sum }; // period + manager
  byManager: { name: string; n: number; sum: number }[]; // period + status group
};

export function debtView<O extends Order>(orders: O[], opts: { period: DebtPeriod; group: DebtGroup; manager: string | null; today: string }): DebtView<O> {
  const range = periodRange(opts.period, opts.today);
  const all: DebtRow<O>[] = orders
    .filter((o) => o.status !== "cancelled" && !o.is_draft)
    .map((o) => ({ order: o, remaining: debtOf(o), group: groupOfStatus(o.status), manager: managerOf(o), day: dayOfOrder(o) }))
    .filter((r) => r.remaining > 0 && (!range || (r.day >= range.from && r.day <= range.to)));

  const add = (s: Sum, r: DebtRow<O>) => {
    s.n++;
    s.sum += r.remaining;
  };
  const byGroup = { all: { n: 0, sum: 0 }, new: { n: 0, sum: 0 }, production: { n: 0, sum: 0 }, ready: { n: 0, sum: 0 }, delivered: { n: 0, sum: 0 } };
  const managers = new Map<string, Sum>();
  for (const r of all) {
    if (opts.manager === null || r.manager === opts.manager) {
      add(byGroup.all, r);
      add(byGroup[r.group], r);
    }
    if (opts.group === "all" || r.group === opts.group) {
      if (!managers.has(r.manager)) managers.set(r.manager, { n: 0, sum: 0 });
      add(managers.get(r.manager)!, r);
    }
  }
  const rows = all.filter((r) => (opts.group === "all" || r.group === opts.group) && (opts.manager === null || r.manager === opts.manager)).sort((a, b) => b.remaining - a.remaining);
  return {
    rows,
    total: { n: rows.length, sum: rows.reduce((s, r) => s + r.remaining, 0) },
    byGroup,
    byManager: [...managers.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => (a.name === NO_MANAGER ? 1 : b.name === NO_MANAGER ? -1 : b.sum - a.sum)),
  };
}
