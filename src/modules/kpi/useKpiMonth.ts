import { useCallback, useEffect, useMemo, useState } from "react";
import { getOne, listAll, listRange, listWhere, subscribeWhere } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type Holiday, type LeaveRequest, type Manager, type PersonalSchedule, type WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule, listPersonalSchedules } from "../../services/attendanceService";
import { buildAnalytics, type StaffSummary } from "../../lib/attendanceAnalytics";
import { dateCodeOf } from "../../utils/attendanceCalculations";
import { computeKpi, DEFAULT_SALES_KPI, ratesFor, type KpiMonth, type KpiResult, type Rates, type SalesKpiDoc, type SalesKpiSettings } from "../../lib/salesKpi";

// One month of KPI, per manager: the server's live sums (kpi_sales), the
// month's plan and rates, attendance worked out here, and the result. The
// admin sees every manager; a manager account only itself (the rules only
// let it read its own).

export type KpiRow = {
  manager: Manager;
  staff: Staff | null; // the employee account linked to this manager
  sales: SalesKpiDoc | null;
  salesSum: number; // the snapshot's once approved
  collectedSum: number;
  kpiMonth: KpiMonth | null;
  rates: Rates;
  attendance: StaffSummary | null;
  attendancePct: number | null;
  amoPct: number | null;
  result: KpiResult;
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

type Base = {
  managers: Manager[];
  staff: Staff[];
  months: KpiMonth[];
  settings: SalesKpiSettings;
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  holidays: Holiday[];
  general: WorkSchedule;
  personal: Map<string, PersonalSchedule>;
};

export function useKpiMonth(month: string, only: { managerId: string; email: string } | null) {
  const [base, setBase] = useState<Base | null>(null);
  const [sales, setSales] = useState<SalesKpiDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const from = `${month}-01`;
        const to = monthEnd(month);
        const [managers, staff, months, settings, attendance, leaves, holidays, general, personal] = await Promise.all([
          only ? getOne<Manager>("managers", only.managerId).then((m) => (m ? [m] : [])) : listAll<Manager>("managers"),
          only ? Promise.resolve([] as Staff[]) : listAll<Staff>("staff"),
          only ? listWhere<KpiMonth>("kpi_months", "manager_id", only.managerId) : listWhere<KpiMonth>("kpi_months", "month", month),
          getOne<SalesKpiSettings & { id: string }>("kpi_settings", "sales").catch(() => null),
          only
            ? listWhere<AttendanceRecord>("attendance", "employeeId", only.email).then((r) => r.filter((x) => x.dateCode >= from && x.dateCode <= to))
            : listRange<AttendanceRecord>("attendance", "dateCode", from, to),
          (only ? listWhere<LeaveRequest>("leave_requests", "employeeId", only.email) : listAll<LeaveRequest>("leave_requests")).catch(() => [] as LeaveRequest[]),
          listAll<Holiday>("holidays").catch(() => [] as Holiday[]),
          getWorkSchedule(),
          listPersonalSchedules().catch(() => new Map<string, PersonalSchedule>()),
        ]);
        if (cancelled) return;
        setBase({
          managers,
          staff,
          months: months.filter((m) => m.month === month),
          settings: { ...DEFAULT_SALES_KPI, ...(settings || {}) },
          attendance,
          leaves,
          holidays,
          general,
          personal,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, only?.managerId, only?.email, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sums change with every order and payment: listen.
  useEffect(() => {
    setSales(null);
    const onError = (e: Error) => setError(e.message);
    return only
      ? subscribeWhere<SalesKpiDoc>("kpi_sales", "manager_id", only.managerId, (rows) => setSales(rows.filter((r) => r.month === month)), undefined, onError)
      : subscribeWhere<SalesKpiDoc>("kpi_sales", "month", month, setSales, undefined, onError);
  }, [month, only?.managerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo((): KpiRow[] | null => {
    if (!base || !sales) return null;
    const today = dateCodeOf(new Date());
    const linked = (m: Manager): Staff | null =>
      only ? ({ email: only.email, full_name: m.name, report_manager_id: m.id } as Staff) : base.staff.find((s) => s.report_manager_id === m.id) || null;
    const people = base.managers.map(linked).filter((s): s is Staff => !!s);
    const analytics = buildAnalytics({
      from: `${month}-01`,
      to: monthEnd(month),
      today,
      nowMinute: nowMinute(),
      staff: people.map((s) => ({ email: s.email, full_name: s.full_name })),
      general: base.general,
      personal: base.personal,
      records: base.attendance,
      leaves: base.leaves,
      holidays: base.holidays,
      weights: DEFAULT_KPI_WEIGHTS,
    });
    const byEmail = new Map(analytics.staff.map((s) => [s.email, s]));
    const salesBy = new Map(sales.map((s) => [s.manager_id, s]));
    const monthBy = new Map(base.months.map((m) => [m.manager_id, m]));
    return base.managers
      .map((manager): KpiRow => {
        const st = linked(manager);
        const s = salesBy.get(manager.id) || null;
        const kpiMonth = monthBy.get(manager.id) || null;
        const rates = ratesFor(manager, kpiMonth, base.settings);
        const attendance = st ? byEmail.get(st.email.toLowerCase()) || null : null;
        const attendancePct = month > today.slice(0, 7) ? null : attendance?.presencePct ?? null;
        const amoPct = null; // amoCRM tasks: next stage
        const snap = kpiMonth?.status !== "open" ? kpiMonth?.snapshot : null;
        const live = computeKpi({
          sales: s?.sales || 0,
          collected: s?.collected || 0,
          rates,
          threshold: base.settings.threshold,
          attendancePct,
          attendanceLinked: !!st,
          amoPct,
        });
        const result: KpiResult = snap
          ? {
              salesBonus: snap.sales_bonus,
              collectPotential: Math.round((snap.collected * snap.collect_rate) / 100),
              collectBonus: snap.collect_bonus,
              attendanceOk: snap.attendance_pct === null || snap.attendance_pct >= snap.threshold,
              amoOk: snap.amo_pct === null || snap.amo_pct >= snap.threshold,
              eligible: snap.eligible,
              payout: snap.payout,
              planPct: snap.plan > 0 ? (snap.sales / snap.plan) * 100 : null,
            }
          : live;
        return {
          manager,
          staff: st,
          sales: s,
          salesSum: snap ? snap.sales : s?.sales || 0,
          collectedSum: snap ? snap.collected : s?.collected || 0,
          kpiMonth,
          rates: snap ? { plan: snap.plan, sales_rate: snap.sales_rate, collect_rate: snap.collect_rate } : rates,
          attendance,
          attendancePct: snap ? snap.attendance_pct : attendancePct,
          amoPct: snap ? snap.amo_pct : amoPct,
          result,
          frozen: !!snap,
        };
      })
      .sort((a, b) => b.result.payout - a.result.payout || a.manager.name.localeCompare(b.manager.name));
  }, [base, sales, month, only?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, settings: base?.settings || DEFAULT_SALES_KPI, error, reload };
}
