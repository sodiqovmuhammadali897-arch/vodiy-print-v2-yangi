import { useEffect, useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { listAll, subscribeAll, updateOne } from "../../lib/firestoreDb";
import type { Brand, Customer, Holiday, Order, OrderProduct } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { ORDER_CLOSED_STATUSES } from "../../lib/orderConstants";
import { useAuth } from "../../lib/AuthContext";
import AsyncState from "../../components/ui/AsyncState";
import ProductionProductCard from "./ProductionProductCard";

// A row this panel can act on: the order_product plus its parent order,
// since every card needs both (deadline/customer come from the order, the
// item itself comes from the product).
type Row = { product: OrderProduct; order: Order };

export default function Production() {
  const { can } = useAuth();
  const canEdit = can("production", "edit");

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [printers, setPrinters] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [customersData, brandsData, holidaysData, staffData] = await Promise.all([
        listAll<Customer>("customers"),
        listAll<Brand>("brands"),
        listAll<Holiday>("holidays"),
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
      ]);
      if (cancelled) return;
      setCustomers(customersData);
      setBrands(brandsData);
      setHolidays(holidaysData);
      setPrinters(staffData.filter((s) => s.role === "admin" || s.permissions?.pechatnik?.edit));
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

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const rows = useMemo<Row[]>(() => {
    return products
      .map((product) => {
        const order = ordersMap.get(product.order_id);
        return order ? { product, order } : null;
      })
      .filter((r): r is Row => r !== null)
      .filter((r) => !ORDER_CLOSED_STATUSES.includes(r.order.status));
  }, [products, ordersMap]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => categoryFilter === "all" || r.product.category === categoryFilter)
      .filter((r) => !onlyUnassigned || (r.product.category === "Textil" && !r.product.assigned_printer_email))
      .filter((r) => {
        if (!q) return true;
        const customer = r.order.customer_id ? customersMap.get(r.order.customer_id) : null;
        const brand = r.order.brand_id ? brandsMap.get(r.order.brand_id) : null;
        return [
          r.order.order_number,
          r.order.title,
          r.product.product_name,
          customer?.first_name,
          customer?.last_name,
          brand?.name,
        ]
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
  }, [rows, categoryFilter, onlyUnassigned, search, customersMap, brandsMap]);

  const unassignedCount = useMemo(
    () => rows.filter((r) => r.product.category === "Textil" && !r.product.assigned_printer_email).length,
    [rows],
  );

  const assign = async (productId: string, email: string, name: string) => {
    try {
      await updateOne("order_products", productId, {
        assigned_printer_email: email,
        assigned_printer_name: name,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <Printer className="h-6 w-6 text-brand-600" /> Ishlab chiqarish
          </h1>
          <p className="text-sm text-ink-500">
            Barcha buyurtmalar mahsulotlari — Textil mahsulotlarga pechatnik biriktiring
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Barcha kategoriyalar</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {unassignedCount > 0 && (
            <label className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-600 shadow-sm">
              <input
                type="checkbox"
                checked={onlyUnassigned}
                onChange={(e) => setOnlyUnassigned(e.target.checked)}
              />
              Faqat biriktirilmagan ({unassignedCount})
            </label>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, mijoz, brend, mahsulot..."
              className="w-52 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
        </div>
      </div>

      <AsyncState
        loading={loading}
        empty={visibleRows.length === 0}
        emptyLabel="Mahsulotlar topilmadi"
        emptyDescription="Buyurtmaga mahsulot qo'shilsa, u shu yerda avtomatik ko'rinadi"
        emptyIcon={<Printer className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map(({ product, order }) => (
            <ProductionProductCard
              key={product.id}
              mode="dispatch"
              product={product}
              order={order}
              customer={order.customer_id ? customersMap.get(order.customer_id) || null : null}
              brand={order.brand_id ? brandsMap.get(order.brand_id) || null : null}
              holidays={holidays}
              canAssign={canEdit}
              printers={printers}
              onAssign={(email, name) => assign(product.id, email, name)}
            />
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
