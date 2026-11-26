// Sotuv bo'limi → Bosh sahifa for a manager (step 7, 2026-11-26; mockup of
// 2026-11-13): their own day — tasks, talk time against the daily target,
// new leads, the month's plan, their funnel and conversion against the
// team. Pure helpers; the page is src/modules/leads/crm/ManagerHome.tsx.
import { isOldLead } from "./crm";
import type { Lead, Order } from "./types";

const TZ = 5 * 3600e3;
const DAY = 864e5;
const ymd = (ms: number) => new Date(ms + TZ).toISOString().slice(0, 10);

// Working days left in the month, today included (Sundays off).
export function workDaysLeft(now = Date.now(), holidays: string[] = []): number {
  const d = new Date(now + TZ);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  let n = 0;
  for (let day = d.getUTCDate(); day <= last; day++) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day));
    const code = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && !holidays.includes(code)) n++;
  }
  return n;
}

// The month's plan: done, %, left and what is needed per working day.
export function planLine(plan: number, sales: number, daysLeft: number) {
  const left = Math.max(0, plan - sales);
  return {
    plan,
    sales,
    pct: plan > 0 ? Math.round((sales / plan) * 100) : null,
    left,
    perDay: plan > 0 && daysLeft > 0 ? Math.ceil(left / daysLeft / 1000) * 1000 : 0,
  };
}

type OrderLite = Pick<Order, "status"> & Partial<Pick<Order, "total_amount" | "created_at">>;

// This month's leads that became orders — own and the team's.
export function monthConversion(leads: Lead[], orders: Record<string, OrderLite>, email: string, now = Date.now()) {
  const month = ymd(now).slice(0, 7);
  const cohort = leads.filter((l) => !isOldLead(l) && ymd(Date.parse(l.created_at || "")).slice(0, 7) === month);
  const won = (l: Lead) => Boolean(l.converted_order_id && orders[l.converted_order_id] && orders[l.converted_order_id].status !== "cancelled");
  const mine = cohort.filter((l) => l.assigned_to_email === email);
  const rate = (list: Lead[]) => (list.length ? list.filter(won).length / list.length : null);
  return { leads: mine.length, won: mine.filter(won).length, conv: rate(mine), team: rate(cohort.filter((l) => l.assigned_to_email)) };
}

// Today's talk against the daily target (minutes).
export function talkProgress(talkSec: number, targetMin: number) {
  const min = Math.round(talkSec / 60);
  return { min, target: targetMin, pct: targetMin > 0 ? Math.min(100, Math.round((min / targetMin) * 100)) : null };
}

export const DEFAULT_TALK_TARGET_MIN = 60;
export const dayStartOf = (now = Date.now()) => Math.floor((now + TZ) / DAY) * DAY - TZ;
