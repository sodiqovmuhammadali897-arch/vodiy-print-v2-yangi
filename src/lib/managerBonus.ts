import type { Order, Task } from "./types";
import { isSale, saleDay } from "./salesPeriod";

// KPI va bonus: each order brings the manager a bonus the admin sets (a
// share of the order, suggested from its margin). A month's sum of those is
// the manager's bonus fund; what is paid is the fund × the KPI score, which
// weighs plan, tasks, attendance and CRM order.

export type BonusWeights = { plan: number; tasks: number; attendance: number; crm: number };
export type BonusTier = { min_margin: number; pct: number };
export type BonusSettings = {
  weights: BonusWeights;
  plan_floor: number; // plan below this % → the plan part is 0
  plan_cap: number; // plan above 100 % counts up to this
  tiers: BonusTier[]; // suggested share of the order by its margin
  default_rate?: number; // % of turnover assumed as bonus when a manager has no history (goal calculator)
};

export const DEFAULT_BONUS_SETTINGS: BonusSettings = {
  weights: { plan: 50, tasks: 25, attendance: 15, crm: 10 },
  plan_floor: 60,
  plan_cap: 120,
  tiers: [
    { min_margin: 40, pct: 12 },
    { min_margin: 30, pct: 10 },
    { min_margin: 20, pct: 7 },
    { min_margin: -1000, pct: 5 },
  ],
  default_rate: 5,
};

export const COMPONENTS: { key: keyof BonusWeights; label: string; color: string }[] = [
  { key: "plan", label: "Reja", color: "#0062db" },
  { key: "tasks", label: "Vazifalar", color: "#7c3aed" },
  { key: "attendance", label: "Davomat", color: "#0ca30c" },
  { key: "crm", label: "CRM tartibi", color: "#0891b2" },
];

// The bonus written on one order (order_bonuses/{orderId}).
export type OrderBonus = {
  id: string;
  order_id: string;
  manager_id: string | null;
  manager_name: string;
  amount: number;
  pct: number | null; // share of the order it was picked as, if picked so
  margin: number | null; // the order's margin when it was set
  order_total: number;
  month: string; // YYYY-MM of the order's sale day
  updated_by: string;
  updated_at: string;
};

// A manager's month (kpi_months/{YYYY-MM}_{managerId}).
export type KpiMonthStatus = "open" | "approved" | "paid";
export type KpiMonth = {
  id: string;
  month: string;
  manager_id: string;
  manager_name: string;
  crm_score: number | null;
  // The manager's own target for the month: how much bonus they aim to
  // earn (so'm). Set by the admin for now; never changes the admin's plan.
  goal?: number | null;
  // This month's plan (turnover) and bonus rate, set on KPI va bonus; when
  // missing, the manager's standing monthly_plan / bonus_rate apply.
  plan?: number | null;
  rate?: number | null;
  status: KpiMonthStatus;
  snapshot?: (BonusResult & { turnover: number; plan: number; fund: number; weights: BonusWeights }) | null;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  paid_by?: string;
  notified_at?: string;
};

export const suggestPct = (margin: number | null, tiers: BonusTier[] = DEFAULT_BONUS_SETTINGS.tiers): number | null => {
  if (margin === null || !Number.isFinite(margin)) return null;
  const sorted = [...tiers].sort((a, b) => b.min_margin - a.min_margin);
  if (!sorted.length) return null;
  // The lowest tier also covers anything below it (even a loss).
  return (sorted.find((t) => margin >= t.min_margin) || sorted[sorted.length - 1]).pct;
};

// Plan done, as the score of the plan part: 0 below the floor, capped above.
export const planScore = (turnover: number, plan: number, floor: number, cap: number): number | null => {
  if (!(plan > 0)) return null;
  const done = (turnover / plan) * 100;
  if (done < floor) return 0;
  return Math.min(cap, done);
};

// Tasks of the month: ones due in it (by today) and ones without a due
// date finished in it. Done by the due date = on time.
export const taskScore = (tasks: Pick<Task, "status" | "due_date" | "completed_at" | "created_at">[], month: string, today: string) => {
  const dayOf = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10) : "");
  let total = 0;
  let onTime = 0;
  let late = 0;
  for (const t of tasks) {
    const due = t.due_date ? String(t.due_date).slice(0, 10) : "";
    const doneDay = t.status === "done" ? dayOf(t.completed_at) : "";
    if (due) {
      if (!due.startsWith(month)) continue;
      // Not due yet and not done: nothing to judge.
      if (due >= today && !doneDay) continue;
      total += 1;
      if (doneDay && doneDay <= due) onTime += 1;
      else late += 1;
    } else if (doneDay.startsWith(month)) {
      total += 1;
      onTime += 1;
    }
  }
  return { total, onTime, late, score: total ? (onTime / total) * 100 : null };
};

export type BonusScores = Record<keyof BonusWeights, number | null>;
export type BonusResult = {
  scores: BonusScores;
  points: Record<keyof BonusWeights, number | null>; // weight × score, per part
  // Parts with no data yet (no plan set, no tasks, CRM not marked) are left
  // out and the rest scaled up, so a missing number neither pays nor costs.
  missing: (keyof BonusWeights)[];
  total: number; // 0–100+ (plan bonus can push it over 100)
  payout: number;
};

