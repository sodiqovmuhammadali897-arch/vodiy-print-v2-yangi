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
  PiggyBank,
  Percent,
  AlertTriangle,
  XCircle,
  Gauge,
} from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Brand, Customer, Expense, Manager, Order, OrderProduct } from "../../lib/types";
import { formatMoney, formatMoneyShort, monthNameUz } from "../../lib/format";
import { customerTypeInfo } from "../../lib/orderConstants";
import { remainingTimeLabel } from "../../lib/remainingTime";
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
import { useAuth } from "../../lib/AuthContext";
import StatCard from "../../components/ui/StatCard";
import DateRangeFilter from "../../components/ui/DateRangeFilter";
import SimpleBarChart, { type BarPoint } from "../../components/ui/SimpleBarChart";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import AsyncState from "../../components/ui/AsyncState";

const PALETTE = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6", "#64748b", "#ec4899"];
const STAGE_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#4f46e5"];
const DEBT_AGE_COLORS = ["#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

const growthTone = (pct: number | null): "emerald" | "rose" | "brand" => {
  if (pct === null) return "brand";
  if (pct > 0) return "emerald";
  if (pct < 0) return "rose";
  return "brand";
};

const daysBetween = (a: string, b: string): number =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export default function Reports() {
  const { can } = useAuth();
  const canViewFinance = can("finance", "view");
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [managerFilter, setManagerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ordersData, productsData, customersData, brandsData, managersData] = await Promise.all([
        listAll<Order>("orders"),
        listAll<OrderProduct>("order_products"),
        listAll<Customer>("customers"),
        listAll<Brand>("brands"),
        listAll<Manager>("managers"),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
      setCustomers(customersData);
      setBrands(brandsData);
      setManagers(managersData);
      // Expenses live behind the finance permission — a reports-only viewer
      // would get a Firestore permission error fetching them, so only ask
      // when allowed, and just hide the profit card otherwise.
      if (canViewFinance) {
        setExpenses(await listAll<Expense>("expenses"));
      }
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewFinance]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const managerPlanMap = useMemo(() => new Map(managers.map((m) => [m.name, m.monthly_plan])), [managers]);

  const managerNames = useMemo(
    () => Array.from(new Set(orders.map((o) => o.manager_name).filter(Boolean))).sort(),
    [orders],
  );

  const ordersInRange = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          inRange(o.order_date || o.created_at, range) &&
          (!managerFilter || o.manager_name === managerFilter),
      ),
    [orders, range, managerFilter],
  );
  const prevRange = useMemo(() => previousPeriod(range), [range]);
  const ordersPrevRange = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          inRange(o.order_date || o.created_at, prevRange) &&
          (!managerFilter || o.manager_name === managerFilter),
      ),
    [orders, prevRange, managerFilter],
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

  const expensesInRange = useMemo(
    () => expenses.filter((e) => inRange(e.date, range)),
    [expenses, range],
  );
  const expensesPrevRange = useMemo(
    () => expenses.filter((e) => inRange(e.date, prevRange)),
    [expenses, prevRange],
  );
  const totalExpense = expensesInRange.reduce((s, e) => s + Number(e.amount || 0), 0);
  const prevExpense = expensesPrevRange.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = totalRevenue - totalExpense;
  const prevProfit = prevRevenue - prevExpense;
  const profitGrowth = growthPercent(profit, prevProfit);

  // Total outstanding debt across ALL active orders (not range-scoped — a
  // debt doesn't stop being owed just because it fell outside the selected
  // window), mirroring how Finance/DebtsPanel treats it.
  const debtOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "cancelled")
        .map((o) => ({
          order: o,
          remaining:
            Number(o.remaining_amount || 0) ||
            Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0)),
        }))
        .filter((r) => r.remaining > 0),
    [orders],
  );
  const totalDebt = debtOrders.reduce((s, r) => s + r.remaining, 0);

  const paymentDiscipline =
    totalRevenue > 0 ? (ordersInRange.reduce((s, o) => s + Number(o.paid_amount || 0), 0) / totalRevenue) * 100 : null;

  // Per-day revenue/count buckets feed both the trend chart and the top
  // stat cards' sparklines, so it's computed once and reused.
  const dailySeries = useMemo(() => {
    const days = dayBuckets(range);
    const byDay = new Map<string, { revenue: number; count: number; expense: number }>();
    for (const o of ordersInRange) {
      const d = (o.order_date || o.created_at || "").slice(0, 10);
      if (!d) continue;
      const cur = byDay.get(d) || { revenue: 0, count: 0, expense: 0 };
      cur.revenue += Number(o.total_amount || 0);
      cur.count += 1;
      byDay.set(d, cur);
    }
    for (const e of expensesInRange) {
      const d = (e.date || "").slice(0, 10);
      if (!d) continue;
      const cur = byDay.get(d) || { revenue: 0, count: 0, expense: 0 };
      cur.expense += Number(e.amount || 0);
      byDay.set(d, cur);
    }
    return days.map((d) => byDay.get(d) || { revenue: 0, count: 0, expense: 0 });
  }, [ordersInRange, expensesInRange, range]);

  const revenueSparkline = useMemo(() => dailySeries.map((d) => d.revenue), [dailySeries]);
  const countSparkline = useMemo(() => dailySeries.map((d) => d.count), [dailySeries]);
  const avgCheckSparkline = useMemo(
    () => dailySeries.map((d) => (d.count > 0 ? d.revenue / d.count : 0)),
    [dailySeries],
  );
  const profitSparkline = useMemo(
    () => dailySeries.map((d) => d.revenue - d.expense),
    [dailySeries],
  );

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
    return days.map((d, i) => ({
      label: d.slice(5),
      value: dailySeries[i]?.revenue || 0,
    }));
  }, [ordersInRange, range, dailySeries]);

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
    const total = Array.from(map.values()).reduce((s, p) => s + p.revenue, 0);
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({ ...p, share: total > 0 ? (p.revenue / total) * 100 : 0 }));
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

  // Order pipeline: the same 4-milestone grouping used on the Buyurtmalar
  // "Jarayon" stepper, so the two pages agree on what "Yangi"/"Tayyor" mean.
  const stageDonut: DonutSlice[] = useMemo(() => {
    return [
      { key: "new", label: "Yangi", statuses: ["new", "accepted", "calculating", "awaiting_advance", "design", "approving"] },
      { key: "production", label: "Ishlab chiqarilmoqda", statuses: ["sent_to_production", "production", "quality_control"] },
      { key: "ready", label: "Tayyor", statuses: ["ready", "ready_to_deliver"] },
      { key: "delivered", label: "Yetkazildi", statuses: ["delivered", "closed"] },
    ].map((g, i) => ({
      label: g.label,
      value: ordersInRange.filter((o) => g.statuses.includes(o.status)).length,
      color: STAGE_COLORS[i],
    }));
  }, [ordersInRange]);

  // Manager ranking, with plan completion when a monthly plan is set.
  const managerRows = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of ordersInRange) {
      const name = (o.manager_name || "").trim() || "Belgilanmagan";
      const cur = map.get(name) || { name, revenue: 0, count: 0 };
      cur.revenue += Number(o.total_amount || 0);
      cur.count += 1;
      map.set(name, cur);
    }
    return Array.from(map.values())
      .map((m) => {
        const plan = managerPlanMap.get(m.name);
        return { ...m, plan: plan || 0, planPct: plan && plan > 0 ? (m.revenue / plan) * 100 : null };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [ordersInRange, managerPlanMap]);

  // Production company breakdown, as a table (spend, product count, avg
  // fulfillment days, share) rather than just a donut. Aggregated per
  // product line (not per order) — a single order's products can go to
  // different outsource companies.
  const ordersInRangeMap = useMemo(() => new Map(ordersInRange.map((o) => [o.id, o])), [ordersInRange]);
  const productionRows = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number; days: number[] }>();
    for (const p of productsInRange) {
      const name = p.production_company || "Boshqa";
      const cur = map.get(name) || { name, revenue: 0, count: 0, days: [] };
      cur.revenue += Number(p.total || 0);
      cur.count += 1;
      const order = ordersInRangeMap.get(p.order_id);
      const orderStart = order?.order_date || order?.created_at;
      if (p.production_completed_at && orderStart) {
        cur.days.push(daysBetween(orderStart, p.production_completed_at));
      }
      map.set(name, cur);
    }
    const total = Array.from(map.values()).reduce((s, r) => s + r.revenue, 0);
    return Array.from(map.values())
      .map((r) => ({
        name: r.name,
        revenue: r.revenue,
        count: r.count,
        avgDays: r.days.length > 0 ? r.days.reduce((s, d) => s + d, 0) / r.days.length : null,
        share: total > 0 ? (r.revenue / total) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [productsInRange, ordersInRangeMap]);

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

  // Top customers, by revenue (with order count shown alongside).
  const topCustomers = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const o of ordersInRange) {
      if (!o.customer_id) continue;
      const cur = map.get(o.customer_id) || { revenue: 0, count: 0 };
      cur.revenue += Number(o.total_amount || 0);
      cur.count += 1;
      map.set(o.customer_id, cur);
    }
    return Array.from(map.entries())
      .map(([customerId, v]) => ({ customer: customerMap.get(customerId), ...v }))
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

  // Overdue/late-risk breakdown of currently active (not closed) orders,
  // independent of the selected date range — a late order matters today
  // regardless of when it was placed.
  const lateBuckets = useMemo(() => {
    const active = orders.filter((o) => !["delivered", "closed", "cancelled"].includes(o.status));
    const rows = active
      .map((o) => ({ order: o, rt: remainingTimeLabel(o.deadline) }))
      .filter((r): r is { order: Order; rt: NonNullable<ReturnType<typeof remainingTimeLabel>> } => !!r.rt);
    const overdue2plus = rows.filter((r) => r.rt.overdue && r.rt.days >= 2);
    const overdue1 = rows.filter((r) => r.rt.overdue && r.rt.days < 2);
    const dueToday = rows.filter((r) => !r.rt.overdue && r.rt.days === 0);
    const worst = [...overdue2plus, ...overdue1]
      .sort((a, b) => b.rt.days - a.rt.days)
      .slice(0, 8);
    return { overdue2plus, overdue1, dueToday, worst };
  }, [orders]);

  // Debt aging: how long each unpaid balance has been outstanding, bucketed
  // by days since the order's deadline (0 for not-yet-due balances).
  const debtAgingDonut: DonutSlice[] = useMemo(() => {
    const buckets = [
      { label: "0 - 7 kun", min: 0, max: 7 },
      { label: "8 - 30 kun", min: 8, max: 30 },
      { label: "31 - 60 kun", min: 31, max: 60 },
      { label: "60+ kun", min: 61, max: Infinity },
    ];
    const sums = buckets.map(() => 0);
    for (const { order, remaining } of debtOrders) {
      const age = order.deadline ? Math.max(0, daysBetween(order.deadline, new Date().toISOString())) : 0;
      const idx = buckets.findIndex((b) => age >= b.min && age <= b.max);
      sums[idx === -1 ? 0 : idx] += remaining;
    }
    return buckets.map((b, i) => ({ label: b.label, value: sums[i], color: DEBT_AGE_COLORS[i] }));
  }, [debtOrders]);

  // Payment completeness of in-range orders.
  const paymentStatusRows = useMemo(() => {
    let full = 0;
    let partial = 0;
    let none = 0;
    for (const o of ordersInRange) {
      const paid = Number(o.paid_amount || 0);
      const total = Number(o.total_amount || 0);
      if (paid <= 0) none += total;
      else if (paid >= total) full += total;
      else partial += total;
    }
    const sum = full + partial + none || 1;
    return [
      { label: "To'landi to'liq", value: full, pct: (full / sum) * 100, cls: "bg-emerald-500" },
      { label: "Qisman to'langan", value: partial, pct: (partial / sum) * 100, cls: "bg-amber-500" },
      { label: "To'lanmagan", value: none, pct: (none / sum) * 100, cls: "bg-rose-500" },
    ];
  }, [ordersInRange]);

  // A handful of extra at-a-glance numbers that didn't warrant their own section.
  const extraStats = useMemo(() => {
    const cancelledCount = orders.filter(
      (o) => o.status === "cancelled" && inRange(o.order_date || o.created_at, range),
    ).length;
    const completed = orders.filter(
      (o) => o.completed_at && inRange(o.completed_at, range) && (o.order_date || o.created_at),
    );
    const avgProductionDays =
      completed.length > 0
        ? completed.reduce((s, o) => s + daysBetween(o.order_date || o.created_at, o.completed_at!), 0) /
          completed.length
        : null;
    return { cancelledCount, avgProductionDays };
  }, [orders, range]);

  const exportOverviewCsv = () => {
    exportCsv(`hisobot-${range.from}_${range.to}`, ["Ko'rsatkich", "Qiymat"], [
      ["Davr", `${range.from} - ${range.to}`],
      ["Buyurtmalar soni", orderCount],
      ["Umumiy summa", totalRevenue],
      ["O'rtacha chek", Math.round(avgCheck)],
      ...(canViewFinance ? [["Sof foyda", profit]] as [string, number][] : []),
      ["Umumiy qarzdorlik", totalDebt],
      ["Muddatda bajarilgan", `${onTimeStats.onTime}/${onTimeStats.total}`],
      ["Yangi mijozlar soni", customerSegments.newCount],
      ["Yangi mijozlardan tushum", customerSegments.newRevenue],
      ["Doimiy mijozlar soni", customerSegments.returningCount],
      ["Doimiy mijozlardan tushum", customerSegments.returningRevenue],
      ["Bekor qilingan buyurtmalar", extraStats.cancelledCount],
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

      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter value={range} onChange={setRange} />
        {managerNames.length > 0 && (
          <select className="input w-auto" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="">Barcha menejerlar</option>
            {managerNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Buyurtmalar soni"
          value={orderCount}
          hint={<GrowthHint pct={countGrowth} />}
          tone={growthTone(countGrowth)}
          icon={<ClipboardList className="h-5 w-5" />}
          sparkline={countSparkline}
        />
        <StatCard
          title="Umumiy summa"
          value={formatMoneyShort(totalRevenue)}
          hint={<GrowthHint pct={revenueGrowth} money={formatMoney(totalRevenue)} />}
          tone={growthTone(revenueGrowth)}
          icon={<Wallet className="h-5 w-5" />}
          sparkline={revenueSparkline}
        />
        <StatCard
          title="O'rtacha chek"
          value={formatMoneyShort(avgCheck)}
          hint={<GrowthHint pct={avgCheckGrowth} money={formatMoney(avgCheck)} />}
          tone={growthTone(avgCheckGrowth)}
          icon={<Receipt className="h-5 w-5" />}
          sparkline={avgCheckSparkline}
        />
        {canViewFinance ? (
          <StatCard
            title="Sof foyda"
            value={formatMoneyShort(profit)}
            hint={<GrowthHint pct={profitGrowth} money={formatMoney(profit)} />}
            tone={profit >= 0 ? growthTone(profitGrowth) : "rose"}
            icon={<PiggyBank className="h-5 w-5" />}
            sparkline={profitSparkline}
          />
        ) : (
          <StatCard
            title="Muddatda bajarilgan"
            value={onTimeRate === null ? "-" : `${onTimeRate.toFixed(0)}%`}
            hint={`${onTimeStats.onTime}/${onTimeStats.total} buyurtma`}
            tone={onTimeRate === null ? "brand" : onTimeRate >= 80 ? "emerald" : onTimeRate >= 50 ? "amber" : "rose"}
            icon={<Timer className="h-5 w-5" />}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {canViewFinance && (
          <StatCard
            title="Muddatda bajarilgan"
            value={onTimeRate === null ? "-" : `${onTimeRate.toFixed(0)}%`}
            hint={`${onTimeStats.onTime}/${onTimeStats.total} buyurtma`}
            tone={onTimeRate === null ? "brand" : onTimeRate >= 80 ? "emerald" : onTimeRate >= 50 ? "amber" : "rose"}
            icon={<Timer className="h-5 w-5" />}
          />
        )}
        <StatCard
          title="Qarzdorlik"
          value={formatMoneyShort(totalDebt)}
          hint={`${debtOrders.length} ta buyurtma`}
          tone={totalDebt > 0 ? "rose" : "emerald"}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="To'lov intizomi"
          value={paymentDiscipline === null ? "-" : `${paymentDiscipline.toFixed(0)}%`}
          hint="tanlangan davr bo'yicha"
          tone={paymentDiscipline === null ? "brand" : paymentDiscipline >= 90 ? "emerald" : paymentDiscipline >= 60 ? "amber" : "rose"}
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          title="Yangi mijozlar"
          value={customerSegments.newCount}
          hint={`Tushum: ${formatMoneyShort(customerSegments.newRevenue)}`}
          tone="sky"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          title="Doimiy mijozlar"
          value={customerSegments.returningCount}
          hint={`Tushum: ${formatMoneyShort(customerSegments.returningRevenue)}`}
          tone="emerald"
          icon={<Repeat className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Buyurtmalar jarayoni</h2>
          <SimpleDonutChart data={stageDonut} valueFormat="count" size={170} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Tushum dinamikasi</h2>
          <SimpleBarChart data={trendData} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Factory className="h-4 w-4 text-ink-500" />
          <h2 className="font-display text-base font-bold text-ink-900">Ishlab chiqaruvchilar tahlili</h2>
        </div>
        <AsyncState loading={loading} empty={productionRows.length === 0} emptyLabel="Ma'lumot yo'q">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase text-ink-500">
                  <th className="table-th">Kompaniya</th>
                  <th className="table-th text-right">Jami xarid</th>
                  <th className="table-th text-right">Mahsulot soni</th>
                  <th className="table-th text-right">O'rtacha kun</th>
                  <th className="table-th text-right">Ulush</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {productionRows.map((r) => (
                  <tr key={r.name}>
                    <td className="table-td font-medium text-ink-800">{r.name}</td>
                    <td className="table-td text-right">{formatMoney(r.revenue)}</td>
                    <td className="table-td text-right">{r.count} ta</td>
                    <td className="table-td text-right">{r.avgDays === null ? "-" : `${r.avgDays.toFixed(1)} kun`}</td>
                    <td className="table-td text-right font-semibold">{r.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Eng ko'p sotilgan mahsulotlar
            </h2>
            <button className="btn-ghost ml-auto text-xs" onClick={exportTopProductsCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          <AsyncState loading={loading} empty={topProducts.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase text-ink-500">
                    <th className="table-th">Mahsulot</th>
                    <th className="table-th text-right">Soni</th>
                    <th className="table-th text-right">Tushum</th>
                    <th className="table-th text-right">Ulush</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {topProducts.map((p) => (
                    <tr key={p.name}>
                      <td className="table-td font-medium text-ink-800">{p.name}</td>
                      <td className="table-td text-right">{p.quantity} dona</td>
                      <td className="table-td text-right">{formatMoneyShort(p.revenue)}</td>
                      <td className="table-td text-right font-semibold">{p.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">Menejerlar reytingi</h2>
          </div>
          <AsyncState loading={loading} empty={managerRows.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {managerRows.map((m, i) => (
                <div key={m.name} className="rounded-xl border border-ink-100 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-400">{i + 1}</span>
                      <span className="font-medium text-ink-800">{m.name}</span>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-ink-800">{formatMoneyShort(m.revenue)}</div>
                      <div className="text-ink-500">{m.count} ta buyurtma</div>
                    </div>
                  </div>
                  {m.planPct !== null && (
                    <div className="mt-2">
                      <div className="progress-track">
                        <div
                          className={`progress-bar ${m.planPct >= 100 ? "bg-emerald-500" : "bg-brand-600"}`}
                          style={{ width: `${Math.min(100, m.planPct)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-ink-500">
                        Reja bajarilishi: {m.planPct.toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShapesIcon className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">Kategoriya bo'yicha sotuv</h2>
          </div>
          <SimpleDonutChart data={categoryDonut} size={130} />
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">Mijozlar turi</h2>
          </div>
          <SimpleDonutChart data={customerTypeDonut} valueFormat="count" size={130} />
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-sm font-bold text-ink-900">Soha bo'yicha mijozlar</h2>
          </div>
          <SimpleDonutChart data={industryDonut} valueFormat="count" size={130} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Eng foydali mijozlar</h2>
          <AsyncState loading={loading} empty={topCustomers.length === 0} emptyLabel="Ma'lumot yo'q">
            <div className="space-y-2">
              {topCustomers.map(({ customer, revenue, count }, i) => (
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
                  <div className="text-right text-xs">
                    <div className="font-semibold text-ink-800">{formatMoneyShort(revenue)}</div>
                    <div className="text-ink-500">{count} ta buyurtma</div>
                  </div>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Brendlar bo'yicha daromad</h2>
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
                  <span className="text-sm font-semibold text-ink-800">{formatMoneyShort(revenue)}</span>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">Qarzdorlik tahlili</h2>
          </div>
          <SimpleDonutChart data={debtAgingDonut} size={150} />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">Buyurtmalar kechikish tahlili</h2>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-rose-50 p-3">
              <div className="font-display text-xl font-bold text-rose-700">{lateBuckets.overdue2plus.length} ta</div>
              <div className="text-[11px] text-rose-700">2+ kun kechikkan</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="font-display text-xl font-bold text-amber-700">{lateBuckets.overdue1.length} ta</div>
              <div className="text-[11px] text-amber-700">1 kun kechikkan</div>
            </div>
            <div className="rounded-xl bg-sky-50 p-3">
              <div className="font-display text-xl font-bold text-sky-700">{lateBuckets.dueToday.length} ta</div>
              <div className="text-[11px] text-sky-700">Bugun muddati</div>
            </div>
          </div>
          <AsyncState loading={loading} empty={lateBuckets.worst.length === 0} emptyLabel="Kechikkan buyurtma yo'q">
            <div className="space-y-1.5">
              {lateBuckets.worst.map(({ order, rt }) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-xs">
                  <span className="font-semibold text-brand-700">{order.order_number}</span>
                  <span className="text-ink-600">{order.title}</span>
                  <span className={rt.overdue ? "font-semibold text-rose-600" : "text-ink-500"}>{rt.label}</span>
                  <span className="font-semibold text-ink-800">{formatMoneyShort(order.total_amount)}</span>
                </div>
              ))}
            </div>
          </AsyncState>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Percent className="h-4 w-4 text-ink-500" />
            <h2 className="font-display text-base font-bold text-ink-900">To'lovlar statistikasi</h2>
          </div>
          <div className="space-y-3">
            {paymentStatusRows.map((r) => (
              <div key={r.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-700">{r.label}</span>
                  <span className="font-semibold text-ink-800">
                    {formatMoneyShort(r.value)} ({r.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div className={`progress-bar ${r.cls}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Qo'shimcha ko'rsatkichlar</h2>
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric icon={<UserPlus className="h-4 w-4" />} label="Yangi mijozlar" value={`${customerSegments.newCount} ta`} />
            <MiniMetric icon={<Repeat className="h-4 w-4" />} label="Qayta buyurtma qilgan" value={`${customerSegments.returningCount} ta`} />
            <MiniMetric
              icon={<Timer className="h-4 w-4" />}
              label="O'rtacha ishlab chiqarish vaqti"
              value={extraStats.avgProductionDays === null ? "-" : `${extraStats.avgProductionDays.toFixed(1)} kun`}
            />
            <MiniMetric icon={<XCircle className="h-4 w-4" />} label="Bekor qilingan buyurtmalar" value={`${extraStats.cancelledCount} ta`} tone="rose" />
          </div>
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

function MiniMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "rose";
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="flex items-center gap-1.5 text-ink-400">{icon}</div>
      <div className={`mt-1.5 font-display text-lg font-bold ${tone === "rose" ? "text-rose-600" : "text-ink-900"}`}>
        {value}
      </div>
      <div className="text-[11px] text-ink-500">{label}</div>
    </div>
  );
}
