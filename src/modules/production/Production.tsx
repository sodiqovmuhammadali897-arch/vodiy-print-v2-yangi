import { useEffect, useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { listAll, subscribeAll, updateOne } from "../../lib/firestoreDb";
import type {
  Brand,
  Customer,
  Holiday,
  Order,
  OrderFile,
  OrderProduct,
  OrderStatus,
} from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { changeOrderStatus } from "../../lib/orderStatus";
import { orderStatusLabel } from "../../components/ui/StatusBadge";
import AsyncState from "../../components/ui/AsyncState";
import ProductionOrderCard from "./ProductionOrderCard";

const PRINTER_STATUSES: OrderStatus[] = [
  "new",
  "accepted",
  "production",
  "quality_control",
  "ready",
];

export default function Production() {
  const { user, staff, isAdmin, can } = useAuth();
  const canEdit = can("production", "edit");

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [printers, setPrinters] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [customersData, brandsData, holidaysData, filesData, staffData] = await Promise.all([
        listAll<Customer>("customers"),
        listAll<Brand>("brands"),
        listAll<Holiday>("holidays"),
        listAll<OrderFile>("order_files"),
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
      ]);
      if (cancelled) return;
      setCustomers(customersData);
      setBrands(brandsData);
      setHolidays(holidaysData);
      setFiles(filesData);
      setPrinters(staffData.filter((s) => s.role === "admin" || s.permissions?.production?.edit));
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
  const filesByOrder = useMemo(() => {
    const map = new Map<string, OrderFile[]>();
    for (const f of files) {
      const arr = map.get(f.order_id) || [];
      arr.push(f);
      map.set(f.order_id, arr);
    }
    return map;
  }, [files]);
  const textileProductsByOrder = useMemo(() => {
    const map = new Map<string, OrderProduct[]>();
    for (const p of products) {
      if (p.category !== "Textil") continue;
      const arr = map.get(p.order_id) || [];
      arr.push(p);
      map.set(p.order_id, arr);
    }
    return map;
  }, [products]);

  const textileOrders = useMemo(
    () => orders.filter((o) => textileProductsByOrder.has(o.id)),
    [orders, textileProductsByOrder],
  );

  const myEmail = (user?.email || "").toLowerCase();
  const visibleOrders = useMemo(() => {
    const scoped = isAdmin
      ? textileOrders
      : textileOrders.filter((o) => (o.assigned_printer_email || "").toLowerCase() === myEmail);
    const q = search.trim().toLowerCase();
    return scoped
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (!q) return true;
        const customer = o.customer_id ? customersMap.get(o.customer_id) : null;
        const brand = o.brand_id ? brandsMap.get(o.brand_id) : null;
        return [o.order_number, o.title, customer?.first_name, customer?.last_name, brand?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db_ = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db_;
      });
  }, [textileOrders, isAdmin, myEmail, statusFilter, search, customersMap, brandsMap]);

  const actorInfo = () => ({
    email: user?.email || "",
    name: staff?.full_name || user?.email || "",
  });

  const accept = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await changeOrderStatus(orderId, "production", actorInfo());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const finish = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await changeOrderStatus(orderId, "ready", actorInfo());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const reassign = async (orderId: string, email: string, name: string) => {
    try {
      await updateOne("orders", orderId, {
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
            {isAdmin
              ? "Barcha textil buyurtmalar — muddat bo'yicha saralangan"
              : "Sizga biriktirilgan textil buyurtmalar"}
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
        empty={visibleOrders.length === 0}
        emptyLabel="Textil buyurtmalar topilmadi"
        emptyDescription={
          isAdmin
            ? "Buyurtmada Textil kategoriyali mahsulot bo'lsa, u shu yerda avtomatik ko'rinadi"
            : "Sizga hozircha buyurtma biriktirilmagan"
        }
        emptyIcon={<Printer className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((o) => (
            <ProductionOrderCard
              key={o.id}
              order={o}
              customer={o.customer_id ? customersMap.get(o.customer_id) || null : null}
              brand={o.brand_id ? brandsMap.get(o.brand_id) || null : null}
              textileProducts={textileProductsByOrder.get(o.id) || []}
              files={filesByOrder.get(o.id) || []}
              holidays={holidays}
              canAct={
                isAdmin ||
                (canEdit && (o.assigned_printer_email || "").toLowerCase() === myEmail)
              }
              isAdmin={isAdmin}
              busy={busyId === o.id}
              printers={printers}
              onAccept={() => accept(o.id)}
              onReady={() => finish(o.id)}
              onReassign={(email, name) => reassign(o.id, email, name)}
            />
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
