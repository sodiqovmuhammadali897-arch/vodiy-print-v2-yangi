import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Users,
  Factory,
  Tag,
  ShapesIcon,
  Briefcase,
  Timer,
  Download,
  FileDown,
  UserPlus,
  Repeat,
} from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Brand, Customer, Order, OrderProduct } from "../../lib/types";
import { formatMoney, formatMoneyShort, monthNameUz } from "../../lib/format";
import { customerTypeInfo } from "../../lib/orderConstants";
import {
  dayBuckets,
  defaultDateRange,
  growthPercent,
  inRange,
  previousPeriod,
  type DateRange,
} from "../../lib/dateRange";
import { segmentCustomersByFirstOrder } from "../../lib/customerSegments";
import { exportCsv } from "../../lib/exportCsv";
import { exportNodeToPdf } from "../../lib/exportPdf";
import StatCard from "../../components/ui/StatCard";
import DateRangeFilter from "../../components/ui/DateRangeFilter";
import SimpleBarChart, { type BarPoint } from "../../components/ui/SimpleBarChart";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import AsyncState from "../../components/ui/AsyncState";

const PALETTE = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6", "#64748b", "#ec4899"];

const growthTone = (pct: number | null): "emerald" | "rose" | "brand" => {
  if (pct === null) return "brand";
  if (pct > 0) return "emerald";
  if (pct < 0) return "rose";
  return "brand";
};

