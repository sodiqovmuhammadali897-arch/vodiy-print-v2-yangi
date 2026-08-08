import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Package,
  Inbox,
  Factory,
  CheckCircle2,
  Truck,
  AlertTriangle,
} from "lucide-react";
import {
  deleteOne,
  deleteWhere,
  insertMany,
  insertOne,
  listAll,
  subscribeAll,
  updateOne,
} from "../../lib/firestoreDb";
import type {
  Brand,
  Customer,
  Holiday,
  Order,
  OrderFile,
  OrderPayment,
  OrderProduct,
  OrderStatus,
} from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatCard from "../../components/ui/StatCard";
import StatusBadge, { ORDER_STATUS_OPTIONS, orderStatusLabel } from "../../components/ui/StatusBadge";
import { ORDER_CLOSED_STATUSES, ORDER_STAGE_GROUPS } from "../../lib/orderConstants";
import { changeOrderStatus } from "../../lib/orderStatus";
import { maybePromoteCustomer, type WizardProduct } from "../../lib/orderService";
import { nextOrderNumber } from "../../lib/numbering";
import RequireCustomerModal from "./RequireCustomerModal";
import OrdersSidePanel from "./OrdersSidePanel";
import { formatDate, formatMoneyShort, initialsOf } from "../../lib/format";
import { remainingTimeLabel } from "../../lib/remainingTime";
import { useAuth } from "../../lib/AuthContext";

// A quick at-a-glance production indicator for managers who don't have
// access to Ishlab chiqarish/Pechatnik — the "worst" (least progressed)
// line item wins, so a single unstarted item keeps the whole order red
// even if everything else is done.
type ProductionDot = "red" | "green" | "blue" | null;

const NOT_STARTED_STATUSES = new Set(["new", "accepted"]);

const productionDotFor = (order: Order, items: OrderProduct[]): ProductionDot => {
  if (items.length === 0 || ORDER_CLOSED_STATUSES.includes(order.status)) return null;
  if (items.some((p) => NOT_STARTED_STATUSES.has(p.production_status || "new"))) return "red";
  if (items.every((p) => p.production_status === "ready")) return "blue";
  return "green";
};

type Row = Order & {
  brand?: Brand;
  customer?: Customer;
  productPreview: string;
  productCount: number;
  totalQty: number;
  productionDot: ProductionDot;
};

const PAGE_SIZES = [20, 50, 100];

