// Example data hook mock (for src/modules/kpi/useKpiMonth.ts).
import { computeKpi, DEFAULT_SALES_KPI } from "/home/user/vodiy-print-v2-yangi/src/lib/salesKpi";
const q = new URLSearchParams(location.search);
const month0 = q.get("m");
const mk = (id: string, name: string, plan: number, sales: number, collected: number, att: number, amo: number | null, debt: number, status = "open") => {
  const rates = { plan, sales_rate: 7.5, collect_rate: 2 };
  const result = computeKpi({ sales, collected, rates, threshold: 80, attendancePct: att, attendanceLinked: true, amoPct: amo });
  const orders = [
    { id: "o1", n: "VP-560", title: "Daftar", customer: "Ziyokor school", total: 4_300_000, date: "2026-11-20" },
    { id: "o2", n: "VP-558", title: "Paket", customer: "Megaton", total: 8_100_000, date: "2026-11-21" },
    { id: "o3", n: "VP-551", title: "Vizitka", customer: "Rahimov School", total: 1_200_000, date: "2026-11-18" },
    { id: "o4", n: "VP-540", title: "Banner", customer: "Oila market", total: 2_000_000, date: "2026-11-05" },
  ];
  return {
    manager: { id, name, monthly_plan: plan }, staff: { email: id + "@vp.uz", full_name: name, report_manager_id: id },
    sales: { id, month: "2026-11", manager_id: id, manager_name: name, sales, collected, debt, order_count: 14, orders, payments: [{ id: "p1", order_id: "o1", n: "VP-560", amount: 3_000_000, date: "2026-11-20" }], updated_at: "" },
    salesSum: sales, collectedSum: collected, kpiMonth: status === "open" ? null : { status, snapshot: {} }, rates,
    attendance: { lateCount: 2, lateMinutes: 25, earlyCount: 0, absent: 1, presencePct: att }, attendancePct: att,
    amo: amo === null ? null : { due: 50, on_time: Math.round(amo / 2), overdue_open: 3, no_task_leads: 2, today_due: 4, today_open: 1 }, amoPct: amo,
    result, frozen: status !== "open", stale: status === "paid" ? { sales: 130.4e6, collected: 105.1e6, payout: 9_780_000 } : null, paidBefore: status === "approved" ? 1_148_183 : 0,
  };
};
export function useKpiMonth(month: string, only: any) {
  const past = month < "2026-11";
  const rows = [
    mk("m1", "Muhammadiyor", 230e6, past ? 210e6 : 142e6, past ? 160e6 : 65e6, 95, 88, 12e6, past ? "paid" : "open"),
    mk("m2", "Nuriddin", 200e6, past ? 150e6 : 99e6, past ? 70e6 : 40e6, 90, 81, 5e6, past ? "approved" : "open"),
    mk("m3", "Maryam", 200e6, past ? 120e6 : 148e6, past ? 60e6 : 87e6, 92, 76, 22.5e6),
  ];
  return { rows: only ? rows.filter((r) => r.manager.id === only.managerId) : rows, settings: DEFAULT_SALES_KPI, error: null, reload: () => {} };
}
