// Moliya — the owner's finance dashboard (src/modules/finance/*). One place
// for every number on it, kept free of React so it can be tested:
//   • three kinds of money kept apart: booked (orders by their date),
//     delivered (orders handed over, by the day they reached «Yetkazildi»)
//     and collected (payments by their date);
//   • cost and profit from the Marja page (costs typed from September 2026),
//     with the net profit marked «dastlabki» while data is missing;
//   • month-by-month series, the same span before (↑↓), data-quality issues,
//     debt aging, breakdowns by region / source / product, advertising
//     cost per lead and per new customer, a 30-day cash outlook and the
//     recurring expenses (ijara, maosh …) entered or not this month.
import type { Customer, Expense, Order, OrderCost, OrderPayment, OrderProduct, StatusHistoryEntry } from "./types";
import { buildMarginRows, COST_EXPENSE_CATEGORIES, COST_TRACKING_FROM, profitBreakdown, summarize, type MarginRow } from "./margin";
import { isSale, saleDay, tashkentDay } from "./salesPeriod";

export type Span = { from: string; to: string }; // inclusive yyyy-mm-dd

export type FinanceInput = {
  orders: Order[];
  payments: OrderPayment[];
  expenses: Expense[];
  lines: OrderProduct[];
  costs: Map<string, OrderCost>;
  history: StatusHistoryEntry[];
  withCost: boolean; // admin: cost and profit from the Marja page
};

const DAY = 86400000;
const day = (v: string | null | undefined) => String(v || "").slice(0, 10);
const inSpan = (d: string, s: Span) => !!d && d >= s.from && d <= s.to;
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
export const monthSpan = (m: string): Span => {
  const [y, mo] = m.split("-").map(Number);
  return { from: `${m}-01`, to: new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10) };
};
export const monthsBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; i < 60; i++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > end) break;
    out.push(k);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
};
export const debtOf = (o: Pick<Order, "remaining_amount" | "total_amount" | "paid_amount">) =>
  Number(o.remaining_amount || 0) || Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The span to compare with (↑↓): «Bu oy» (1st…today) against the same days
