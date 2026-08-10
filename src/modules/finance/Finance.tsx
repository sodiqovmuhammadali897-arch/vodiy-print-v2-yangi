import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Download,
  FileDown,
  Truck,
  Percent,
  UserPlus,
  Repeat,
  Lock,
} from "lucide-react";
import { getOne, listAll } from "../../lib/firestoreDb";
import type {
  CostTier,
  Customer,
  Expense,
  MonthlyPlan,
  Order,
  OrderPayment,
  OrderProduct,
  Product,
  ProductCost,
} from "../../lib/types";
import { tierCostFor } from "../../lib/priceTiers";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import {
  defaultDateRange,
  inRange,
  type DateRange,
} from "../../lib/dateRange";
import { segmentCustomersByFirstOrder } from "../../lib/customerSegments";
import { exportCsv } from "../../lib/exportCsv";
import { exportNodeToPdf } from "../../lib/exportPdf";
import { useAuth } from "../../lib/AuthContext";
import StatCard from "../../components/ui/StatCard";
import DateRangeFilter from "../../components/ui/DateRangeFilter";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import ExpensesPanel from "./ExpensesPanel";
import DebtsPanel from "./DebtsPanel";

const PAYMENT_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];

const planId = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default function Finance() {
  const { isAdmin } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [costByProductName, setCostByProductName] = useState<Map<string, CostTier[]>>(new Map());

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const [ordersData, paymentsData, expensesData, customersData, planData] =
      await Promise.all([
        listAll<Order>("orders"),
        listAll<OrderPayment>("order_payments"),
        listAll<Expense>("expenses", { orderBy: ["date", "desc"] }),
        listAll<Customer>("customers"),
        getOne<MonthlyPlan>("monthly_plans", planId(now.getFullYear(), now.getMonth() + 1)),
      ]);
    setOrders(ordersData);
    setPayments(paymentsData);
    setExpenses(expensesData);
    setCustomers(new Map(customersData.map((c) => [c.id, c])));
    setPlan(planData);

    if (isAdmin) {
      const [orderProductsData, productsData, costsData] = await Promise.all([
        listAll<OrderProduct>("order_products"),
        listAll<Product>("products"),
        listAll<ProductCost>("product_costs"),
      ]);
      setOrderProducts(orderProductsData);
      const costById = new Map(costsData.map((c) => [c.id, c.cost_tiers || []]));
      const byName = new Map<string, CostTier[]>();
      for (const p of productsData) {
        const costTiers = costById.get(p.id);
        if (costTiers && costTiers.length > 0) byName.set(p.name, costTiers);
      }
      setCostByProductName(byName);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const ordersInRange = useMemo(
    () => orders.filter((o) => inRange(o.order_date || o.created_at, range)),
    [orders, range],
  );
  const paymentsInRange = useMemo(
    () => payments.filter((p) => inRange(p.payment_date, range)),
    [payments, range],
  );
  const expensesInRange = useMemo(
    () => expenses.filter((e) => inRange(e.date, range)),
    [expenses, range],
  );

  // "Kirim" is order revenue for the period (matches how Dashboard/Reports
  // define revenue), not just cash already collected — an order counts the
  // moment it's placed, even if it's still unpaid (see Umumiy qarzdorlik).
  const income = ordersInRange
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const collected = paymentsInRange.reduce((s, p) => s + Number(p.amount || 0), 0);
  const expenseTotal = expensesInRange.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = income - expenseTotal;
  const discountTotal = ordersInRange.reduce(
    (s, o) => s + Number(o.discount_amount || 0),
    0,
  );
  const deliveryTotal = ordersInRange.reduce(
    (s, o) => s + Number(o.delivery_cost || 0),
    0,
  );
  const debtTotal = orders
    .filter((o) => o.status !== "cancelled")
    .reduce(
      (s, o) =>
        s +
        (Number(o.remaining_amount || 0) ||
          Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0))),
      0,
    );

  const planProgress = plan && plan.plan_amount > 0 ? (income / plan.plan_amount) * 100 : 0;

  const customerSegments = useMemo(
    () => segmentCustomersByFirstOrder(orders, range),
    [orders, range],
  );

  // Real (cost-adjusted) profit: only computable for admins, since cost
  // price is admin-only, and only for order lines whose product_name
  // matches a catalog product exactly — lines with no match are excluded.
  const cogs = useMemo(() => {
    if (!isAdmin) return 0;
    const orderIdsInRange = new Set(ordersInRange.map((o) => o.id));
    return orderProducts
      .filter((p) => orderIdsInRange.has(p.order_id))
      .reduce((s, p) => {
        const quantity = Number(p.quantity || 0);
        const costTiers = costByProductName.get(p.product_name?.trim() || "");
        if (!costTiers) return s;
        return s + tierCostFor(costTiers, quantity) * quantity;
      }, 0);
  }, [isAdmin, orderProducts, costByProductName, ordersInRange]);
  const realProfit = profit - cogs;

  const paymentTypeDonut: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paymentsInRange) {
      map.set(p.payment_type || "Boshqa", (map.get(p.payment_type || "Boshqa") || 0) + Number(p.amount || 0));
    }
    return Array.from(map.entries()).map(([label, value], i) => ({
      label,
      value,
      color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
    }));
  }, [paymentsInRange]);

  const exportOverviewCsv = () => {
    exportCsv(`moliya-${range.from}_${range.to}`, ["Ko'rsatkich", "Qiymat"], [
      ["Davr", `${range.from} - ${range.to}`],
      ["Kirim (buyurtmalar summasi)", income],
      ["To'langan (naqd kirim)", collected],
      ["Chiqim", expenseTotal],
      ["Sof foyda", profit],
      ["Chegirmalar", discountTotal],
      ["Yetkazish xarajati", deliveryTotal],
      ["Umumiy qarzdorlik", debtTotal],
      ["Yangi mijozlar soni", customerSegments.newCount],
      ["Yangi mijozlardan kirim", customerSegments.newRevenue],
      ["Doimiy mijozlar soni", customerSegments.returningCount],
      ["Doimiy mijozlardan kirim", customerSegments.returningRevenue],
    ]);
  };

  const exportPdf = async () => {
    if (containerRef.current) {
      await exportNodeToPdf(containerRef.current, `moliya-${range.from}_${range.to}`);
    }
  };

  return (
    <div className="space-y-5" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Moliya</h1>
          <p className="text-sm text-ink-500">Kirim-chiqim va qarzdorlik nazorati</p>
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
          title="Kirim"
          value={formatMoneyShort(income)}
          hint={`${formatMoney(income)} · Buyurtmalar summasi`}
          tone="emerald"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Chiqim"
          value={formatMoneyShort(expenseTotal)}
          hint={formatMoney(expenseTotal)}
          tone="rose"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <StatCard
          title="Sof foyda"
          value={formatMoneyShort(profit)}
          hint={formatMoney(profit)}
          tone={profit >= 0 ? "brand" : "rose"}
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard
          title="Umumiy qarzdorlik"
          value={formatMoneyShort(debtTotal)}
          hint={formatMoney(debtTotal)}
          tone="amber"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="To'langan (naqd kirim)"
          value={formatMoneyShort(collected)}
          hint={`${formatMoney(collected)} · Qarzdorlik: ${formatMoney(debtTotal)}`}
          tone="emerald"
          icon={<Wallet className="h-5 w-5" />}
        />
        {plan && range.preset === "month" && (
          <StatCard
            title="Reja / Fakt (bu oy)"
            value={`${planProgress.toFixed(0)}%`}
            hint={`Reja: ${formatMoney(plan.plan_amount)} · Fakt: ${formatMoney(income)}`}
            tone={planProgress >= 100 ? "emerald" : "brand"}
            icon={<Target className="h-5 w-5" />}
            progress={planProgress}
          />
        )}
        <StatCard
          title="Chegirmalar"
          value={formatMoneyShort(discountTotal)}
          hint={formatMoney(discountTotal)}
          tone="sky"
          icon={<Percent className="h-5 w-5" />}
        />
        <StatCard
          title="Yetkazish xarajati"
          value={formatMoneyShort(deliveryTotal)}
          hint={formatMoney(deliveryTotal)}
          tone="violet"
          icon={<Truck className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Yangi mijozlardan kirim"
          value={formatMoneyShort(customerSegments.newRevenue)}
          hint={`${customerSegments.newCount} ta yangi mijoz`}
          tone="sky"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          title="Doimiy mijozlardan kirim"
          value={formatMoneyShort(customerSegments.returningRevenue)}
          hint={`${customerSegments.returningCount} ta doimiy mijoz`}
          tone="emerald"
          icon={<Repeat className="h-5 w-5" />}
        />
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Haqiqiy sof foyda (tan narx bilan) — faqat admin
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard
              title="Mahsulot tannarxi (COGS)"
              value={formatMoneyShort(cogs)}
              hint={formatMoney(cogs)}
              tone="amber"
              icon={<Lock className="h-5 w-5" />}
            />
            <StatCard
              title="Haqiqiy sof foyda"
              value={formatMoneyShort(realProfit)}
              hint={formatMoney(realProfit)}
              tone={realProfit >= 0 ? "emerald" : "rose"}
              icon={<PiggyBank className="h-5 w-5" />}
            />
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Faqat "Mahsulotlar" katalogida tan narxi kiritilgan va nomi
            buyurtmadagi nom bilan aynan mos kelgan mahsulotlar hisobga
            olinadi — bu taxminiy ko'rsatkich.
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-ink-900">
          To'lov turlari bo'yicha to'langan summalar
        </h2>
        <SimpleDonutChart data={paymentTypeDonut} />
      </div>

      <ExpensesPanel expenses={expensesInRange} loading={loading} onChanged={load} />

      <DebtsPanel orders={orders} customers={customers} loading={loading} />
    </div>
  );
}
