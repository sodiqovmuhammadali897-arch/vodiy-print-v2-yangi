import type { OrderStatus } from "../../lib/types";
import { ORDER_STATUSES, orderStatusClass, orderStatusLabel } from "../../lib/orderConstants";

export const ORDER_STATUS_OPTIONS: OrderStatus[] = ORDER_STATUSES.map((s) => s.key);
export { orderStatusLabel };

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${orderStatusClass(status)}`}>{orderStatusLabel(status)}</span>;
}
