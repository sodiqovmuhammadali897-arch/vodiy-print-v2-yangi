import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  UsersRound,
  Phone,
  Send,
  Users,
  BadgeCheck,
  Crown,
  CircleDollarSign,
  Landmark,
} from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Customer, Manager, Order, OrderFile, OrderPayment } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatCard from "../../components/ui/StatCard";
import CustomerFormModal from "./CustomerFormModal";
import CustomerSidePanel from "./CustomerSidePanel";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import { formatMoneyShort, initialsOf } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";

type Row = Customer & { lastOrderAt: string | null; lifetimeValue: number; orderCount: number; debt: number };

const PAGE_SIZES = [20, 50, 100];

export default function Customers() {
  const { can } = useAuth();
  const canEdit = can("customers", "edit");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [managerNames, setManagerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    const [customersData, ordersData, paymentsData, filesData, managersData] = await Promise.all([
      listAll<Customer>("customers", { orderBy: ["created_at", "desc"] }),
      listAll<Order>("orders"),
      listAll<OrderPayment>("order_payments"),
      listAll<OrderFile>("order_files"),
      listAll<Manager>("managers", { orderBy: ["created_at", "asc"] }),
    ]);
    setCustomers(customersData);
    setOrders(ordersData);
    setPayments(paymentsData);
    setFiles(filesData);
    setManagerNames(managersData.map((m) => m.name));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      if (!o.customer_id || o.status === "cancelled") continue;
      const arr = map.get(o.customer_id) || [];
      arr.push(o);
      map.set(o.customer_id, arr);
    }
    return map;
  }, [orders]);

  const rows: Row[] = useMemo(() => {
    return customers.map((c) => {
      const cOrders = ordersByCustomer.get(c.id) || [];
      const lastOrderAt = cOrders.reduce<string | null>((max, o) => {
        const d = o.order_date || o.created_at;
        return !max || (d && d > max) ? d : max;
      }, null);
      const lifetimeValue = cOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const debt = cOrders.reduce(
        (s, o) =>
          s +
          (Number(o.remaining_amount || 0) ||
            Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0))),
        0,
      );
      return { ...c, lastOrderAt, lifetimeValue, orderCount: cOrders.length, debt };
    });
  }, [customers, ordersByCustomer]);

  const industries = useMemo(
    () => Array.from(new Set(customers.map((c) => c.industry).filter(Boolean))).sort(),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (industryFilter && c.industry !== industryFilter) return false;
      if (typeFilter && c.customer_type !== typeFilter) return false;
      if (managerFilter && c.manager_name !== managerFilter) return false;
      if (!q) return true;
      return [c.first_name, c.last_name, c.phone, c.company, c.telegram]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, industryFilter, typeFilter, managerFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, industryFilter, typeFilter, managerFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((c) => c.customer_type !== "inactive").length;
    const vip = rows.filter((c) => c.customer_type === "vip").length;
    const withDebt = rows.filter((c) => c.debt > 0);
    const totalDebt = withDebt.reduce((s, c) => s + c.debt, 0);
    return { total, active, vip, debtCount: withDebt.length, totalDebt };
  }, [rows]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const selectedOrders = useMemo(
    () => (selected ? ordersByCustomer.get(selected.id) || [] : []),
    [selected, ordersByCustomer],
  );
  const selectedOrderIds = useMemo(() => new Set(selectedOrders.map((o) => o.id)), [selectedOrders]);
  const selectedPayments = useMemo(
    () => payments.filter((p) => selectedOrderIds.has(p.order_id)),
    [payments, selectedOrderIds],
  );
  const selectedFiles = useMemo(
    () => files.filter((f) => selectedOrderIds.has(f.order_id)),
    [files, selectedOrderIds],
  );

  const onSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Mijozlar bazasi</h1>
          <p className="text-sm text-ink-500">Mijozlar bazasi, brendlar va xarid tarixi</p>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard title="Jami mijozlar" value={`${stats.total} ta`} tone="brand" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Faol mijozlar" value={`${stats.active} ta`} tone="emerald" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard title="VIP mijozlar" value={`${stats.vip} ta`} tone="amber" icon={<Crown className="h-5 w-5" />} />
        <StatCard title="Qarzdor mijozlar" value={`${stats.debtCount} ta`} tone="rose" icon={<CircleDollarSign className="h-5 w-5" />} />
        <StatCard
          title="Umumiy qarzdorlik"
          value={formatMoneyShort(stats.totalDebt)}
          tone="sky"
          icon={<Landmark className="h-5 w-5" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mijoz nomi yoki telefon..."
            className="w-full min-w-[160px] bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
        <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Barcha status</option>
          <option value="new">Yangi mijoz</option>
          <option value="regular">Doimiy mijoz</option>
          <option value="vip">VIP mijoz</option>
          <option value="inactive">Faol emas</option>
        </select>
        {industries.length > 0 && (
          <select className="input w-auto" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
            <option value="">Barcha toifa</option>
            {industries.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        )}
        {managerNames.length > 0 && (
          <select className="input w-auto" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="">Barcha manager</option>
            {managerNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="card flex-1 overflow-hidden">
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
                    <th className="table-th">Telefon</th>
                    <th className="table-th">Toifa</th>
                    <th className="table-th">Status</th>
                    <th className="table-th text-right">Buyurtmalar</th>
                    <th className="table-th text-right">Umumiy summa</th>
                    <th className="table-th text-right">Qarzdorlik</th>
                    <th className="table-th">Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {pageRows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer hover:bg-ink-50/50 ${
                        selectedId === c.id ? "bg-brand-50/60" : ""
                      }`}
                    >
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                            {initialsOf(`${c.first_name} ${c.last_name}`)}
                          </div>
                          <div>
                            <div className="font-semibold text-ink-900">
                              {c.first_name} {c.last_name}
                            </div>
                            <div className="text-[10px] text-ink-400">{c.company || c.customer_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {c.phone && (
                            <span className="flex items-center gap-1 text-ink-700">
                              <Phone className="h-3.5 w-3.5 text-ink-400" /> {c.phone}
                            </span>
                          )}
                          {c.telegram && (
                            <span className="flex items-center gap-1 text-ink-500">
                              <Send className="h-3.5 w-3.5" /> {c.telegram}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td text-ink-600">{c.industry || <span className="text-ink-400">-</span>}</td>
                      <td className="table-td">
                        <CustomerTypeBadge type={c.customer_type} />
                      </td>
                      <td className="table-td whitespace-nowrap text-right text-ink-700">{c.orderCount} ta</td>
                      <td className="table-td whitespace-nowrap text-right font-semibold text-ink-800">
                        {formatMoneyShort(c.lifetimeValue)}
                      </td>
                      <td
                        className={`table-td whitespace-nowrap text-right font-semibold ${
                          c.debt > 0 ? "text-rose-600" : "text-ink-400"
                        }`}
                      >
                        {c.debt > 0 ? formatMoneyShort(c.debt) : "-"}
                      </td>
                      <td className="table-td whitespace-nowrap text-ink-600">{c.manager_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-sm text-ink-600">
              <span>Jami {filtered.length} ta mijoz</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    className="btn-ghost px-2 py-1 disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <span className="px-2 text-xs font-semibold text-ink-700">
                    {page} / {totalPages}
                  </span>
                  <button
                    className="btn-ghost px-2 py-1 disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
                <select
                  className="input w-auto py-1.5 text-xs"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / sahifa
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </AsyncState>
        </div>

        {selected && (
          <CustomerSidePanel
            customer={selected}
            orders={selectedOrders}
            payments={selectedPayments}
            files={selectedFiles}
            debt={selected.debt}
            onClose={() => setSelectedId(null)}
            onEdit={() => {
              setEditing(selected);
              setModalOpen(true);
            }}
          />
        )}
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
