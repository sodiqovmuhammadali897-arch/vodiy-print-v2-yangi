import { getOne, insertOne, listAll, listWhere } from "./firestoreDb";
import { DEFAULT_SALES_KPI, ratesFor, type KpiMonth, type SalesKpiSettings } from "./salesKpi";
import { CELEBRATE_EVENT, kpiBonus, orderManagerOf, type CelebrateDetail, type Celebration } from "./celebrate";
import type { Manager } from "./types";

// After a new real order is saved (OrderWizard): whoever saved it gets the
// dialog (a seller — «Tabriklayman»; the owner/an admin — «X yangi buyurtma
// oldi»), with the KPI part of the order's manager — the rate exactly as the
// KPI page takes it (the month's own rate, else the manager's, else the KPI
// settings'). `celebrations/{id}` carries it to everyone else: the order's
// manager gets the full dialog, the rest a toast.
export async function announceOrder(o: {
  total: number;
  orderNumbers: string[];
  orderId: string;
  customer: string;
  managerName: string;
  actor: { email: string; name: string; managerId: string | null | undefined };
}): Promise<void> {
  const now = new Date();
  const managers = await listAll<Manager>("managers").catch(() => [] as Manager[]);
  const mgr = orderManagerOf(managers, o.managerName, o.actor.managerId);
  let ratePct = DEFAULT_SALES_KPI.sales_rate;
  try {
    const month = new Date(now.getTime() + 5 * 3600e3).toISOString().slice(0, 7);
    const [settings, months] = await Promise.all([
      getOne<SalesKpiSettings>("kpi_settings", "sales").catch(() => null),
      mgr ? listWhere<KpiMonth>("kpi_months", "manager_id", mgr.id).catch(() => [] as KpiMonth[]) : Promise.resolve([] as KpiMonth[]),
    ]);
    const s = { ...DEFAULT_SALES_KPI, ...(settings || {}) };
    ratePct = mgr ? ratesFor(mgr, months.find((m) => m.month === month) || null, s).sales_rate : s.sales_rate;
  } catch {
    // keep the default
  }
  const kpi = kpiBonus(o.total, ratePct);
  const row: Celebration = {
    manager_name: mgr?.name || o.managerName || o.actor.name,
    created_by_email: o.actor.email,
    created_by_name: o.actor.name,
    customer: o.customer,
    total: o.total,
    order_numbers: o.orderNumbers,
    order_id: o.orderId,
    created_at: now.toISOString(),
    manager_id: mgr?.id || "",
    kpi: mgr ? kpi : 0,
    rate_pct: ratePct,
  };
  const mine = !!mgr && !!o.actor.managerId && mgr.id === o.actor.managerId;
  const detail: CelebrateDetail = { ...row, ratePct, kpi, mine: mine || (!mgr && !!o.actor.managerId), hasManager: !!mgr };
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail }));
  await insertOne("celebrations", row as unknown as Record<string, unknown>).catch(() => undefined);
}