export default function Reports() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ordersData, productsData, customersData, brandsData] = await Promise.all([
        listAll<Order>("orders"),
        listAll<OrderProduct>("order_products"),
        listAll<Customer>("customers"),
        listAll<Brand>("brands"),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
      setCustomers(customersData);
      setBrands(brandsData);
      setLoading(false);
    };
    void load();
  }, []);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const ordersInRange = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && inRange(o.order_date || o.created_at, range)),
    [orders, range],
  );
  const prevRange = useMemo(() => previousPeriod(range), [range]);
  const ordersPrevRange = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && inRange(o.order_date || o.created_at, prevRange)),
    [orders, prevRange],
  );

  const orderIdsInRange = useMemo(() => new Set(ordersInRange.map((o) => o.id)), [ordersInRange]);
  const productsInRange = useMemo(
    () => products.filter((p) => orderIdsInRange.has(p.order_id)),
    [products, orderIdsInRange],
  );

  const totalRevenue = ordersInRange.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const prevRevenue = ordersPrevRange.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const orderCount = ordersInRange.length;
  const prevOrderCount = ordersPrevRange.length;
  const avgCheck = orderCount > 0 ? totalRevenue / orderCount : 0;
  const prevAvgCheck = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

  const revenueGrowth = growthPercent(totalRevenue, prevRevenue);
  const countGrowth = growthPercent(orderCount, prevOrderCount);
  const avgCheckGrowth = growthPercent(avgCheck, prevAvgCheck);

  // Revenue trend: daily buckets, or monthly when the range spans a long period.
  const trendData: BarPoint[] = useMemo(() => {
    const days = dayBuckets(range);
    if (days.length > 62) {
      const byMonth = new Map<string, number>();
      for (const o of ordersInRange) {
        const d = (o.order_date || o.created_at || "").slice(0, 7);
        if (!d) continue;
        byMonth.set(d, (byMonth.get(d) || 0) + Number(o.total_amount || 0));
      }
      return Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const [, m] = key.split("-");
          return { label: monthNameUz(Number(m)).slice(0, 3), value };
        });
    }
    const byDay = new Map<string, number>();
    for (const o of ordersInRange) {
      const d = (o.order_date || o.created_at || "").slice(0, 10);
      if (!d) continue;
      byDay.set(d, (byDay.get(d) || 0) + Number(o.total_amount || 0));
    }
    return days.map((d) => ({
      label: d.slice(5),
      value: byDay.get(d) || 0,
    }));
  }, [ordersInRange, range]);

  // Top-selling products by quantity.
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const p of productsInRange) {
      const name = p.product_name?.trim() || "Noma'lum";
      const cur = map.get(name) || { name, quantity: 0, revenue: 0 };
      cur.quantity += Number(p.quantity || 0);
      cur.revenue += Number(p.total || 0);
      map.set(name, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [productsInRange]);

  // Category breakdown.
  const categoryDonut: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of productsInRange) {
      const cat = p.category || "Boshqa";
      map.set(cat, (map.get(cat) || 0) + Number(p.total || 0));
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [productsInRange]);

  // Manager ranking.
  const managerRows = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of ordersInRange) {
      const name = (o.manager_name || "").trim() || "Belgilanmagan";
      const cur = map.get(name) || { name, revenue: 0, count: 0 };
      cur.revenue += Number(o.total_amount || 0);
      cur.count += 1;
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [ordersInRange]);

  // Production company breakdown.
  const productionDonut: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      const key = o.production_company || "Boshqa";
      map.set(key, (map.get(key) || 0) + Number(o.total_amount || 0));
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [ordersInRange]);

  // Brand revenue ranking.
  const brandRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      if (!o.brand_id) continue;
      map.set(o.brand_id, (map.get(o.brand_id) || 0) + Number(o.total_amount || 0));
    }
    return Array.from(map.entries())
      .map(([brandId, revenue]) => ({ brand: brandMap.get(brandId), revenue }))
      .filter((r) => r.brand)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [ordersInRange, brandMap]);

  // Top customers.
  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      if (!o.customer_id) continue;
      map.set(o.customer_id, (map.get(o.customer_id) || 0) + Number(o.total_amount || 0));
    }
    return Array.from(map.entries())
      .map(([customerId, revenue]) => ({ customer: customerMap.get(customerId), revenue }))
      .filter((r) => r.customer)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [ordersInRange, customerMap]);

  // Customer type distribution among those who ordered in range.
  const customerTypeDonut: DonutSlice[] = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      if (!o.customer_id || seen.has(o.customer_id)) continue;
      seen.add(o.customer_id);
      const c = customerMap.get(o.customer_id);
      const type = c?.customer_type || "new";
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries()).map(([key, value], i) => ({
      label: customerTypeInfo(key).label,
      value,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [ordersInRange, customerMap]);

  // Industry distribution among those who ordered in range.
  const industryDonut: DonutSlice[] = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      if (!o.customer_id || seen.has(o.customer_id)) continue;
      seen.add(o.customer_id);
      const c = customerMap.get(o.customer_id);
      const industry = c?.industry?.trim() || "Belgilanmagan";
      map.set(industry, (map.get(industry) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [ordersInRange, customerMap]);

  // On-time delivery rate among orders completed within the range.
  const onTimeStats = useMemo(() => {
    const completed = orders.filter(
      (o) => o.completed_at && inRange(o.completed_at, range) && o.deadline,
    );
    const onTime = completed.filter((o) => o.completed_at! <= o.deadline! + "T23:59:59");
    return { total: completed.length, onTime: onTime.length };
  }, [orders, range]);
  const onTimeRate = onTimeStats.total > 0 ? (onTimeStats.onTime / onTimeStats.total) * 100 : null;

  const customerSegments = useMemo(
    () => segmentCustomersByFirstOrder(orders, range),
    [orders, range],
  );

  const exportOverviewCsv = () => {
    exportCsv(`hisobot-${range.from}_${range.to}`, ["Ko'rsatkich", "Qiymat"], [
      ["Davr", `${range.from} - ${range.to}`],
      ["Buyurtmalar soni", orderCount],
      ["Umumiy summa", totalRevenue],
      ["O'rtacha chek", Math.round(avgCheck)],
      ["Muddatda bajarilgan", `${onTimeStats.onTime}/${onTimeStats.total}`],
      ["Yangi mijozlar soni", customerSegments.newCount],
      ["Yangi mijozlardan tushum", customerSegments.newRevenue],
      ["Doimiy mijozlar soni", customerSegments.returningCount],
      ["Doimiy mijozlardan tushum", customerSegments.returningRevenue],
    ]);
  };

  const exportTopProductsCsv = () => {
    exportCsv(
      `top-mahsulotlar-${range.from}_${range.to}`,
      ["Mahsulot", "Miqdor", "Summa"],
      topProducts.map((p) => [p.name, p.quantity, p.revenue]),
    );
  };

  const exportPdf = async () => {
    if (containerRef.current) {
      await exportNodeToPdf(containerRef.current, `hisobot-${range.from}_${range.to}`);
    }
  };

  return (
    <div className="space-y-5" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Hisobot</h1>
          <p className="text-sm text-ink-500">
            Sotuv, mijozlar va menejerlar bo'yicha kengaytirilgan hisobotlar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={exportOverviewCsv}>
            <Download className="h-4 w-4" /> CSV
          </button>
          <button className="btn-secondary" onClick={exportPdf}>
            <FileDown className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Buyurtmalar soni"
          value={orderCount}
          hint={<GrowthHint pct={countGrowth} />}
          tone={growthTone(countGrowth)}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          title="Umumiy summa"
          value={formatMoneyShort(totalRevenue)}
          hint={<GrowthHint pct={revenueGrowth} money={formatMoney(totalRevenue)} />}
          tone={growthTone(revenueGrowth)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="O'rtacha chek"
          value={formatMoneyShort(avgCheck)}
          hint={<GrowthHint pct={avgCheckGrowth} money={formatMoney(avgCheck)} />}
          tone={growthTone(avgCheckGrowth)}
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatCard
          title="Muddatda bajarilgan"
          value={onTimeRate === null ? "-" : `${onTimeRate.toFixed(0)}%`}
          hint={`${onTimeStats.onTime}/${onTimeStats.total} buyurtma`}
          tone={onTimeRate === null ? "brand" : onTimeRate >= 80 ? "emerald" : onTimeRate >= 50 ? "amber" : "rose"}
          icon={<Timer className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Yangi mijozlar"
          value={customerSegments.newCount}
          hint={`Tushum: ${formatMoney(customerSegments.newRevenue)}`}
          tone="sky"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          title="Doimiy mijozlar"
          value={customerSegments.returningCount}
          hint={`Tushum: ${formatMoney(customerSegments.returningRevenue)}`}
          tone="emerald"
          icon={<Repeat className="h-5 w-5" />}
        />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-ink-900">
          Tushum dinamikasi
        </h2>
        <SimpleBarChart data={trendData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Eng ko'p sotilgan mahsulotlar
            </h2>
            <button
              className="btn-ghost ml-auto text-xs"
              onClick={exportTopProductsCsv}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          <AsyncState loading={loading} empty={topProducts.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-ink-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink-800">{p.name}</div>
                    <div className="progress-track mt-1">
                      <div
                        className="progress-bar bg-brand-600"
                        style={{
                          width: `${topProducts[0] ? (p.quantity / topProducts[0].quantity) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold text-ink-800">{p.quantity} dona</div>
                    <div className="text-ink-500">{formatMoneyShort(p.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Menejerlar reytingi
            </h2>
          </div>
          <AsyncState loading={loading} empty={managerRows.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {managerRows.map((m, i) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-400">{i + 1}</span>
                    <span className="font-medium text-ink-800">{m.name}</span>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold text-ink-800">{formatMoneyShort(m.revenue)}</div>
                    <div className="text-ink-500">{m.count} ta buyurtma</div>
                  </div>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Factory className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">
              Ishlab chiqaruvchilar
            </h2>
          </div>
          <SimpleDonutChart data={productionDonut} size={130} />
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShapesIcon className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">
              Kategoriya bo'yicha sotuv
            </h2>
          </div>
          <SimpleDonutChart data={categoryDonut} size={130} />
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">
              Mijozlar turi
            </h2>
          </div>
          <SimpleDonutChart data={customerTypeDonut} size={130} />
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">
              Soha bo'yicha mijozlar
            </h2>
          </div>
          <SimpleDonutChart data={industryDonut} size={130} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">
            Eng foydali mijozlar
          </h2>
          <AsyncState loading={loading} empty={topCustomers.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {topCustomers.map(({ customer, revenue }, i) => (
                <div
                  key={customer!.id}
                  className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-400">{i + 1}</span>
                    <span className="font-medium text-ink-800">
                      {customer!.first_name} {customer!.last_name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-ink-800">
                    {formatMoneyShort(revenue)}
                  </span>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">
            Brendlar bo'yicha daromad
          </h2>
          <AsyncState loading={loading} empty={brandRows.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {brandRows.map(({ brand, revenue }, i) => (
                <div
                  key={brand!.id}
                  className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-400">{i + 1}</span>
                    <span className="font-medium text-ink-800">{brand!.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink-800">
                    {formatMoneyShort(revenue)}
                  </span>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
      </div>
    </div>
  );
}

function GrowthHint({ pct, money }: { pct: number | null; money?: string }) {
  if (pct === null) {
    return <>{money}</>;
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const cls = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-rose-600" : "text-ink-500";
  return (
    <span className="inline-flex items-center gap-1">
      {money && <span>{money}</span>}
      <span className={`inline-flex items-center gap-0.5 ${cls}`}>
        <Icon className="h-3 w-3" /> {Math.abs(pct).toFixed(0)}%
      </span>
    </span>
  );
}
