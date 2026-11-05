import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Wallet } from "lucide-react";
import type { Customer, Order } from "../../lib/types";
import { formatDate, formatMoney, formatMoneyShort } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";
import { orderStatusClass, orderStatusLabel } from "../../lib/orderConstants";
import { exportCsv } from "../../lib/exportCsv";
import { DEBT_GROUPS, DEBT_PERIODS, debtView, type DebtGroup, type DebtPeriod } from "../../lib/debts";
import AsyncState from "../../components/ui/AsyncState";

type Props = {
  orders: Order[];
  customers: Map<string, Customer>;
  loading: boolean;
};

// Qarzdorlik: unpaid orders by period (order date), status and manager
// (src/lib/debts.ts). Delivered and still unpaid is shown in red — that
// money is collected first.
const DOT: Record<Exclude<DebtGroup, "all">, string> = { new: "bg-sky-400", production: "bg-amber-500", ready: "bg-emerald-500", delivered: "bg-rose-600" };
const todayTashkent = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const mln = (n: number) => `${(Math.round((n / 1e6) * 10) / 10).toFixed(1).replace(".", ",")}`;

export default function DebtsPanel({ orders, customers, loading }: Props) {
  const [period, setPeriod] = useState<DebtPeriod>("all");
  const [group, setGroup] = useState<DebtGroup>("all");
  const [manager, setManager] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const today = todayTashkent();
  const v = useMemo(() => debtView(orders, { period, group, manager, today }), [orders, period, group, manager, today]);
  const shown = showAll ? v.rows : v.rows.slice(0, 30);
  const customerName = (o: Order) => {
    const c = o.customer_id ? customers.get(o.customer_id) : undefined;
    return c ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "";
  };
  const exportRows = () =>
    exportCsv(
      `qarzdorlik-${today}`,
      ["Buyurtma", "Mijoz", "Menejer", "Status", "Sana", "Deadline", "Qarz"],
      v.rows.map((r) => [r.order.order_number || "", customerName(r.order), r.manager, orderStatusLabel(r.order.status), r.day, String(r.order.deadline || "").slice(0, 10), Math.round(r.remaining)]),
    );
  const delivered = v.byGroup.delivered;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Qarzdorlik</h2>
          <p className="text-xs text-ink-500">
            Umumiy: {formatMoney(v.total.sum)} · {v.total.n} ta buyurtma
            {group === "all" && delivered.n > 0 && (
              <>
                {" "}
                · shundan yetkazilgan, lekin to'lanmagan:{" "}
                <b className="text-rose-600">
                  {mln(delivered.sum)} mln ({delivered.n} ta)
                </b>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl bg-ink-100 p-1">
            {DEBT_PERIODS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setPeriod(k);
                  setShowAll(false);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold sm:text-sm ${period === k ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={exportRows} disabled={!v.rows.length}>
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* Status groups (for the picked period and manager); a card filters */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[{ key: "all" as DebtGroup, label: "Hammasi" }, ...DEBT_GROUPS].map((g) => {
          const s = v.byGroup[g.key];
          const alert = g.key === "delivered" && s.n > 0;
          const on = group === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                setGroup(g.key);
                setShowAll(false);
              }}
              className={`rounded-2xl border-2 p-3 text-left transition ${on ? "border-ink-900 dark:border-ink-700" : alert ? "border-rose-200 dark:border-rose-900/60" : "border-ink-100 hover:border-ink-200"} ${alert ? "bg-rose-50 dark:bg-rose-900/20" : "bg-surface"}`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                {g.key !== "all" && <i className={`inline-block h-2 w-2 rounded-full ${DOT[g.key]}`} />}
                {g.label}
              </div>
              <div className={`font-display text-xl font-extrabold tabular-nums ${alert ? "text-rose-600 dark:text-rose-400" : "text-ink-900"}`}>{mln(s.sum)} mln</div>
              <div className="text-xs text-ink-500">
                {s.n} ta{alert ? " · birinchi undirilsin" : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Managers (for the picked period and status) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ name: null as string | null, sum: v.byManager.reduce((s, m) => s + m.sum, 0) }, ...v.byManager.map((m) => ({ name: m.name as string | null, sum: m.sum }))].map((m) => {
          const on = manager === m.name;
          return (
            <button
              key={String(m.name)}
              type="button"
              onClick={() => {
                setManager(m.name);
                setShowAll(false);
              }}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"}`}
            >
              {m.name ?? "Hammasi"} <span className={on ? "text-white/75" : "text-ink-500"}>{mln(m.sum)}</span>
            </button>
          );
        })}
        {manager !== null && !v.byManager.some((m) => m.name === manager) && (
          <button type="button" onClick={() => setManager(null)} className="rounded-full border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white">
            {manager} 0
          </button>
        )}
      </div>

      <AsyncState loading={loading} empty={v.rows.length === 0} emptyLabel="Bu tanlov bo'yicha qarzdorlik yo'q" emptyIcon={<Wallet className="h-5 w-5" />}>
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60">
              <tr>
                <th className="table-th px-2 sm:px-4">Buyurtma</th>
                <th className="table-th px-2 sm:px-4 hidden sm:table-cell">Mijoz</th>
                <th className="table-th px-2 sm:px-4 hidden md:table-cell">Menejer</th>
                <th className="table-th px-2 sm:px-4">Status</th>
                <th className="table-th px-2 sm:px-4 hidden md:table-cell">Sana</th>
                <th className="table-th px-2 sm:px-4 hidden sm:table-cell">Deadline</th>
                <th className="table-th px-2 sm:px-4 text-right">Qarz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map(({ order, remaining, manager: who }) => {
                const c = order.customer_id ? customers.get(order.customer_id) : undefined;
                const dl = deadlineInfo(order.deadline, []);
                return (
                  <tr key={order.id} className="hover:bg-ink-50/50">
                    <td className="table-td px-2 sm:px-4">
                      <Link to={`/orders/${order.id}`} className="font-semibold text-brand-700 hover:underline">
                        {order.order_number || "-"}
                      </Link>
                      <div className="text-[11px] text-ink-500 md:hidden">{who}</div>
                      {c && (
                        <div className="max-w-[110px] truncate text-[11px] text-ink-500 sm:hidden">
                          {c.first_name} {c.last_name}
                        </div>
                      )}
                    </td>
                    <td className="table-td px-2 sm:px-4 hidden sm:table-cell">
                      {c ? (
                        <Link to={`/customers/${c.id}`} className="text-ink-800 hover:text-brand-700">
                          {c.first_name} {c.last_name}
                        </Link>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td px-2 sm:px-4 hidden whitespace-nowrap text-ink-700 md:table-cell">{who}</td>
                    <td className="table-td px-2 sm:px-4">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold sm:whitespace-nowrap ${orderStatusClass(order.status)}`}>{orderStatusLabel(order.status)}</span>
                      {dl && dl.overdue && <div className="mt-0.5 text-[11px] text-rose-600 sm:hidden">{dl.days} kun kechikdi</div>}
                    </td>
                    <td className="table-td px-2 sm:px-4 hidden whitespace-nowrap md:table-cell">{formatDate(order.order_date || order.created_at)}</td>
                    <td className="table-td px-2 sm:px-4 hidden whitespace-nowrap sm:table-cell">
                      <div>{formatDate(order.deadline)}</div>
                      {dl && dl.overdue && <div className="text-[11px] text-rose-600">{dl.days} kun kechikdi</div>}
                    </td>
                    <td className="table-td px-2 sm:px-4 whitespace-nowrap text-right font-semibold text-rose-600">
                      <span className="sm:hidden">{formatMoneyShort(remaining)}</span>
                      <span className="hidden sm:inline">{formatMoney(remaining)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {v.rows.length > shown.length && (
          <button type="button" className="mt-3 text-sm font-semibold text-brand-600" onClick={() => setShowAll(true)}>
            Yana {v.rows.length - shown.length} tasini ko'rsatish ({formatMoneyShort(v.rows.slice(shown.length).reduce((s, r) => s + r.remaining, 0))})
          </button>
        )}
      </AsyncState>
    </div>
  );
}
