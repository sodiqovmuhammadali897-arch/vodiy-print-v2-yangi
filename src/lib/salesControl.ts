// Sotuv nazorati: one row per sales manager for today — calls (amoCRM),
// open deals without a next task or untouched, today's tasks, the month's
// sales against the manager's plan, unpaid delivered orders and the old
// customers to call (meta-webhook/recall.js). Each cell carries a flag:
// "bad" (red) past the limit, "warn" (yellow) worth a look.
import type { AmoLeadBrief, AmoMissed, AmoStat } from "./amoStats";
import type { AmoTaskDoc } from "./salesKpi";
import type { Manager, Order } from "./types";
import { saleDay } from "./salesPeriod";
import { isManagersOrder } from "./orderScope";

export type Flag = "bad" | "warn" | null;
export type StaffLite = { id: string; full_name?: string; report_manager_id?: string | null };
export type RecallCall = { id: string; day: string; manager_id: string; customer_name: string; status: string; result?: string; next_day?: string; reason?: string };
export type DebtOrder = { id: string; number: string; title: string; remaining: number; days: number };

export const LIMITS = {
  missed: 2, // more unanswered incoming calls than this → red
  firstCall: "09:30", // first call later than this → red
  noTask: 1, // more open deals without a next task than this → red
  staleBad: 2, // more deals untouched 3+ days than this → red
  behindPct: 15, // this many points behind today's share of the plan → red
  oldDebtDays: 14, // a delivered order unpaid this long → red
};

export type ControlRow = {
  email: string;
  name: string;
  manager_id: string | null;
  calls: number;
  talkSec: number;
  first: string | null;
  missed: AmoMissed[];
  open: number;
  noTask: AmoLeadBrief[];
  noTaskCount: number;
  stale: AmoLeadBrief[];
  staleCount: number;
  tasksDue: number;
  tasksOpen: number;
  plan: number;
  monthSales: number;
  todaySales: number;
  todayOrders: number;
  pct: number | null;
  forecast: number | null;
  debt: DebtOrder[];
  debtSum: number;
  recall: RecallCall[];
  flags: Record<"calls" | "first" | "missed" | "noTask" | "stale" | "tasks" | "plan" | "debt" | "recall", Flag>;
};

const live = (o: Order) => o.status !== "cancelled" && !(o as Order & { is_draft?: boolean }).is_draft;
const dayOfOrder = (o: Order) => saleDay(o);
const daysIn = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);

// How far into the month today is (the plan share expected by now).
export const monthShare = (today: string) => Number(today.slice(8, 10)) / daysIn(today.slice(0, 7));

