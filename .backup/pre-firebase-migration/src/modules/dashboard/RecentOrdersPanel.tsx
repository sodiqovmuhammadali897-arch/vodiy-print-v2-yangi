import { Link } from "react-router-dom";
import { PackageOpen, ArrowRight } from "lucide-react";
import type { Order } from "../../lib/types";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";

export default function RecentOrdersPanel({
  orders,
  loading,
}: {
  orders: Order[];
  loading: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">
            So'nggi buyurtmalar
          </h2>
          <p className="text-xs text-ink-500">Oxirgi 6 ta yangi buyurtma</p>
        </div>
        <Link
          to="/orders"
          className="btn-ghost text-brand-700 hover:bg-brand-50"
        >
          Barchasi <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <AsyncState
        loading={loading}
        empty={orders.length === 0}
        emptyLabel="Hozircha buyurtmalar yo'q"
        emptyDescription="Buyurtmalar bo'limidan yangi buyurtma yarating"
        emptyIcon={<PackageOpen className="h-5 w-5" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="table-th">Buyurtma</th>
                <th className="table-th">Menejer</th>
                <th className="table-th">Summa</th>
                <th className="table-th">Muddat</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-ink-50/50">
                  <td className="table-td">
                    <Link
                      to={`/orders/${o.id}`}
                      className="font-semibold text-ink-800 hover:text-brand-700"
                    >
                      {o.title}
                    </Link>
                    <div className="text-xs text-ink-500">
                      {formatDate(o.created_at)}
                    </div>
                  </td>
                  <td className="table-td">{o.manager_name || "-"}</td>
                  <td className="table-td font-semibold">
                    {formatMoney(o.total_amount)}
                  </td>
                  <td className="table-td">{formatDate(o.deadline)}</td>
                  <td className="table-td">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