export const computeBonus = (fund: number, scores: BonusScores, weights: BonusWeights): BonusResult => {
  const keys = COMPONENTS.map((c) => c.key);
  const present = keys.filter((k) => scores[k] !== null && weights[k] > 0);
  const missing = keys.filter((k) => scores[k] === null && weights[k] > 0);
  const weightSum = present.reduce((s, k) => s + weights[k], 0);
  const points = Object.fromEntries(keys.map((k) => [k, scores[k] === null ? null : (weights[k] * scores[k]!) / 100])) as BonusResult["points"];
  const raw = present.reduce((s, k) => s + points[k]!, 0);
  const total = weightSum > 0 ? (raw / weightSum) * 100 : 0;
  return { scores, points, missing, total: Math.round(total * 100) / 100, payout: Math.round((fund * total) / 100 / 100) * 100 };
};

const norm = (s: string | null | undefined) => String(s || "").trim().toLowerCase();

// A manager's sale orders of a month (by the order's own day).
export const managerOrders = (orders: Order[], managerName: string, month: string) =>
  orders.filter((o) => isSale(o) && norm(o.manager_name) === norm(managerName) && saleDay(o).startsWith(month));

export const monthOf = (o: Pick<Order, "order_date" | "created_at">) => saleDay(o).slice(0, 7);

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
// "2026-10" → "Oktyabr 2026".
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1] || month} ${month.slice(0, 4)}`;

export const so = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/ |,/g, " ")} so'm`;

// ── Maqsad kalkulyatori ────────────────────────────────────────────────
// "I want to earn N this month": the turnover that takes, given the
// manager's usual bonus share of an order and the KPI they are running at
// (the plan part assumed met, since meeting the turnover meets it).

export type GoalInput = {
  goal: number; // so'm of bonus aimed at
  rate: number; // bonus as % of turnover (their history, else the default)
  scores: BonusScores; // current KPI parts
  weights: BonusWeights;
  turnover: number; // sold so far this month
  workDays: number; // working days in the month
  daysDone: number; // working days already behind (today not counted)
  avgCheck: number | null; // their average order
  conversion: number | null; // % of leads won (amoCRM)
};

export type GoalPlan = {
  kpi: number; // expected KPI %, plan part at 100
  required: number; // turnover needed
  left: number;
  expectedByNow: number;
  gap: number; // + ahead, − behind
  perDay: number | null;
  orders: number | null;
  leads: number | null;
  // How much less turnover the same goal needs if this part were 100 %.
  gains: { key: keyof BonusWeights; from: number; saves: number }[];
  allPerfect: number;
};

export const goalPlan = (g: GoalInput): GoalPlan | null => {
  if (!(g.goal > 0) || !(g.rate > 0)) return null;
  const need = (scores: BonusScores) => {
    const kpi = computeBonus(1, { ...scores, plan: 100 }, g.weights).total;
    return { kpi, required: kpi > 0 ? g.goal / ((g.rate / 100) * (kpi / 100)) : Infinity };
  };
  const now = need(g.scores);
  const left = Math.max(0, now.required - g.turnover);
  const daysLeft = Math.max(0, g.workDays - g.daysDone);
  const expectedByNow = g.workDays > 0 ? (now.required * g.daysDone) / g.workDays : 0;
  const orders = g.avgCheck && g.avgCheck > 0 ? Math.ceil(left / g.avgCheck) : null;
  const gains = (["tasks", "attendance", "crm"] as const)
    .filter((k) => g.scores[k] !== null && g.scores[k]! < 100 && g.weights[k] > 0)
    .map((k) => ({ key: k, from: g.scores[k]!, saves: now.required - need({ ...g.scores, [k]: 100 }).required }))
    .filter((x) => x.saves > 0)
    .sort((a, b) => b.saves - a.saves);
  return {
    kpi: now.kpi,
    required: now.required,
    left,
    expectedByNow,
    gap: g.turnover - expectedByNow,
    perDay: daysLeft > 0 ? left / daysLeft : null,
    orders,
    leads: orders !== null && g.conversion && g.conversion > 0 ? Math.ceil(orders / (g.conversion / 100)) : null,
    gains,
    allPerfect: need({ plan: 100, tasks: g.scores.tasks === null ? null : 100, attendance: g.scores.attendance === null ? null : 100, crm: g.scores.crm === null ? null : 100 }).required,
  };
};

// Working days of a month by the general days off, and how many of them
// are already behind `today` (today itself still to be worked).
export const monthWorkDays = (month: string, today: string, offDays: number[]) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0;
  let done = 0;
  for (let d = 1; d <= last; d++) {
    const code = `${month}-${String(d).padStart(2, "0")}`;
    if (offDays.includes(new Date(`${code}T00:00:00Z`).getUTCDay())) continue;
    total += 1;
    if (code < today) done += 1;
  }
  return { total, done };
};

// "224 mln", "9,3 mln", "850 ming".
export const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, "").replace(".", ",")} mln`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} ming`;
  return String(Math.round(n));
};
