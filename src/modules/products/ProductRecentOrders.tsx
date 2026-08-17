import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import type { Customer, Order, OrderProduct, Product } from "../../lib/types";
import { getOne, listWhere } from "../../lib/firestoreDb";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";

type Props = { product: Product };

type Row = {
  orderId: string;
  orderNumber: string | null;
  customerName: string;
  date: string;
  quantity: number;
  total: number;
  status: Order["status"];
};

const RECENT_LIMIT = 8;

export default function ProductRecentOrders({ product }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listWhere<OrderProduct>("order_products", "product_name", product.name).then(async (items) => {
      const orderIds = Array.from(new Set(items.map((it) => it.order_id))).slice(0, 60);
      const orders = await Promise.all(orderIds.map((id) => getOne<Order>("orders", id)));
      const orderById = new Map(orders.filter((o): o is (Order & { id: string }) => !!o).map((o) => [o.id, o]));

      const custIds = Array.from(new Set(orders.map((o) => o?.customer_id).filter((x): x is string => !!x)));
      const customers = await Promise.all(custIds.map((id) => getOne<Customer>("customers", id)));
      const custById = new Map(customers.filter((c): c is Customer & { id: string } => !!c).map((c) => [c.id, c]));

      const built: Row[] = items
        .map((it) => {
          const o = orderById.get(it.order_id);
          if (!o) return null;
          const customer = o.customer_id ? custById.get(o.customer_id) : null;
          return {
            orderId: o.id,
            orderNumber: o.order_number,
            customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : o.title || "-",
            date: o.order_date || o.created_at,
            quantity: it.quantity,
            total: it.total,
            status: o.status,
          };
        })
        .filter((r): r is Row => !!r)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, RECENT_LIMIT);

      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [product.name]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">So'nggi buyurtmalar</h2>
      </div>
      <div className="divide-y divide-ink-100">
        {rows.map((r) => (
          <Link
            key={r.orderId + r.quantity}
            to={`/orders/${r.orderId}`}
            className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-ink-50/60"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink-900">{r.customerName}</div>
              <div className="text-xs text-ink-500">
                {r.orderNumber || "-"} · {formatDate(r.date)} · {r.quantity} {product.unit || "dona"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-ink-900">{formatMoney(r.total)}</span>
              <StatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
