import { insertOne, updateOne } from "./firestoreDb";
import type { OrderStatus, StatusHistoryEntry } from "./types";

export type StatusActor = { email: string; name: string };

export const changeOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  actor: StatusActor,
): Promise<void> => {
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
