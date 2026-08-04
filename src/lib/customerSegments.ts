import type { Order } from "./types";
import { inRange, type DateRange } from "./dateRange";

export type CustomerSegmentSummary = {
  newCount: number;
  newRevenue: number;
  returningCount: number;
  returningRevenue: number;
};

// Classifies customers who ordered within `range` as "new" (their very
// first order ever falls inside the range) or "returning" (they had
// already ordered before the range started), based on full order history.
export const segmentCustomersByFirstOrder = (
  allOrders: Order[],
  range: DateRange,
): CustomerSegmentSummary => {
  const active = allOrders.filter((o) => o.status !== "cancelled" && o.customer_id);

  const firstOrderDate = new Map<string, string>();
  for (const o of active) {
    const d = o.order_date || o.created_at;
    if (!d) continue;
    const cur = firstOrderDate.get(o.customer_id!);
    if (!cur || d < cur) firstOrderDate.set(o.customer_id!, d);
  }

  const ordersInRange = active.filter((o) => inRange(o.order_date || o.created_at, range));

  const newRevenueByCustomer = new Map<string, number>();
  const returningRevenueByCustomer = new Map<string, number>();

  for (const o of ordersInRange) {
    const cid = o.customer_id!;
    const first = firstOrderDate.get(cid);
    const isNew = !!first && inRange(first, range);
    const map = isNew ? newRevenueByCustomer : returningRevenueByCustomer;
    map.set(cid, (map.get(cid) || 0) + Number(o.total_amount || 0));
  }

  const sum = (m: Map<string, number>) =>
    Array.from(m.values()).reduce((s, v) => s + v, 0);

  return {
    newCount: newRevenueByCustomer.size,
    newRevenue: sum(newRevenueByCustomer),
    returningCount: returningRevenueByCustomer.size,
    returningRevenue: sum(returningRevenueByCustomer),
  };
};
