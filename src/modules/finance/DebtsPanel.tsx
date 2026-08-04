import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import type { Customer, Order } from "../../lib/types";
import { formatDate, formatMoney } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";
import AsyncState from "../../components/ui/AsyncState";

type Props = {
  orders: Order[];
  customers: Map<string, Customer>;
  loading: boolean;
};

export default function DebtsPanel({ orders, customers, loading }: Props) {
  const rows = orders
    .map((o) => ({
      order: o,
      remaining:
        Number(o.remaining_amount || 0) ||
        Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0)),
    }))
    .filter((r) => r.remaining > 0 && r.order.status !== "cancelled")
    .sort((a, b) => b.remaining - a.remaining);

  const total = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">
            Qarzdorlik
          </h2>
          <p className="text-xs text-ink-500">
            Umumiy: {formatMoney(total)} · {rows.length} ta buyurtma
          </p>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Qarzdorlik yo'q"
        emptyIcon={<Wallet className="h-5 w-5" />}
      >
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60">
              <tr>
                <th className="table-th">Buyurtma</th>
                <th className="table-th">Mijoz</th>
                <th className="table-th">Deadline</th>
                <th className="table-th text-right">Qarz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map(({ order, remaining }) => {
                const c = order.customer_id ? customers.get(order.customer_id) : undefined;
                const dl = deadlineInfo(order.deadline, []);
                return (
                  <tr key={order.id} className="hover:bg-ink-50/50">
                    <td className="table-td">
                      <Link
                        to={`/orders/${order.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {order.order_number || "-"}
                      </Link>
                    </td>
                    <td className="table-td">
                      {c ? (
                        <Link
                          to={`/customers/${c.id}`}
                          className="text-ink-800 hover:text-brand-700"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      <div>{formatDate(order.deadline)}</div>
                      {dl && dl.overdue && (
                        <div className="text-[11px] text-rose-600">
                          {dl.days} kun kechikdi
                        </div>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap text-right font-semibold text-rose-600">
                      {formatMoney(remaining)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
