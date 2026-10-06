import { useCallback, useEffect, useState } from "react";
import { getOne, listAll, listRange, listWhere } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type Holiday, type KpiSettings, type LeaveRequest, type Manager, type Order, type PersonalSchedule, type Task } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule, listPersonalSchedules } from "../../services/attendanceService";
import { buildAnalytics } from "../../lib/attendanceAnalytics";
import { dateCodeOf } from "../../utils/attendanceCalculations";
import {
  computeBonus,
  DEFAULT_BONUS_SETTINGS,
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
        const [managers, staff, orders, bonuses, tasks, attendance, leaves, holidays, general, personal, kpiSettings, bonusSettings, months] = await Promise.all([
          listAll<Manager>("managers"),
          listAll<Staff>("staff"),
          listAll<Order>("orders"),
          only ? listWhere<OrderBonus>("order_bonuses", "manager_id", only.managerId) : listWhere<OrderBonus>("order_bonuses", "month", month),
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
        ]);
        if (cancelled) return;
        const s: BonusSettings = { ...DEFAULT_BONUS_SETTINGS, ...(bonusSettings || {}) };
        const bonusByOrder = new Map(bonuses.map((b) => [b.order_id, b]));
        const monthById = new Map(months.filter((m) => m.month === month).map((m) => [m.manager_id, m]));
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
          return {
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
