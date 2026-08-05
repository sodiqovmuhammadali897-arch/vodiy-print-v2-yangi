import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Package, Send, Copy } from "lucide-react";
import { listAll, subscribeAll } from "../../lib/firestoreDb";
import type {
  Brand,
  Customer,
  Holiday,
  Order,
  OrderProduct,
  OrderStatus,
} from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatusBadge, {
  ORDER_STATUS_OPTIONS,
  orderStatusLabel,
} from "../../components/ui/StatusBadge";
import ProductionBadge from "../../components/ui/ProductionBadge";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";
import { remainingTimeLabel } from "../../lib/remainingTime";
import { useAuth } from "../../lib/AuthContext";

type Row = Order & {
  brand?: Brand;
  customer?: Customer;
  productPreview: string;
  productCount: number;
};

export default function Orders() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("orders", "edit");
  const [orders, setOrders] = useState<Order[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [brandsData, customersData, productsData, holidaysData] = await Promise.all([
        listAll<Brand>("brands"),
        listAll<Customer>("customers"),
        listAll<OrderProduct>("order_products", { orderBy: ["position", "asc"] }),
        listAll<Holiday>("holidays"),
      ]);
      if (cancelled) return;
      setBrands(brandsData);
      setCustomers(customersData);
      setProducts(productsData);
      setHolidays(holidaysData);
    })();

    const unsubOrders = subscribeAll<Order>(
      "orders",
      (rows) => {
        setOrders(rows);
        setLoading(false);
      },
      { orderBy: ["created_at", "desc"] },
    );

    return () => {
      cancelled = true;
      unsubOrders();
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const brandsMap = new Map(brands.map((x) => [x.id, x]));
    const customersMap = new Map(customers.map((x) => [x.id, x]));
    const productsByOrder = new Map<string, OrderProduct[]>();
    products.forEach((row) => {
      const arr = productsByOrder.get(row.order_id) || [];
      arr.push(row);
      productsByOrder.set(row.order_id, arr);
    });

    return orders.map((ord) => {
      const items = productsByOrder.get(ord.id) || [];
      const preview = items
        .slice(0, 2)
        .map((it) => `${it.product_name || "?"} × ${it.quantity || 0}`)
        .join(", ");
      return {
        ...ord,
        brand: ord.brand_id ? brandsMap.get(ord.brand_id) : undefined,
        customer: ord.customer_id ? customersMap.get(ord.customer_id) : undefined,
        productPreview: preview + (items.length > 2 ? ` +${items.length - 2}` : ""),
        productCount: items.length,
      };
    });
  }, [orders, brands, customers, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [
        r.order_number,
        r.title,
        r.description,
        r.manager_name,
        r.brand?.name,
        r.customer?.customer_number,
        r.customer?.first_name,
        r.customer?.last_name,
        r.customer?.company,
        r.customer?.phone,
        r.customer?.telegram,
        r.productPreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      /* ignored */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Buyurtmalar
          </h1>
          <p className="text-sm text-ink-500">Barcha buyurtmalar tarixi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as OrderStatus | "all")
            }
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
              placeholder="ID, mijoz, telefon, mahsulot..."
              className="w-64 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => navigate("/orders/new")}
            >
              <Plus className="h-4 w-4" /> Yangi buyurtma
            </button>
          )}
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
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">ID</th>
                  <th className="table-th">Sana</th>
                  <th className="table-th">Menejer</th>
                  <th className="table-th">Mijoz</th>
                  <th className="table-th">Brend</th>
                  <th className="table-th">Aloqa</th>
                  <th className="table-th">Mahsulotlar</th>
                  <th className="table-th">Ishlab chiqaruvchi</th>
                  <th className="table-th text-right">Summa</th>
                  <th className="table-th text-right">To'langan</th>
                  <th className="table-th text-right">Qoldiq</th>
                  <th className="table-th">Deadline</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Pechatnik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((o) => {
                  const dl = deadlineInfo(o.deadline, holidays);
                  const rt = remainingTimeLabel(o.deadline);
                  const remaining =
                    Number(o.remaining_amount || 0) ||
                    Math.max(
                      0,
                      Number(o.total_amount || 0) - Number(o.paid_amount || 0),
                    );
                  return (
                    <tr key={o.id} className="hover:bg-ink-50/50">
                      <td className="table-td">
                        <Link
                          to={`/orders/${o.id}`}
                          className="font-display font-extrabold text-brand-700 hover:underline"
                        >
                          {o.order_number || "-"}
                        </Link>
                        {rt && (
                          <div
                            className={`text-xs ${
                              rt.overdue ? "font-semibold text-rose-600" : "text-ink-500"
                            }`}
                          >
                            {rt.label}
                          </div>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap text-ink-600">
                        {formatDate(o.order_date || o.created_at)}
                      </td>
                      <td className="table-td whitespace-nowrap">
                        {o.manager_name || "-"}
                      </td>
                      <td className="table-td">
                        {o.customer ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-brand-700">
                                {o.customer.customer_number || ""}
                              </span>
                              <span className="font-medium text-ink-800">
                                {o.customer.first_name} {o.customer.last_name}
                              </span>
                            </div>
                            <CustomerTypeBadge type={o.customer.customer_type} />
                          </div>
                        ) : (
                          <span className="text-ink-400">-</span>
                        )}
                      </td>
                      <td className="table-td text-ink-700">
                        {o.brand?.name || "-"}
                      </td>
                      <td className="table-td">
                        {o.customer?.phone && (
                          <div className="flex items-center gap-1 text-xs text-ink-600">
                            <a
                              href={`tel:${o.customer.phone}`}
                              className="hover:text-brand-700"
                            >
                              {o.customer.phone}
                            </a>
                            <button
                              onClick={() => copy(o.customer!.phone)}
                              className="rounded p-0.5 hover:bg-ink-100"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={`https://wa.me/${o.customer.phone.replace(
                                /[^\d]/g,
                                "",
                              )}`}
                              className="rounded p-0.5 hover:bg-ink-100"
                              title="WhatsApp"
                            >
                              <Send className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {o.customer?.telegram && (
                          <a
                            target="_blank"
                            rel="noreferrer"
                            href={`https://t.me/${o.customer.telegram.replace(
                              /^@/,
                              "",
                            )}`}
                            className="text-xs text-brand-700 hover:underline"
                          >
                            {o.customer.telegram}
                          </a>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="max-w-[220px] truncate text-ink-700">
                          {o.productPreview || "-"}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {o.productCount > 0
                            ? `${o.productCount} ta pozitsiya`
                            : ""}
                        </div>
                      </td>
                      <td className="table-td">
                        <ProductionBadge name={o.production_company} />
                      </td>
                      <td className="table-td whitespace-nowrap text-right font-semibold">
                        {formatMoney(o.total_amount)}
                      </td>
                      <td className="table-td whitespace-nowrap text-right text-emerald-700">
                        {formatMoney(o.paid_amount)}
                      </td>
                      <td className="table-td whitespace-nowrap text-right">
                        <span
                          className={
                            remaining > 0
                              ? "font-semibold text-rose-600"
                              : "text-ink-500"
                          }
                        >
                          {formatMoney(remaining)}
                        </span>
                      </td>
                      <td className="table-td whitespace-nowrap">
                        <div>{formatDate(o.deadline)}</div>
                        {dl && (
                          <div
                            className={`text-[11px] ${
                              dl.tone === "rose"
                                ? "text-rose-600"
                                : dl.tone === "amber"
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {dl.overdue
                              ? `${dl.days} kun kechikdi`
                              : dl.days === 0
                              ? "Bugun"
                              : `${dl.days} ish kuni`}
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="table-td whitespace-nowrap text-ink-600">
                        {o.assigned_printer_name || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>
    </div>
  );
}