// of the month before, «Bu yil» against the same days a year before, a
// whole month against the whole month before, anything else against the
// same number of days just before it.
export function compareSpan(span: Span, preset: string): Span {
  const shiftMonths = (d: string, n: number) => {
    const [y, m, dd] = d.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(dd, last)).padStart(2, "0")}`;
  };
  const wholeMonth = span.from.endsWith("-01") && span.to === monthSpan(span.from.slice(0, 7)).to;
  if (preset === "month" || preset === "prev_month" || wholeMonth) {
    const from = shiftMonths(span.from, -1);
    return { from, to: wholeMonth ? monthSpan(from.slice(0, 7)).to : shiftMonths(span.to, -1) };
  }
  if (preset === "year") return { from: shiftMonths(span.from, -12), to: shiftMonths(span.to, -12) };
  const len = daysBetween(span.from, span.to) + 1;
  return { from: addDays(span.from, -len), to: addDays(span.from, -1) };
}

// ── Delivered day ────────────────────────────────────────────────────
// The first time an order reached «Yetkazildi» or «Yopildi» (status
// history); without history, its delivery date, else its own date.
const DELIVERED = new Set(["delivered", "closed"]);
export function deliveredDays(orders: Order[], history: StatusHistoryEntry[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const h of history) {
    if (!DELIVERED.has(h.status)) continue;
    const d = tashkentDay(h.changed_at);
    if (d && (!first.has(h.order_id) || d < first.get(h.order_id)!)) first.set(h.order_id, d);
  }
  const out = new Map<string, string>();
  for (const o of orders) {
    if (!isSale(o) || !DELIVERED.has(o.status)) continue;
    out.set(o.id, first.get(o.id) || day(o.delivery_date) || saleDay(o));
  }
  return out;
}

// ── Totals for a span ────────────────────────────────────────────────
export type Totals = {
  booked: number; // orders placed (sum)
  orders: number;
  delivered: number; // orders handed over in the span (sum)
  collected: number; // payments received
  expenses: number; // all expenses in the span
  opex: number; // expenses other than supplier/raw-material payments (those are the cost)
  cost: number | null; // admin only
  gross: number | null; // revenue − cost, on the part where cost is typed
  net: number; // admin: revenue − cost − opex; else booked − all expenses
  margin: number | null; // gross / costed revenue, %
  missingLines: number;
  missingRevenue: number;
  untrackedRevenue: number; // orders before costs were typed
  avgCheck: number;
};

export function totals(input: FinanceInput, span: Span, delivered: Map<string, string>): Totals {
  const sales = input.orders.filter((o) => isSale(o) && inSpan(saleDay(o), span));
  const booked = sales.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const deliveredSum = input.orders.filter((o) => inSpan(delivered.get(o.id) || "", span)).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const collected = input.payments.filter((p) => inSpan(day(p.payment_date), span)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const exp = input.expenses.filter((e) => inSpan(day(e.date), span));
  const all = exp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const opex = exp.filter((e) => !COST_EXPENSE_CATEGORIES.includes(e.category)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const base = { booked, orders: sales.length, delivered: deliveredSum, collected, expenses: all, opex, avgCheck: sales.length ? booked / sales.length : 0 };
  if (!input.withCost) return { ...base, cost: null, gross: null, net: booked - all, margin: null, missingLines: 0, missingRevenue: 0, untrackedRevenue: 0 };
  const summary = summarize(buildMarginRows(sales, input.lines, input.costs));
  const b = profitBreakdown(summary, exp);
  return {
    ...base,
    cost: summary.costedLines ? b.cost : null,
    gross: summary.costedLines ? b.gross : null,
    net: b.net,
    margin: summary.margin,
    missingLines: summary.missingLines,
    missingRevenue: summary.missingRevenue,
    untrackedRevenue: summary.untrackedRevenue,
  };
}

export type MonthPoint = Totals & { month: string; costTracked: boolean };
export function monthSeries(input: FinanceInput, months: string[], delivered: Map<string, string>): MonthPoint[] {
  return months.map((m) => ({ month: m, costTracked: `${m}-01` >= COST_TRACKING_FROM, ...totals(input, monthSpan(m), delivered) }));
}

// ── Recurring expenses (ijara, maosh, internet …) ────────────────────
export type ExpenseTemplate = {
  id: string;
  name: string;
  category: string;
  amount: number;
  due_day: number; // 1–28: when it is usually paid
  active: boolean;
  created_at?: string;
};
export type TemplateState = { template: ExpenseTemplate; entered: Expense | null; dueDate: string };
// Entered this month: an expense made from it (template_id), else one of the
// same category and amount.
export function templateStatus(templates: ExpenseTemplate[], expenses: (Expense & { template_id?: string | null })[], month: string): TemplateState[] {
  const span = monthSpan(month);
  const inMonth = expenses.filter((e) => inSpan(day(e.date), span));
  return templates
    .filter((t) => t.active !== false)
    .map((t) => ({
      template: t,
      entered: inMonth.find((e) => e.template_id === t.id) || inMonth.find((e) => !e.template_id && e.category === t.category && Math.abs(Number(e.amount) - Number(t.amount)) < 1) || null,
      dueDate: `${month}-${String(Math.min(28, Math.max(1, Number(t.due_day) || 1))).padStart(2, "0")}`,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ── Data quality ────────────────────────────────────────────────────
export type Issue = { key: string; level: "critical" | "warning" | "info"; title: string; detail: string; link?: string; action?: "expense" };
const MONTHLY_CATEGORIES = ["Ijara", "Maosh", "Reklama", "Kommunal"];

export function dataQuality(
  input: FinanceInput,
  span: Span,
  t: Totals,
  opts: { customers: Map<string, Customer>; templates: TemplateState[]; monthLike: boolean },
): Issue[] {
  const out: Issue[] = [];
  if (input.withCost && t.missingLines > 0)
    out.push({ key: "cost", level: "critical", title: `${t.missingLines} ta qatorda tannarx yo'q`, detail: `${Math.round(t.missingRevenue).toLocaleString("uz-UZ")} so'm savdo tannarxsiz — foyda shu qismga baland chiqadi.`, link: "/margin" });
  if (opts.monthLike) {
    const exp = input.expenses.filter((e) => inSpan(day(e.date), span));
    const missing = MONTHLY_CATEGORIES.filter((c) => !exp.some((e) => e.category === c));
    if (missing.length) out.push({ key: "opex", level: missing.includes("Maosh") || missing.includes("Ijara") ? "critical" : "warning", title: `Kiritilmagan xarajat: ${missing.join(", ")}`, detail: "Bu davrda bu turdagi xarajat yo'q — sof foyda haqiqatdan baland ko'rinadi.", action: "expense" });
    const due = opts.templates.filter((s) => !s.entered);
    if (due.length) out.push({ key: "templates", level: "warning", title: `${due.length} ta doimiy xarajat bu oy kiritilmagan`, detail: due.map((s) => s.template.name).slice(0, 5).join(", "), action: "expense" });
  }
  const pays = input.payments.filter((p) => inSpan(day(p.payment_date), span));
  const noType = pays.filter((p) => !String(p.payment_type || "").trim()).length;
  const cash = pays.filter((p) => /naqd/i.test(String(p.payment_type || ""))).length;
  if (noType) out.push({ key: "paytype", level: "warning", title: `${noType} ta to'lovda turi yo'q`, detail: "Naqd, karta yoki hisob raqam tanlanmagan." });
  else if (pays.length >= 10 && cash / pays.length >= 0.9) out.push({ key: "paycash", level: "info", title: `To'lovlarning ${Math.round((cash / pays.length) * 100)}% «Naqd»`, detail: "Karta va hisob raqam to'lovlari ham «Naqd» deb yozilayotgan bo'lishi mumkin." });
  const buyers = new Set(input.orders.filter((o) => isSale(o) && inSpan(saleDay(o), span) && o.customer_id).map((o) => o.customer_id!));
  const noRegion = [...buyers].filter((id) => !String(opts.customers.get(id)?.region || "").trim()).length;
  if (noRegion) out.push({ key: "region", level: "info", title: `${noRegion} ta mijozda viloyat yo'q`, detail: "Viloyat kesimida ular «Yozilmagan» bo'lib ko'rinadi.", link: "/customers" });
  const order = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