export function buildRows({
  staff,
  managers,
  stats,
  tasks,
  orders,
  recall,
  today,
  nowHm,
}: {
  staff: StaffLite[];
  managers: Manager[];
  stats: AmoStat[];
  tasks: AmoTaskDoc[];
  orders: Order[];
  recall: RecallCall[];
  today: string;
  nowHm: string;
}): ControlRow[] {
  const month = today.slice(0, 7);
  const share = monthShare(today);
  const mgr = new Map(managers.map((m) => [m.id, m]));
  const person = new Map(staff.map((s) => [s.id.toLowerCase(), s]));
  const statOf = new Map(stats.filter((s) => s.staff_email && s.amo_user_id).map((s) => [s.staff_email!.toLowerCase(), s]));
  const taskOf = new Map(tasks.filter((t) => t.staff_email && t.amo_user_id).map((t) => [t.staff_email!.toLowerCase(), t]));
  // Everyone in amoCRM, and anyone with a sales plan.
  const emails = new Set([...statOf.keys(), ...taskOf.keys()]);
  for (const s of staff) {
    const m = s.report_manager_id ? mgr.get(s.report_manager_id) : null;
    if (m && Number(m.monthly_plan) > 0) emails.add(s.id.toLowerCase());
  }

  const rows: ControlRow[] = [];
  for (const email of emails) {
    const s = person.get(email);
    const managerId = s?.report_manager_id || null;
    const m = managerId ? mgr.get(managerId) : undefined;
    const st = statOf.get(email);
    const tk = taskOf.get(email);
    const t = st?.today && st.today.day === today ? st.today : null;
    // An order belongs to its manager by name, as everywhere in the ERP.
    const mine = m ? orders.filter((o) => live(o) && (isManagersOrder(o, m) || (Boolean(managerId) && o.manager_id === managerId))) : [];
    const inMonth = mine.filter((o) => dayOfOrder(o).slice(0, 7) === month);
    const todays = inMonth.filter((o) => dayOfOrder(o) === today);
    const monthSales = inMonth.reduce((a, o) => a + Number(o.total_amount || 0), 0);
    const plan = Number(m?.monthly_plan || 0);
    const pct = plan ? (monthSales / plan) * 100 : null;
    const debt = mine
      .filter((o) => Number(o.remaining_amount || 0) > 0 && (o.status === "delivered" || o.status === "closed"))
      .map((o) => ({ id: o.id, number: o.order_number || "", title: o.title || "", remaining: Number(o.remaining_amount || 0), days: daysBetween(dayOfOrder(o), today) }))
      .sort((a, b) => b.days - a.days);
    const myRecall = managerId ? recall.filter((r) => r.manager_id === managerId && r.day === today && r.status !== "carried") : [];
    const missed = t?.missed_open || [];
    const noTaskCount = tk?.no_task_leads || 0;
    const staleCount = st?.leads.stale || 0;
    const first = t?.first || null;
    const recallDone = myRecall.filter((r) => r.status === "done").length;

    rows.push({
      email,
      name: m?.name || s?.full_name || st?.name || email,
      manager_id: managerId,
      calls: t?.total || 0,
      talkSec: t?.talk_sec || 0,
      first,
      missed,
      open: st?.leads.open || 0,
      noTask: tk?.no_task_list || [],
      noTaskCount,
      stale: st?.stale_list || [],
      staleCount,
      tasksDue: tk?.today_due || 0,
      tasksOpen: tk?.today_open || 0,
      plan,
      monthSales,
      todaySales: todays.reduce((a, o) => a + Number(o.total_amount || 0), 0),
      todayOrders: todays.length,
      pct,
      forecast: plan || monthSales ? monthSales / share : null,
      debt,
      debtSum: debt.reduce((a, d) => a + d.remaining, 0),
      recall: myRecall,
      flags: {
        calls: st && nowHm >= "12:00" && (t?.total || 0) < 10 ? "warn" : null,
        first: !st ? null : first ? (first > LIMITS.firstCall ? "bad" : null) : nowHm > LIMITS.firstCall ? "bad" : null,
        missed: missed.length > LIMITS.missed ? "bad" : missed.length ? "warn" : null,
        noTask: noTaskCount > LIMITS.noTask ? "bad" : noTaskCount ? "warn" : null,
        stale: staleCount > LIMITS.staleBad ? "bad" : staleCount ? "warn" : null,
        tasks: tk && tk.overdue_open > 0 ? "warn" : null,
        plan: pct === null ? null : pct < share * 100 - LIMITS.behindPct ? "bad" : pct < share * 100 ? "warn" : null,
        debt: debt.some((d) => d.days > LIMITS.oldDebtDays) ? "bad" : debt.length ? "warn" : null,
        recall: myRecall.length && recallDone < myRecall.length ? (nowHm >= "19:00" ? "bad" : "warn") : null,
      },
    });
  }
  return rows.sort((a, b) => b.monthSales - a.monthSales || a.name.localeCompare(b.name));
}

// The red/yellow lines for the top «Diqqat» card: "Maryam: 3 javobsiz, …".
export const attention = (rows: ControlRow[]) =>
  rows
    .map((r) => {
      const parts: string[] = [];
      if (r.flags.first === "bad") parts.push(r.first ? `birinchi qo'ng'iroq ${r.first}` : "hali qo'ng'iroq yo'q");
      if (r.missed.length) parts.push(`${r.missed.length} javobsiz`);
      if (r.noTaskCount) parts.push(`${r.noTaskCount} vazifasiz bitim`);
      if (r.flags.stale === "bad") parts.push(`${r.staleCount} harakatsiz bitim`);
      if (r.flags.plan === "bad" && r.pct !== null) parts.push(`reja ${Math.round(r.pct)}%`);
      if (r.flags.debt === "bad") parts.push("eski qarz");
      return parts.length ? { name: r.name, text: parts.join(", ") } : null;
    })
    .filter((x): x is { name: string; text: string } => Boolean(x));
