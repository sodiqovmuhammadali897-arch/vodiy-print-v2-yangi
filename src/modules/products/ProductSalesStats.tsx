import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { CostTier, Order, OrderProduct, Product, ProductCost } from "../../lib/types";
import { getOne, listAll, listWhere } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { canViewMargin } from "../../lib/rolePermissions";
import { tierCostFor } from "../../lib/priceTiers";
import { formatMoney } from "../../lib/format";

type Props = { product: Product };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ProductSalesStats({ product }: Props) {
  const auth = useAuth();
  const showMargin = canViewMargin(auth);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OrderProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [costTiers, setCostTiers] = useState<CostTier[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      listWhere<OrderProduct>("order_products", "product_name", product.name),
      listAll<Order>("orders"),
      showMargin ? getOne<ProductCost>("product_costs", product.id) : Promise.resolve(null),
    ]).then(([its, ords, cost]) => {
      if (cancelled) return;
      setItems(its);
      setOrders(ords);
      setCostTiers(cost?.cost_tiers ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.name, showMargin]);

  const stats = useMemo(() => {
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const recent = items.filter((it) => {
      const o = orderById.get(it.order_id);
      const d = o?.order_date || o?.created_at;
      return !!d && new Date(d).getTime() >= cutoff;
    });

    const soldQty = recent.reduce((s, it) => s + (it.quantity || 0), 0);
    const salesSum = recent.reduce((s, it) => s + (it.total || 0), 0);
    const orderIds = new Set(recent.map((it) => it.order_id));

    const qtyFreq = new Map<number, number>();
    items.forEach((it) => qtyFreq.set(it.quantity, (qtyFreq.get(it.quantity) || 0) + 1));
    let topQty = 0;
    let topFreq = 0;
    qtyFreq.forEach((freq, qty) => {
      if (freq > topFreq) {
        topFreq = freq;
        topQty = qty;
      }
    });

    const byCustomer = new Map<string, number>();
    items.forEach((it) => {
      const cid = orderById.get(it.order_id)?.customer_id;
      if (!cid) return;
      byCustomer.set(cid, (byCustomer.get(cid) || 0) + 1);
    });
    let repeatOrders = 0;
    byCustomer.forEach((count) => {
      if (count > 1) repeatOrders += count - 1;
    });

    let totalProfit: number | null = null;
    let avgMargin: number | null = null;
    if (showMargin && costTiers) {
      let totalCost = 0;
      recent.forEach((it) => {
        totalCost += tierCostFor(costTiers, it.quantity) * (it.quantity || 0);
      });
      totalProfit = salesSum - totalCost;
      avgMargin = totalCost > 0 ? (totalProfit / totalCost) * 100 : null;
    }

    return {
      soldQty,
      salesSum,
      ordersCount: orderIds.size,
      avgPrice: soldQty > 0 ? salesSum / soldQty : 0,
      topQty,
      repeatOrders,
      totalProfit,
      avgMargin,
    };
  }, [items, orders, costTiers, showMargin]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">
          Sotuv statistikasi <span className="font-normal text-ink-400">· oxirgi 30 kun</span>
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Sotilgan dona" value={`${stats.soldQty} ${product.unit || "dona"}`} />
        <Stat label="Sotuv summasi" value={formatMoney(stats.salesSum)} />
        <Stat label="Buyurtmalar soni" value={`${stats.ordersCount} ta`} />
        <Stat label="O'rtacha sotuv narxi" value={formatMoney(stats.avgPrice)} />
        <Stat label="Eng ko'p sotilgan tiraj" value={stats.topQty ? `${stats.topQty} ${product.unit || "dona"}` : "-"} />
        <Stat label="Qayta buyurtma soni" value={`${stats.repeatOrders} ta`} />
        {showMargin && stats.totalProfit !== null && (
          <>
            <Stat label="Umumiy foyda" value={formatMoney(stats.totalProfit)} tone="emerald" />
            <Stat
              label="O'rtacha marja"
              value={stats.avgMargin !== null ? `${stats.avgMargin.toFixed(1)}%` : "-"}
              tone="emerald"
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "emerald" }) {
  return (
    <div className="rounded-xl bg-ink-50/60 px-3 py-2.5">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${tone === "emerald" ? "text-emerald-700" : "text-ink-900"}`}>
        {value}
      </div>
    </div>
  );
}
