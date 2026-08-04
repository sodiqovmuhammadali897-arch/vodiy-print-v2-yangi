import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, UsersRound, Phone, Send } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Customer, Order } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import CustomerFormModal from "./CustomerFormModal";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import { formatDate, formatMoneyShort, initialsOf } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";

type Row = Customer & { lastOrderAt: string | null; lifetimeValue: number };

export default function Customers() {
  const { can } = useAuth();
  const canEdit = can("customers", "edit");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    const [customersData, ordersData] = await Promise.all([
      listAll<Customer>("customers", { orderBy: ["created_at", "desc"] }),
      listAll<Order>("orders"),
    ]);
    setCustomers(customersData);
    setOrders(ordersData);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const rows: Row[] = useMemo(() => {
    const byCustomer = new Map<string, Order[]>();
    for (const o of orders) {
      if (!o.customer_id || o.status === "cancelled") continue;
      const arr = byCustomer.get(o.customer_id) || [];
      arr.push(o);
      byCustomer.set(o.customer_id, arr);
    }
    return customers.map((c) => {
      const cOrders = byCustomer.get(c.id) || [];
      const lastOrderAt = cOrders.reduce<string | null>((max, o) => {
        const d = o.order_date || o.created_at;
        return !max || (d && d > max) ? d : max;
      }, null);
      const lifetimeValue = cOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
      return { ...c, lastOrderAt, lifetimeValue };
    });
  }, [customers, orders]);

  const industries = useMemo(
    () => Array.from(new Set(customers.map((c) => c.industry).filter(Boolean))).sort(),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (industryFilter && c.industry !== industryFilter) return false;
      if (!q) return true;
      return [c.first_name, c.last_name, c.phone, c.company, c.telegram]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, industryFilter]);

  const onSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Mijozlar
          </h1>
          <p className="text-sm text-ink-500">
            Mijozlar bazasi, brendlar va xarid tarixi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {industries.length > 0 && (
            <select
              className="input w-auto"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            >
              <option value="">Barcha sohalar</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mijozni qidirish..."
              className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi mijoz
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Mijozlar mavjud emas"
          emptyDescription="Yuqoridagi tugma orqali birinchi mijozingizni qo'shing"
          emptyIcon={<UsersRound className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Mijoz</th>
                  <th className="table-th">Soha</th>
                  <th className="table-th">Aloqa</th>
                  <th className="table-th">Oxirgi buyurtma</th>
                  <th className="table-th text-right">Umumiy xarid</th>
                  {canEdit && <th className="table-th text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/50">
                    <td className="table-td">
                      <Link to={`/customers/${c.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                          {initialsOf(`${c.first_name} ${c.last_name}`)}
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900 hover:text-brand-700">
                            {c.first_name} {c.last_name}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-ink-400">
                              {c.customer_number}
                            </span>
                            <CustomerTypeBadge type={c.customer_type} />
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="table-td text-ink-600">
                      {c.industry || <span className="text-ink-400">-</span>}
                    </td>
                    <td className="table-td">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {c.phone && (
                          <span className="flex items-center gap-1 text-ink-700">
                            <Phone className="h-3.5 w-3.5 text-ink-400" /> {c.phone}
                          </span>
                        )}
                        {c.telegram && (
                          <a
                            href={`https://t.me/${c.telegram.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-brand-700 hover:underline"
                          >
                            <Send className="h-3.5 w-3.5" /> {c.telegram}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="table-td whitespace-nowrap text-ink-600">
                      {c.lastOrderAt ? formatDate(c.lastOrderAt) : "-"}
                    </td>
                    <td className="table-td whitespace-nowrap text-right font-semibold text-ink-800">
                      {formatMoneyShort(c.lifetimeValue)}
                    </td>
                    {canEdit && (
                      <td className="table-td text-right">
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                        >
                          Tahrirlash
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <CustomerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        customer={editing}
        onSaved={onSaved}
      />
    </div>
  );
}
