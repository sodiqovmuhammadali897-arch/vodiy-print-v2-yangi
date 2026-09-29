import { useEffect, useState } from "react";
import { listAll } from "./firestoreDb";
import { useAuth } from "./AuthContext";
import type { Staff } from "./permissions";
import type { Manager, Order } from "./types";

// Whether a staff member sees only their own orders (Buyurtmalar, Bosh
// sahifa, Hisobot) or the whole company's. Set by an admin in Sozlamalar >
// Xodimlar: "own" needs a link to a Managerlar record (report_manager_id),
// which says whose orders are theirs. A linked account without an explicit
// choice stays "own", as Hisobot always behaved. Production and Textil
// pages always list every order.
export const ownOrdersOnly = (staff: Pick<Staff, "report_manager_id" | "orders_scope"> | null | undefined): boolean =>
  !!staff?.report_manager_id && staff.orders_scope !== "all";

export const isManagersOrder = (order: Pick<Order, "manager_name">, manager: Pick<Manager, "name"> | null): boolean =>
  !!manager && (order.manager_name || "").trim().toLowerCase() === manager.name.trim().toLowerCase();

// For pages that filter orders: `own` is true when the list must be
// narrowed to `manager`'s orders (manager is null while loading, or when
// the linked record was deleted — then nothing matches).
export function useOrderScope() {
  const { staff } = useAuth();
  const own = ownOrdersOnly(staff);
  const [manager, setManager] = useState<Manager | null>(null);
  const [ready, setReady] = useState(!own);

  useEffect(() => {
    if (!own) {
      setManager(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void listAll<Manager>("managers")
      .then((rows) => !cancelled && setManager(rows.find((m) => m.id === staff?.report_manager_id) || null))
      .catch(() => !cancelled && setManager(null))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [own, staff?.report_manager_id]);

  const visible = <T extends Pick<Order, "manager_name">>(orders: T[]): T[] =>
    own ? orders.filter((o) => isManagersOrder(o, manager)) : orders;

  return { own, manager, ready, visible, canSee: (o: Pick<Order, "manager_name">) => !own || isManagersOrder(o, manager) };
}
