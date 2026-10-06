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