// Net profit is final only when nothing critical or warning is open.
export const isProvisional = (issues: Issue[]) => issues.some((i) => i.level !== "info");

// ── Debt aging (by due date: deadline, else 14 days after the order) ─
export type AgingBucket = { key: string; label: string; n: number; sum: number };
export function debtAging(orders: Order[], today: string): AgingBucket[] {
  const b: AgingBucket[] = [
    { key: "not_due", label: "Muddatida", n: 0, sum: 0 },
    { key: "d7", label: "1–7 kun", n: 0, sum: 0 },
    { key: "d30", label: "8–30 kun", n: 0, sum: 0 },
    { key: "d60", label: "31–60 kun", n: 0, sum: 0 },
    { key: "d60p", label: "60+ kun", n: 0, sum: 0 },
  ];
  for (const o of orders) {
    if (!isSale(o)) continue;
    const debt = debtOf(o);
    if (debt <= 0) continue;
    const due = day(o.deadline) || addDays(saleDay(o) || today, 14);
    const late = daysBetween(due, today);
    const i = late <= 0 ? 0 : late <= 7 ? 1 : late <= 30 ? 2 : late <= 60 ? 3 : 4;
    b[i].n++;
    b[i].sum += debt;
  }
  return b;
}

// ── Breakdowns: region, source, product group ────────────────────────
export type Dim = "region" | "source" | "product";
export type Slice = { key: string; orders: number; revenue: number; avg: number; median: number; share: number; prevRevenue: number; change: number | null; margin: number | null };
export const NOT_SET = "Yozilmagan";

function keyOf(dim: Dim, o: Order, customers: Map<string, Customer>): string {
  const c = o.customer_id ? customers.get(o.customer_id) : undefined;
  if (dim === "region") return String(c?.region || "").trim() || NOT_SET;
  return String(o.customer_source || c?.source || "").trim() || NOT_SET;
}

