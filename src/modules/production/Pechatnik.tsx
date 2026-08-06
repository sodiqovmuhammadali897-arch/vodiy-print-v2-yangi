import { useEffect, useMemo, useState } from "react";
import { Shirt, Search } from "lucide-react";
import { listAll, subscribeAll, updateOne } from "../../lib/firestoreDb";
import type { Brand, Customer, Holiday, Order, OrderProduct, OrderStatus } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import { orderStatusLabel } from "../../components/ui/StatusBadge";
import AsyncState from "../../components/ui/AsyncState";
import ProductionProductCard from "./ProductionProductCard";

const PRINTER_STATUSES: OrderStatus[] = [
  "new",
  "accepted",
  "production",
  "quality_control",
  "ready",
];

type Row = { product: OrderProduct; order: Order };

export default function Pechatnik() {
  const { user, isAdmin, can } = useAuth();
  const canEdit = can("pechatnik", "edit");

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [customersData, brandsData, holidaysData] = await Promise.all([
        listAll<Customer>("customers"),
        listAll<Brand>("brands"),
        listAll<Holiday>("holidays"),
      ]);
      if (cancelled) return;
      setCustomers(customersData);
      setBrands(brandsData);
      setHolidays(holidaysData);
    })();

    const unsubOrders = subscribeAll<Order>("orders", (rows) => {
      setOrders(rows);
      setLoading(false);
    });
    const unsubProducts = subscribeAll<OrderProduct>("order_products", setProducts);

    return () => {
      cancelled = true;
      unsubOrders();
      unsubProducts();
    };
  }, []);

  const customersMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const brandsMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const ordersMap = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const myEmail = (user?.email || "").toLowerCase();
  const rows = useMemo<Row[]>(() => {
    return products
      .filter((p) => p.category === "Textil")
      .filter((p) => isAdmin || (p.assigned_printer_email || "").toLowerCase() === myEmail)
      .map((product) => {
        const order = ordersMap.get(product.order_id);
        return order ? { product, order } : null;
      })
      .filter((r): r is Row => r !== null);
  }, [products, ordersMap, isAdmin, myEmail]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.product.production_status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        const customer = r.order.customer_id ? customersMap.get(r.order.customer_id) : null;
        const brand = r.order.brand_id ? brandsMap.get(r.order.brand_id) : null;
        return [r.order.order_number, r.order.title, r.product.product_name, customer?.first_name, customer?.last_name, brand?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const da = a.order.deadline ? new Date(a.order.deadline).getTime() : Infinity;
        const db_ = b.order.deadline ? new Date(b.order.deadline).getTime() : Infinity;
        return da - db_;
      });
  }, [rows, statusFilter, search, customersMap, brandsMap]);

  const accept = async (productId: string) => {
    setBusyId(productId);
    try {
      await updateOne("order_products", productId, {
        production_status: "production",
        production_accepted_at: new Date().toISOString(),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const finish = async (productId: string) => {
    setBusyId(productId);
    try {
      await updateOne("order_products", productId, {
        production_status: "ready",
        production_completed_at: new Date().toISOString(),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <Shirt className="h-6 w-6 text-brand-600" /> Pechatnik
          </h1>
          <p className="text-sm text-ink-500">
            {isAdmin ? "Barcha Textil mahsulotlar" : "Sizga biriktirilgan Textil mahsulotlar"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
          >
            <option value="all">Barcha statuslar</option>
            {PRINTER_STATUSES.map((s) => (
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
              placeholder="ID, mijoz, brend..."
              className="w-52 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
        </div>
      </div>

      <AsyncState
        loading={loading}
        empty={visibleRows.length === 0}
        emptyLabel="Textil mahsulotlar topilmadi"
        emptyDescription={
          isAdmin
            ? "Ishlab chiqarish panelida Textil mahsulotga pechatnik biriktirilsa, u shu yerda ko'rinadi"
            : "Sizga hozircha mahsulot biriktirilmagan"
        }
        emptyIcon={<Shirt className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map(({ product, order }) => (
            <ProductionProductCard
              key={product.id}
              mode="pechatnik"
              product={product}
              order={order}
              customer={order.customer_id ? customersMap.get(order.customer_id) || null : null}
              brand={order.brand_id ? brandsMap.get(order.brand_id) || null : null}
              holidays={holidays}
              canAct={
                isAdmin ||
                (canEdit && (product.assigned_printer_email || "").toLowerCase() === myEmail)
              }
              busy={busyId === product.id}
              onAccept={() => accept(product.id)}
              onReady={() => finish(product.id)}
            />
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
