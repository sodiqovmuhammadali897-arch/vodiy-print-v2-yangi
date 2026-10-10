import type { Manager } from "./types";

// KPI (sotuv menejerlari): two parts.
//  • Sotuv — sales_rate % (7,5) of every order the manager enters in the
//    month, paid unconditionally.
//  • Kirim — collect_rate % (2) of the money that came in during the
//    month on the manager's orders (old debts too), paid only when
//    attendance and amoCRM tasks are both at or above `threshold` %.
// The server (meta-webhook/salesKpi.js) keeps kpi_sales/{YYYY-MM}_{id}
// up to date with the sums as orders and payments are entered.

export type SalesKpiSettings = { sales_rate: number; collect_rate: number; threshold: number };
export const DEFAULT_SALES_KPI: SalesKpiSettings = { sales_rate: 7.5, collect_rate: 2, threshold: 80 };

export type SalesLine = { id: string; n: string; title: string; customer: string; total: number; date: string };
export type PaymentLine = { id: string; order_id: string; n: string; amount: number; date: string };
export type SalesKpiDoc = {
  id: string;
  month: string;
  manager_id: string;
  manager_name: string;
  sales: number;
  collected: number;
  debt: number; // everything still owed on the manager's orders, any month
  order_count: number;
  orders: SalesLine[];
  payments: PaymentLine[];
  updated_at: string;
};

// amo_tasks/{YYYY-MM}_{amoUserId} (meta-webhook/amoTasks.js): the month's
// amoCRM tasks of one user — came due, done on time, late — and the state
// right now (current month only).
export type AmoTaskDoc = {
  id: string;
  month: string;
  amo_user_id: number;
  name: string;
  staff_email: string | null;
  due: number;
  on_time: number;
  late: number;
  pct: number | null;
  overdue_open: number;
  today_due: number;
  today_open: number;
  no_task_leads: number;
  updated_at?: string;
};

export type KpiSnapshot = {
  plan: number;
  sales: number;
  collected: number;
  sales_rate: number;
  collect_rate: number;
  threshold: number;
  attendance_pct: number | null;
  amo_pct: number | null;
  sales_bonus: number;
  collect_bonus: number;
  eligible: boolean;
  payout: number;
};

// kpi_months/{YYYY-MM}_{managerId}: this month's own plan and rates (when
// set), and the approval state; approved months keep a snapshot.
export type KpiMonthStatus = "open" | "approved" | "paid";
export type KpiMonth = {
  id: string;
  month: string;
  manager_id: string;
  manager_name: string;
  plan?: number | null;
  sales_rate?: number | null;
  collect_rate?: number | null;
  status: KpiMonthStatus;
  snapshot?: KpiSnapshot | null;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  paid_by?: string;
};

export type Rates = { plan: number; sales_rate: number; collect_rate: number };

const pick = (...v: (number | null | undefined)[]) => {
  for (const x of v) if (x !== null && x !== undefined && Number.isFinite(Number(x))) return Number(x);
  return 0;
};

// The month's own value, else the manager's standing one, else the default.
export const ratesFor = (manager: Pick<Manager, "monthly_plan" | "sales_rate" | "collect_rate">, month: KpiMonth | null | undefined, s: SalesKpiSettings): Rates => ({
  plan: pick(month?.plan, manager.monthly_plan),
  sales_rate: pick(month?.sales_rate, manager.sales_rate, s.sales_rate),
  collect_rate: pick(month?.collect_rate, manager.collect_rate, s.collect_rate),
});

export type KpiInput = {
  sales: number;
  collected: number;
  rates: Rates;
  threshold: number;
  attendancePct: number | null; // null: no working day yet
  attendanceLinked: boolean; // an employee account is linked to the manager
  amoPct: number | null; // null: amoCRM tasks not connected yet
};
export type KpiResult = {
  salesBonus: number;
  collectPotential: number; // what the collect part is worth if earned
  collectBonus: number;
  attendanceOk: boolean;
  amoOk: boolean;
  eligible: boolean;
  payout: number;
  planPct: number | null;
};

const money = (n: number) => Math.round(n);

export function computeKpi(i: KpiInput): KpiResult {
  const salesBonus = money((i.sales * i.rates.sales_rate) / 100);
  const collectPotential = money((i.collected * i.rates.collect_rate) / 100);
  const attendanceOk = i.attendanceLinked && (i.attendancePct === null || i.attendancePct >= i.threshold);
  const amoOk = i.amoPct === null || i.amoPct >= i.threshold;
  const eligible = attendanceOk && amoOk;
  const collectBonus = eligible ? collectPotential : 0;
  return {
    salesBonus,
    collectPotential,
    collectBonus,
    attendanceOk,
    amoOk,
    eligible,
    payout: salesBonus + collectBonus,
    planPct: i.rates.plan > 0 ? (i.sales / i.rates.plan) * 100 : null,
  };
}

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
// "2026-10" → "Oktyabr 2026".
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1] || month} ${month.slice(0, 4)}`;

// 1234567 → "1 234 567"; so() adds the currency.
export const num = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/[\s\u00a0\u202f,]/g, " ");
export const so = (n: number) => `${num(n)} so'm`;

// 224e6 → "224 mln", 9.3e6 → "9,3 mln", 850 000 → "850 ming".
export const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, "").replace(".", ",")} mln`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} ming`;
  return String(Math.round(n));
};

// 7.5 → "7,5%".
export const rateLabel = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")}%`;
