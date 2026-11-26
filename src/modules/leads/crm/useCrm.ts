import { useEffect, useMemo, useState } from "react";
import { listAll, subscribeAll, subscribeOne, subscribeWhere } from "../../../lib/firestoreDb";
import { applyCrmSettings, type CrmSettingsDoc } from "../../../lib/crmSettings";
import { useAuth } from "../../../lib/AuthContext";
import type { Staff } from "../../../lib/permissions";
import type { Lead, LeadTask, Order } from "../../../lib/types";
import type { Actor } from "../../../lib/crmService";

// Live leads, lead tasks (own, or everyone's for an admin), the orders the
// converted leads point to, and the sellers a lead can be given to.
// `enabled` false: no subscriptions (the caller got the data from a parent —
// Sotuv bo'limi reads it once for all its sections).
export function useCrm(enabled = true) {
  const auth = useAuth();
  const email = (auth.user?.email || "").toLowerCase();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [orders, setOrders] = useState<Record<string, Pick<Order, "status" | "order_number" | "total_amount" | "created_at">>>({});
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Sotuv bo'limi → Sozlamalar: stages, names, types (crmSettings.ts). A new
  // version re-renders every CRM screen with the owner's names.
  const [settingsVersion, setSettingsVersion] = useState(0);
  useEffect(
    () =>
      subscribeOne<CrmSettingsDoc>("crm_settings", "main", (d) => {
        applyCrmSettings(d);
        setSettingsVersion((v) => v + 1);
      }),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const onErr = (e: Error) => setError(e.message);
    // A manager sees only their own leads, and the new ones nobody took yet
    // (to take with «Qabul qildim») — the owner, 2026-11-26: «sotuv
    // bo'limida faqat manager o'zini ma'lumotlari o'ziga ko'rinsin».
    const offLeads = subscribeAll<Lead>("leads", (rows) => setLeads(auth.isAdmin ? rows : rows.filter((l) => visibleToManager(l, email))), undefined);
    const offTasks = auth.isAdmin
      ? subscribeAll<LeadTask>("lead_tasks", setTasks)
      : subscribeWhere<LeadTask>("lead_tasks", "assigned_to_email", email, setTasks, undefined, onErr);
    const offOrders = subscribeAll<Order>("orders", (rows) => setOrders(Object.fromEntries(rows.map((o) => [o.id, { status: o.status, order_number: o.order_number, total_amount: o.total_amount, created_at: o.created_at }]))));
    void listAll<Staff & { id: string }>("staff")
      .then((rows) => setStaff(rows))
      .catch(() => setStaff([]));
    return () => {
      offLeads();
      offTasks();
      offOrders();
    };
  }, [auth.isAdmin, email, enabled]);

  const actor: Actor = useMemo(() => ({ email, name: auth.staff?.full_name || email }), [email, auth.staff?.full_name]);
  // Who can own a lead: sellers (linked to Managerlar or allowed to edit leads).
  const sellers = useMemo(
    () =>
      staff
        .filter((s) => s.report_manager_id || s.permissions?.leads?.edit)
        .map((s) => ({ email: s.email.toLowerCase(), name: s.full_name || s.email, managerId: s.report_manager_id || "" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff],
  );
  return { leads, tasks, orders, sellers, actor, isAdmin: auth.isAdmin, email, error, settingsVersion };
}
export type CrmData = ReturnType<typeof useCrm>;

// A manager's own lead, or a new one nobody has taken.
export const visibleToManager = (l: Pick<Lead, "assigned_to_email" | "status">, email: string) =>
  String(l.assigned_to_email || "").toLowerCase() === email || (!l.assigned_to_email && (l.status === "new" || !l.status));
