import { getOne, insertOne, listWhere } from "./firestoreDb";
import { DEFAULT_SALES_KPI, ratesFor, type KpiMonth, type SalesKpiSettings } from "./salesKpi";
import { CELEBRATE_EVENT, kpiBonus, type CelebrateDetail, type Celebration } from "./celebrate";
import type { Manager } from "./types";

// After a new real order is saved (OrderWizard): everyone else gets a toast
// (celebrations/{id}); a seller who saved it gets the dialog with the KPI
// part of this order — the rate exactly as the KPI page takes it (the
// month's own rate, else the manager's, else the KPI settings').
export async function announceOrder(o: {
  total: number;
  orderNumbers: string[];
  orderId: string;
  customer: string;
  managerName: string;
  actor: { email: string; name: string; managerId: string | null | undefined };
}): Promise<void> {
  const now = new Date();
  const row: Celebration = {
    manager_name: o.managerName || o.actor.name,
    created_by_email: o.actor.email,
    created_by_name: o.actor.name,
    customer: o.customer,
    total: o.total,
    order_numbers: o.orderNumbers,
    order_id: o.orderId,
    created_at: now.toISOString(),
  };
  if (o.actor.managerId) {
    let ratePct = DEFAULT_SALES_KPI.sales_rate;
    try {
      const month = new Date(now.getTime() + 5 * 3600e3).toISOString().slice(0, 7);
      const [manager, settings, months] = await Promise.all([
        getOne<Manager>("managers", o.actor.managerId).catch(() => null),
        getOne<SalesKpiSettings>("kpi_settings", "sales").catch(() => null),
        listWhere<KpiMonth>("kpi_months", "manager_id", o.actor.managerId).catch(() => [] as KpiMonth[]),
      ]);
      const s = { ...DEFAULT_SALES_KPI, ...(settings || {}) };
      ratePct = manager ? ratesFor(manager, months.find((m) => m.month === month) || null, s).sales_rate : s.sales_rate;
    } catch {
      // keep the default
    }
    const detail: CelebrateDetail = { ...row, ratePct, kpi: kpiBonus(o.total, ratePct) };
    window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail }));
  }
  await insertOne("celebrations", row as unknown as Record<string, unknown>).catch(() => undefined);
}
