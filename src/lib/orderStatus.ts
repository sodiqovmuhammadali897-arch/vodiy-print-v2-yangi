import { getOne, insertOne, updateOne } from "./firestoreDb";
import type { Order, OrderStatus, StatusHistoryEntry } from "./types";
import { formatMoney } from "./format";

export type StatusActor = { email: string; name: string };

// Closing an order with unpaid debt still on it makes that debt easy to
// forget — the order drops out of every "active" view (production,
// dashboards, "joriy qarzdorlik" lists usually filter to non-closed
// orders) while the money is still owed. Blocking the transition keeps the
// order visibly open until someone actually records the missing payment.
export const changeOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  actor: StatusActor,
): Promise<void> => {
  if (status === "closed") {
    const order = await getOne<Order>("orders", orderId);
    const remaining = Number(order?.remaining_amount || 0);
    if (remaining > 0) {
      throw new Error(
        `Bu buyurtmada ${formatMoney(remaining)} qarzdorlik bor — avval to'lovni kiritmasdan yopib bo'lmaydi.`,
      );
    }
  }
  await updateOne("orders", orderId, {
    status,
    completed_at:
      status === "delivered" || status === "closed"
        ? new Date().toISOString()
        : null,
  });
  await insertOne<Omit<StatusHistoryEntry, "id">>("order_status_history", {
    order_id: orderId,
    status,
    changed_by_email: actor.email,
    changed_by_name: actor.name || actor.email,
    changed_at: new Date().toISOString(),
  });
};