export function breakdown(input: FinanceInput, dim: Dim, span: Span, prev: Span, customers: Map<string, Customer>): Slice[] {
  const by = new Map<string, { orders: Set<string>; revenue: number; checks: number[]; prev: number; costed: number; cost: number }>();
  const get = (k: string) => {
    if (!by.has(k)) by.set(k, { orders: new Set(), revenue: 0, checks: [], prev: 0, costed: 0, cost: 0 });
    return by.get(k)!;
  };
  const sales = (s: Span) => input.orders.filter((o) => isSale(o) && inSpan(saleDay(o), s));
  if (dim === "product") {
    const rows = (s: Span): MarginRow[] => buildMarginRows(sales(s), input.lines, input.costs);
    const cat = (r: MarginRow) => String(r.line?.category || "").trim() || "Boshqa";
    for (const r of rows(span)) {
      const g = get(cat(r));
      g.orders.add(r.order.id);
      g.revenue += r.revenue;
      if (input.withCost && r.cost !== null) {
        g.costed += r.revenue;
        g.cost += r.cost;
      }
    }
    for (const r of rows(prev)) get(cat(r)).prev += r.revenue;
    for (const g of by.values()) g.checks = [];
  } else {
    for (const o of sales(span)) {
      const g = get(keyOf(dim, o, customers));
      g.orders.add(o.id);
      g.revenue += Number(o.total_amount || 0);
      g.checks.push(Number(o.total_amount || 0));
    }
    for (const o of sales(prev)) get(keyOf(dim, o, customers)).prev += Number(o.total_amount || 0);
  }
  const total = [...by.values()].reduce((s, g) => s + g.revenue, 0);
  return [...by.entries()]
    .map(([key, g]) => ({
      key,
      orders: g.orders.size,
      revenue: g.revenue,
      avg: g.orders.size ? g.revenue / g.orders.size : 0,
      median: median(g.checks),
      share: total ? (g.revenue / total) * 100 : 0,
      prevRevenue: g.prev,
      change: g.prev > 0 ? ((g.revenue - g.prev) / g.prev) * 100 : null,
      margin: g.costed > 0 ? ((g.costed - g.cost) / g.costed) * 100 : null,
    }))
    .filter((s) => s.revenue > 0 || s.prevRevenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.prevRevenue - a.prevRevenue);
}

// ── Advertising: cost per lead and per new paying customer ──────────
export type AmoMonthLeads = { month: string; leads?: { created?: number } };
export type MarketingRow = { month: string; spend: number; leads: number; newCustomers: number; cpl: number | null; cac: number | null };
export function marketing(input: FinanceInput, months: string[], amo: AmoMonthLeads[]): MarketingRow[] {
  const first = new Map<string, string>();
  for (const o of input.orders) {
    if (!isSale(o) || !o.customer_id) continue;
    const d = saleDay(o);
    if (d && (!first.has(o.customer_id) || d < first.get(o.customer_id)!)) first.set(o.customer_id, d);
  }
  return months.map((m) => {
    const spend = input.expenses.filter((e) => e.category === "Reklama" && day(e.date).startsWith(m)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const leads = amo.filter((a) => a.month === m).reduce((s, a) => s + Number(a.leads?.created || 0), 0);
    const newCustomers = [...first.values()].filter((d) => d.startsWith(m)).length;
    return { month: m, spend, leads, newCustomers, cpl: spend && leads ? spend / leads : null, cac: spend && newCustomers ? spend / newCustomers : null };
  });
}

// ── 30-day cash outlook ──────────────────────────────────────────────
// Expected in: unpaid orders by due date (deadline, else 14 days after the
// order). Expected out: recurring expenses by their due day, not entered
// yet. Late debt is shown apart — it is not money we can count on.
export type ForecastWeek = { label: string; from: string; to: string; inflow: number; outflow: number };
export function forecast30(orders: Order[], templates: ExpenseTemplate[], expenses: (Expense & { template_id?: string | null })[], today: string): { weeks: ForecastWeek[]; overdue: number; overdueOrders: number } {
  const weeks: ForecastWeek[] = [0, 1, 2, 3].map((i) => {
    const from = addDays(today, i * 7 + (i ? 1 : 0));
    const to = addDays(today, i * 7 + 7);
    return { label: `${i * 7 + (i ? 1 : 0)}–${i * 7 + 7} kun`, from, to, inflow: 0, outflow: 0 };
  });
  let overdue = 0;
  let overdueOrders = 0;
  for (const o of orders) {
    if (!isSale(o)) continue;
    const debt = debtOf(o);
    if (debt <= 0) continue;
    const due = day(o.deadline) || addDays(saleDay(o) || today, 14);
    if (due < today) {
      overdue += debt;
      overdueOrders++;
      continue;
    }
    const w = weeks.find((x) => due >= x.from && due <= x.to) || (due >= weeks[0].from && due <= today ? weeks[0] : null);
    if (w) w.inflow += debt;
  }
  for (const m of monthsBetween(today, addDays(today, 30))) {
    for (const s of templateStatus(templates, expenses, m)) {
      if (s.entered) continue;
      const due = s.dueDate < today && m === today.slice(0, 7) ? today : s.dueDate;
      const w = weeks.find((x) => due >= x.from && due <= x.to) || (due === today ? weeks[0] : null);
      if (w) w.outflow += Number(s.template.amount || 0);
    }
  }
  return { weeks, overdue, overdueOrders };
}
