import { useEffect, useMemo, useState } from "react";
import { listAll, subscribeAll, subscribeWhere } from "../../../lib/firestoreDb";
import { useAuth } from "../../../lib/AuthContext";
import type { Staff } from "../../../lib/permissions";
import type { Lead, LeadTask, Order } from "../../../lib/types";
import type { Actor } from "../../../lib/crmService";

// Live leads, lead tasks (own, or everyone's for an admin), the orders the
// converted leads point to, and the sellers a lead can be given to.
export function useCrm() {
  const auth = useAuth();
  const email = (auth.user?.email || "").toLowerCase();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [orders, setOrders] = useState<Record<string, Pick<Order, "status" | "order_number" | "total_amount" | "created_at">>>({});
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onErr = (e: Error) => setError(e.message);
    const offLeads = subscribeAll<Lead>("leads", (rows) => setLeads(rows), undefined);
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
  }, [auth.isAdmin, email]);

  const actor: Actor = useMemo(() => ({ email, name: auth.staff?.full_name || email }), [email, auth.staff?.full_name]);
  // Who can own a lead: sellers (linked to Managerlar or allowed to edit leads).
  const sellers = useMemo(
    () =>
      staff
        .filter((s) => s.report_manager_id || s.permissions?.leads?.edit)
        .map((s) => ({ email: s.email.toLowerCase(), name: s.full_name || s.email }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff],
  );
  return { leads, tasks, orders, sellers, actor, isAdmin: auth.isAdmin, email, error };
}
