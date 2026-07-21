import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Package } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Brand, Customer, Order, OrderStatus } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatusBadge, { ORDER_STATUS_OPTIONS, orderStatusLabel } from "../../components/ui/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import OrderFormModal from "./OrderFormModal";

type Row = Order & { brand?: Brand; customer?: Customer };

export default function Orders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [modal, setModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const [o, b, c] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("brands").select("*"),
      supabase.from("customers").select("*"),
    ]);
    const brands = new Map(((b.data as Brand[]) || []).map((x) => [x.id, x]));
    const customers = new Map(
      ((c.data as Customer[]) || []).map((x) => [x.id, x]),
    );
    setRows(
      ((o.data as Order[]) || []).map((ord) => ({
        ...ord,
        brand: ord.brand_id ? brands.get(ord.brand_id) : undefined,
        customer: ord.customer_id ? customers.get(ord.customer_id) : undefined,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [
        r.title,
        r.description,
        r.manager_name,
        r.brand?.name,
        r.customer?.first_name,
        r.customer?.last_name,
        r.customer?.company,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Buyurtmalar</h1>
          <p className="text-sm text-ink-500">Barcha buyurtmalar tarixi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
          >
            <option value="all">Barcha statuslar</option>
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buyurtmani qidirish..."
              className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" /> Yangi buyurtma
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Buyurtmalar mavjud emas"
          emptyIcon={<Package className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Buyurtma</th>
                  <th className="table-th">Mijoz / Brend</th>
                  <th className="table-th">Menejer</th>
                  <th className="table-th">Summa</th>
                  <th className="table-th">To'langan</th>
                  <th className="table-th">Muddat</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((o) => (
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
                    <td className="table-td">
                      {o.customer && (
                        <div className="font-medium text-ink-800">
                          {o.customer.first_name} {o.customer.last_name}
                        </div>
                      )}
                      {o.brand && (
                        <div className="text-xs text-brand-700">
                          {o.brand.name}
                        </div>
                      )}
                      {!o.customer && !o.brand && (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td">{o.manager_name || "-"}</td>
                    <td className="table-td font-semibold">
                      {formatMoney(o.total_amount)}
                    </td>
                    <td className="table-td">
                      <span
                        className={
                          Number(o.paid_amount) < Number(o.total_amount)
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }
                      >
                        {formatMoney(o.paid_amount)}
                      </span>
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

      <OrderFormModal
        open={modal}
        onClose={() => setModal(false)}
        onSaved={() => {
          setModal(false);
          void load();
        }}
      />
    </div>
  );
}