const inCurrentMonth = (iso: string | null | undefined) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export default function Orders() {
  const navigate = useNavigate();
  const { user, staff, can } = useAuth();
  const canEdit = can("orders", "edit");
  const canDelete = can("orders", "delete");
  const [orders, setOrders] = useState<Order[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [managerFilter, setManagerFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requireCustomerFor, setRequireCustomerFor] = useState<Order | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadAux = async () => {
    const [paymentsData, filesData] = await Promise.all([
      listAll<OrderPayment>("order_payments"),
      listAll<OrderFile>("order_files"),
    ]);
    setPayments(paymentsData);
    setFiles(filesData);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [brandsData, customersData, holidaysData] = await Promise.all([
        listAll<Brand>("brands"),
        listAll<Customer>("customers"),
        listAll<Holiday>("holidays"),
      ]);
      if (cancelled) return;
      setBrands(brandsData);
      setCustomers(customersData);
      setHolidays(holidaysData);
      void loadAux();
    })();

    const unsubOrders = subscribeAll<Order>(
      "orders",
      (rows) => {
        setOrders(rows);
        setLoading(false);
      },
      { orderBy: ["created_at", "desc"] },
    );
    const unsubProducts = subscribeAll<OrderProduct>("order_products", setProducts, {
      orderBy: ["position", "asc"],
    });

    return () => {
      cancelled = true;
      unsubOrders();
      unsubProducts();
    };
  }, []);

  const productsByOrder = useMemo(() => {
    const map = new Map<string, OrderProduct[]>();
    products.forEach((row) => {
      const arr = map.get(row.order_id) || [];
      arr.push(row);
      map.set(row.order_id, arr);
    });
    return map;
  }, [products]);

  const rows = useMemo<Row[]>(() => {
    const brandsMap = new Map(brands.map((x) => [x.id, x]));
    const customersMap = new Map(customers.map((x) => [x.id, x]));

    return orders.map((ord) => {
      const items = productsByOrder.get(ord.id) || [];
      const preview = items
        .slice(0, 2)
        .map((it) => it.product_name || "?")
        .join(", ");
      return {
        ...ord,
        brand: ord.brand_id ? brandsMap.get(ord.brand_id) : undefined,
        customer: ord.customer_id ? customersMap.get(ord.customer_id) : undefined,
        productPreview: preview + (items.length > 2 ? ` +${items.length - 2}` : ""),
        productCount: items.length,
        totalQty: items.reduce((s, it) => s + Number(it.quantity || 0), 0),
        productionDot: productionDotFor(ord, items),
      };
    });
  }, [orders, brands, customers, productsByOrder]);

  const managers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.manager_name).filter(Boolean))).sort(),
    [orders],
  );
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const stats = useMemo(() => {
    const monthOrders = rows.filter((r) => inCurrentMonth(r.order_date || r.created_at));
    const countIn = (group: (typeof ORDER_STAGE_GROUPS)[number]) =>
      monthOrders.filter((r) => group.statuses.includes(r.status)).length;
    const overdue = monthOrders.filter(
      (r) => !ORDER_CLOSED_STATUSES.includes(r.status) && remainingTimeLabel(r.deadline)?.overdue,
    ).length;
    return {
      total: monthOrders.length,
      newCount: countIn(ORDER_STAGE_GROUPS[0]),
      productionCount: countIn(ORDER_STAGE_GROUPS[1]),
      readyCount: countIn(ORDER_STAGE_GROUPS[2]),
      deliveredCount: countIn(ORDER_STAGE_GROUPS[3]),
      overdue,
    };
  }, [rows]);

  const closedCount = useMemo(
    () => rows.filter((r) => ORDER_CLOSED_STATUSES.includes(r.status)).length,
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        if (r.status !== statusFilter) return false;
      } else if (!showClosed && ORDER_CLOSED_STATUSES.includes(r.status)) {
        return false;
      }
      if (managerFilter && r.manager_name !== managerFilter) return false;
      if (categoryFilter) {
        const items = productsByOrder.get(r.id) || [];
        if (!items.some((p) => p.category === categoryFilter)) return false;
      }
      const d = r.order_date || r.created_at;
      if (dateFrom && (!d || d.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!d || d.slice(0, 10) > dateTo)) return false;
      if (!q) return true;
      return [
        r.order_number,
        r.title,
        r.manager_name,
        r.brand?.name,
        r.customer?.customer_number,
        r.customer?.first_name,
        r.customer?.last_name,
        r.customer?.company,
        r.customer?.phone,
        r.productPreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter, showClosed, managerFilter, categoryFilter, dateFrom, dateTo, productsByOrder]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, showClosed, managerFilter, categoryFilter, dateFrom, dateTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const selectedProducts = useMemo(
    () => (selected ? productsByOrder.get(selected.id) || [] : []),
    [selected, productsByOrder],
  );
  const selectedPayments = useMemo(
    () => (selected ? payments.filter((p) => p.order_id === selected.id) : []),
    [selected, payments],
  );
  const selectedFiles = useMemo(
    () => (selected ? files.filter((f) => f.order_id === selected.id) : []),
    [selected, files],
  );

  const applyStatusChange = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    try {
      await changeOrderStatus(orderId, status, {
        email: user?.email || "",
        name: staff?.full_name || user?.email || "",
      });
    } catch (e) {
      alert(e instanceof Error ? `Statusni o'zgartirib bo'lmadi: ${e.message}` : "Statusni o'zgartirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    if (status === "delivered" && !order.customer_id) {
      setRequireCustomerFor(order);
      return;
    }
    void applyStatusChange(order.id, status);
  };

  const onCustomerSelected = async (c: Customer) => {
    const order = requireCustomerFor;
    setRequireCustomerFor(null);
    if (!order) return;
    try {
      await updateOne("orders", order.id, { customer_id: c.id });
      await maybePromoteCustomer(c.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
      return;
    }
    await applyStatusChange(order.id, "delivered");
  };

  const removeOrder = async (orderId: string) => {
    if (!confirm("Ushbu buyurtmani butunlay o'chirishni tasdiqlaysizmi? Bu amalni orqaga qaytarib bo'lmaydi.")) {
      return;
    }
    setBusyId(orderId);
    try {
      await Promise.all([
        deleteWhere("order_products", "order_id", orderId),
        deleteWhere("order_payments", "order_id", orderId),
        deleteWhere("order_files", "order_id", orderId),
        deleteWhere("order_status_history", "order_id", orderId),
      ]);
      await deleteOne("orders", orderId);
      if (selectedId === orderId) setSelectedId(null);
      void loadAux();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const duplicateOrder = async (order: Order) => {
    setBusyId(order.id);
    try {
      const number = await nextOrderNumber();
      const {
        id: _id,
        order_number: _on,
        created_at: _ca,
        completed_at: _cd,
        ...rest
      } = order;
      void _id;
      void _on;
      void _ca;
      void _cd;
      const created = await insertOne("orders", {
        ...rest,
        order_number: number,
        status: "new",
        paid_amount: 0,
        remaining_amount: order.total_amount,
        is_draft: false,
        order_date: new Date().toISOString().slice(0, 10),
        textile_sizes_confirmed_at: null,
        textile_sizes_confirmed_by: "",
      });
      const items = productsByOrder.get(order.id) || [];
      if (items.length > 0) {
        await insertMany<WizardProduct & { order_id: string }>(
          "order_products",
          items.map((p) => ({
            order_id: created.id,
            position: p.position,
            category: p.category,
            product_name: p.product_name,
            variant: p.variant,
            size: p.size,
            material: p.material,
            color: p.color,
            quantity: p.quantity,
            unit_price: p.unit_price,
            discount: p.discount,
            total: p.total,
            note: p.note,
            size_breakdown: p.size_breakdown,
            production_status: "new",
            assigned_printer_email: "",
            assigned_printer_name: "",
            production_accepted_at: null,
            production_completed_at: null,
          })),
        );
      }
      setSelectedId(null);
      navigate(`/orders/${created.id}/edit`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Buyurtmalar</h1>
          <p className="text-sm text-ink-500">Barcha buyurtmalar ro'yxati va holati</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => navigate("/orders/new")}>
            <Plus className="h-4 w-4" /> Yangi buyurtma
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard title="Jami buyurtmalar" value={`${stats.total} ta`} tone="brand" icon={<Package className="h-5 w-5" />} />
        <StatCard title="Yangi" value={`${stats.newCount} ta`} tone="sky" icon={<Inbox className="h-5 w-5" />} />
        <StatCard title="Ishlab chiqarilmoqda" value={`${stats.productionCount} ta`} tone="amber" icon={<Factory className="h-5 w-5" />} />
        <StatCard title="Tayyor" value={`${stats.readyCount} ta`} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Yetkazildi" value={`${stats.deliveredCount} ta`} tone="emerald" icon={<Truck className="h-5 w-5" />} />
        <StatCard title="Kechikkan" value={`${stats.overdue} ta`} tone="rose" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, mijoz, telefon, mahsulot..."
            className="w-full min-w-[160px] bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
        <input type="date" className="input w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}>
          <option value="all">Barcha statuslar</option>
          {ORDER_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel(s)}
            </option>
          ))}
        </select>
        {managers.length > 0 && (
          <select className="input w-auto" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="">Barcha manager</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {categories.length > 0 && (
          <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Barcha mahsulot</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {statusFilter === "all" && closedCount > 0 && (
          <label className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-xs font-medium text-ink-600 shadow-sm">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Yopilganlarni ko'rsatish ({closedCount})
          </label>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="card flex-1 overflow-hidden">
          <AsyncState
            loading={loading}
            empty={filtered.length === 0}
            emptyLabel="Buyurtmalar mavjud emas"
            emptyIcon={<Package className="h-5 w-5" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60">
                  <tr>
                    <th className="table-th">ID</th>
                    <th className="table-th">Mijoz</th>
                    <th className="table-th">Mahsulotlar</th>
                    <th className="table-th text-right">Soni</th>
                    <th className="table-th text-right">Jami summa</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Topshirish sana</th>
                    <th className="table-th">Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {pageRows.map((o) => {
                    const rt = remainingTimeLabel(o.deadline);
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(o.id)}
                        className={`cursor-pointer hover:bg-ink-50/50 ${selectedId === o.id ? "bg-brand-50/60" : ""}`}
                      >
                        <td className="table-td">
                          <div className="flex items-center gap-1.5 font-display font-extrabold text-brand-700">
                            {o.productionDot && (
                              <span
                                title={
                                  o.productionDot === "red"
                                    ? "Hali ishga olinmagan"
                                    : o.productionDot === "green"
                                    ? "Ishlab chiqarilmoqda"
                                    : "Tayyor"
                                }
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  o.productionDot === "red"
                                    ? "bg-rose-500"
                                    : o.productionDot === "green"
                                    ? "bg-emerald-500"
                                    : "bg-sky-500"
                                } ${o.productionDot === "red" && rt?.overdue ? "animate-pulse" : ""}`}
                              />
                            )}
                            {o.order_number || "-"}
                          </div>
                        </td>
                        <td className="table-td">
                          {o.customer ? (
                            <div>
                              <div className="font-medium text-ink-800">
                                {o.customer.first_name} {o.customer.last_name}
                              </div>
                              <div className="text-xs text-ink-500">{o.customer.phone}</div>
                            </div>
                          ) : (
                            <span className="text-ink-400">-</span>
                          )}
                        </td>
                        <td className="table-td">
                          <div className="max-w-[220px] truncate text-ink-700">{o.productPreview || "-"}</div>
                        </td>
                        <td className="table-td whitespace-nowrap text-right text-ink-700">{o.totalQty} dona</td>
                        <td className="table-td whitespace-nowrap text-right font-semibold text-ink-800">
                          {formatMoneyShort(o.total_amount)}
                        </td>
                        <td className="table-td">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="table-td whitespace-nowrap">
                          <div>{formatDate(o.deadline)}</div>
                          {rt && (
                            <div className={`text-[11px] ${rt.overdue ? "font-semibold text-rose-600" : "text-ink-500"}`}>
                              {rt.overdue ? `${rt.days} kun kechikdi` : `${rt.days} kun qoldi`}
                            </div>
                          )}
                        </td>
                        <td className="table-td whitespace-nowrap">
                          {o.manager_name ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white">
                                {initialsOf(o.manager_name)}
                              </div>
                              <span className="text-xs text-ink-700">{o.manager_name}</span>
                            </div>
                          ) : (
                            <span className="text-ink-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-sm text-ink-600">
              <span>Jami {filtered.length} ta buyurtma</span>
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
                <select className="input w-auto py-1.5 text-xs" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
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
          <OrdersSidePanel
            order={selected}
            customer={selected.customer || null}
            brand={selected.brand || null}
            products={selectedProducts}
            payments={selectedPayments}
            files={selectedFiles}
            holidays={holidays}
            canEdit={canEdit}
            canDelete={canDelete}
            busy={busyId === selected.id}
            onClose={() => setSelectedId(null)}
            onStatusChange={(status) => changeStatus(selected, status)}
            onDuplicate={() => void duplicateOrder(selected)}
            onDelete={() => void removeOrder(selected.id)}
            onPaymentSaved={() => void loadAux()}
          />
        )}
      </div>

      <RequireCustomerModal
        open={!!requireCustomerFor}
        onClose={() => setRequireCustomerFor(null)}
        customers={customers}
        onSelected={onCustomerSelected}
      />
    </div>
  );
}
