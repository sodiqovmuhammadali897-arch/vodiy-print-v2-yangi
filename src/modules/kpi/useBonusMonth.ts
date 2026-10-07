import { useCallback, useEffect, useState } from "react";
import { getOne, listAll, listRange, listWhere } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type Holiday, type KpiSettings, type LeaveRequest, type Manager, type Order, type PersonalSchedule, type Task } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule, listPersonalSchedules } from "../../services/attendanceService";
import { buildAnalytics } from "../../lib/attendanceAnalytics";
import { dateCodeOf, offDaysOf } from "../../utils/attendanceCalculations";
import type { AmoStat } from "../../lib/amoStats";
import {
  computeBonus,
  DEFAULT_BONUS_SETTINGS,
  goalPlan,
  monthWorkDays,
  type GoalPlan,
  managerOrders,
  planScore,
  taskScore,
  type BonusResult,
  type BonusSettings,
  type KpiMonth,
  type OrderBonus,
} from "../../lib/managerBonus";

// Everything one month of KPI va bonus needs, per manager. The admin loads
// all managers; a manager account loads only its own (the Firestore rules
// only let it read its own bonuses, tasks and attendance).

export type BonusRow = {
  manager: Manager;
  staff: Staff | null; // the employee account linked to this manager
  orders: Order[];
  bonuses: Map<string, OrderBonus>; // by order id
  turnover: number;
  plan: number;
  fund: number;
  unpriced: number; // orders of the month with no bonus written
  tasks: ReturnType<typeof taskScore>;
  attendancePct: number | null;
  kpiMonth: KpiMonth | null;
  result: BonusResult;
  frozen: boolean; // approved/paid: numbers come from the snapshot
  // Maqsad kalkulyatori: the goal set for the month and what it takes.
  goal: number | null;
  rate: number; // bonus as % of turnover, last 3 months (else the default)
  rateFromHistory: boolean;
  avgCheck: number | null;
  conversion: number | null; // amoCRM, last 3 months
  goalPlan: GoalPlan | null;
};

// "2026-10" → ["2026-08", "2026-09", "2026-10"].
const lastMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
};

const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const nowMinute = () => {
  const d = new Date(Date.now() + 5 * 3600e3);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

export function useBonusMonth(month: string, only: { managerId: string; email: string } | null) {
  const [rows, setRows] = useState<BonusRow[] | null>(null);
  const [settings, setSettings] = useState<BonusSettings>(DEFAULT_BONUS_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    void (async () => {
      try {
        const from = `${month}-01`;
        const to = monthEnd(month);
        const today = dateCodeOf(new Date());
        const window3 = lastMonths(month, 3);
        const [managers, staff, orders, bonuses, tasks, attendance, leaves, holidays, general, personal, kpiSettings, bonusSettings, months, amo] = await Promise.all([
          listAll<Manager>("managers"),
          listAll<Staff>("staff"),
          listAll<Order>("orders"),
          only
            ? listWhere<OrderBonus>("order_bonuses", "manager_id", only.managerId)
            : Promise.all(window3.map((m) => listWhere<OrderBonus>("order_bonuses", "month", m))).then((x) => x.flat()),
          only ? listWhere<Task>("tasks", "assigned_to_email", only.email) : listAll<Task>("tasks"),
          only
            ? listWhere<AttendanceRecord>("attendance", "employeeId", only.email).then((r) => r.filter((x) => x.dateCode >= from && x.dateCode <= to))
            : listRange<AttendanceRecord>("attendance", "dateCode", from, to),
          (only ? listWhere<LeaveRequest>("leave_requests", "employeeId", only.email) : listAll<LeaveRequest>("leave_requests")).catch(() => [] as LeaveRequest[]),
          listAll<Holiday>("holidays").catch(() => [] as Holiday[]),
          getWorkSchedule(),
          listPersonalSchedules().catch(() => new Map<string, PersonalSchedule>()),
          getOne<KpiSettings>("kpi_settings", "default").catch(() => null),
          getOne<BonusSettings & { id: string }>("kpi_settings", "bonus").catch(() => null),
          only ? listWhere<KpiMonth>("kpi_months", "manager_id", only.managerId) : listWhere<KpiMonth>("kpi_months", "month", month),
          (only
            ? listWhere<AmoStat>("amo_stats", "staff_email", only.email)
            : Promise.all(window3.map((m) => listWhere<AmoStat>("amo_stats", "month", m))).then((x) => x.flat())
          ).catch(() => [] as AmoStat[]),
        ]);
        if (cancelled) return;
        const s: BonusSettings = { ...DEFAULT_BONUS_SETTINGS, ...(bonusSettings || {}) };
        const bonusByOrder = new Map(bonuses.map((b) => [b.order_id, b]));
        const monthById = new Map(months.filter((m) => m.month === month).map((m) => [m.manager_id, m]));
        const days = monthWorkDays(month, today, offDaysOf(general));
        const list = (only ? managers.filter((m) => m.id === only.managerId) : managers).map((manager): BonusRow => {
          const linked = staff.find((x) => x.report_manager_id === manager.id) || null;
          const email = linked?.email.toLowerCase() || "";
          const mine = managerOrders(orders, manager.name, month);
          const own = new Map(mine.filter((o) => bonusByOrder.has(o.id)).map((o) => [o.id, bonusByOrder.get(o.id)!]));
          const turnover = mine.reduce((t, o) => t + Number(o.total_amount || 0), 0);
          const fund = [...own.values()].reduce((t, b) => t + Number(b.amount || 0), 0);
          const plan = Number(manager.monthly_plan || 0);
          const t = taskScore(email ? tasks.filter((x) => String(x.assigned_to_email || "").toLowerCase() === email) : [], month, today);
          const att = email
            ? buildAnalytics({
                from,
                to,
                today,
                nowMinute: nowMinute(),
                staff: [{ email, full_name: linked?.full_name }],
                general,
                personal,
                records: attendance,
                leaves,
                holidays,
                weights: kpiSettings?.weights || DEFAULT_KPI_WEIGHTS,
              }).staff[0]
            : null;
          const kpiMonth = monthById.get(manager.id) || null;
          const frozen = !!kpiMonth?.snapshot && kpiMonth.status !== "open";
          const live = computeBonus(
            fund,
            {
              plan: planScore(turnover, plan, s.plan_floor, s.plan_cap),
              tasks: email ? t.score : null,
              attendance: att?.kpiPct ?? null,
              crm: kpiMonth?.crm_score ?? null,
            },
            s.weights,
          );
          // Goal calculator inputs: this manager's last three months.
          const recent = window3.flatMap((m) => managerOrders(orders, manager.name, m));
          const priced = recent.filter((o) => bonusByOrder.has(o.id));
          const pricedTotal = priced.reduce((t, o) => t + Number(o.total_amount || 0), 0);
          const pricedBonus = priced.reduce((t, o) => t + Number(bonusByOrder.get(o.id)!.amount || 0), 0);
          const rateFromHistory = pricedTotal > 0 && pricedBonus > 0;
          const rate = rateFromHistory ? (pricedBonus / pricedTotal) * 100 : Number(s.default_rate ?? 5);
          const avgCheck = recent.length ? recent.reduce((t, o) => t + Number(o.total_amount || 0), 0) / recent.length : null;
          const amoMine = amo.filter(
            (a) => window3.includes(a.month) && ((linked?.amo_user_id && a.amo_user_id === linked.amo_user_id) || (email && String(a.staff_email || "").toLowerCase() === email)),
          );
          const created = amoMine.reduce((t, a) => t + Number(a.leads?.created || 0), 0);
          const won = amoMine.reduce((t, a) => t + Number(a.leads?.won || 0), 0);
          const conversion = created > 0 && won > 0 ? (won / created) * 100 : null;
          const goal = kpiMonth?.goal ?? null;
          const scores = frozen ? kpiMonth!.snapshot!.scores : live.scores;
          const plan_ = goal
            ? goalPlan({ goal, rate, scores, weights: s.weights, turnover, workDays: days.total, daysDone: days.done, avgCheck, conversion })
            : null;
          return {
            goal,
            rate,
            rateFromHistory,
            avgCheck,
            conversion,
            goalPlan: plan_,
            manager,
            staff: linked,
            orders: mine,
            bonuses: own,
            turnover: frozen ? kpiMonth!.snapshot!.turnover : turnover,
            plan: frozen ? kpiMonth!.snapshot!.plan : plan,
            fund: frozen ? kpiMonth!.snapshot!.fund : fund,
            unpriced: mine.length - own.size,
            tasks: t,
            attendancePct: att?.kpiPct ?? null,
            kpiMonth,
            result: frozen ? kpiMonth!.snapshot! : live,
            frozen,
          };
        });
        setSettings(s);
        setRows(list.sort((a, b) => b.fund - a.fund || a.manager.name.localeCompare(b.manager.name)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, only?.managerId, only?.email, version]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, settings, error, reload };
}
