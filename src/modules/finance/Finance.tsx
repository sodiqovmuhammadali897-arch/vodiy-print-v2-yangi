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
  Customer,
  Expense,
  MonthlyPlan,
  Order,
  OrderCost,
  OrderPayment,
  OrderProduct,
} from "../../lib/types";
import { buildMarginRows, isSaleOrder, profitBreakdown, summarize } from "../../lib/margin";
import { canViewMargin } from "../../lib/rolePermissions";
import { isSale } from "../../lib/salesPeriod";
import { Link } from "react-router-dom";
import ProfitLines from "../margin/ProfitLines";
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
import SuppliersPanel from "./SuppliersPanel";

const PAYMENT_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];

const planId = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default function Finance() {
  const auth = useAuth();
  const showMargin = canViewMargin(auth);
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderCosts, setOrderCosts] = useState<Map<string, OrderCost>>(new Map());

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

    if (showMargin) {
      const [orderProductsData, costsData] = await Promise.all([
        listAll<OrderProduct>("order_products"),
        listAll<OrderCost>("order_costs"),
      ]);
      setOrderProducts(orderProductsData);
      setOrderCosts(new Map(costsData.map((c) => [c.id, c])));
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMargin]);

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
    .filter(isSale)
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
  const debtOf = (list: Order[]) =>
    list
      .filter((o) => o.status !== "cancelled")
      .reduce(
        (s, o) =>
          s +
          (Number(o.remaining_amount || 0) ||
            Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0))),
        0,
      );
  // Whatever is still owed today: for the period, on the orders placed in
  // it ("O'tgan oy" — what is left of last month's orders); overall, on all.
  const debtTotal = debtOf(orders);
  const periodDebt = debtOf(ordersInRange);
  const debtCard = (
    <StatCard
      title="Qarzdorlik (shu davr)"
      value={formatMoneyShort(periodDebt)}
      hint={`${formatMoney(periodDebt)} · Umumiy: ${formatMoney(debtTotal)}`}
      tone="amber"
      icon={<Wallet className="h-5 w-5" />}
    />
  );

  const planProgress = plan && plan.plan_amount > 0 ? (income / plan.plan_amount) * 100 : 0;

  const customerSegments = useMemo(
    () => segmentCustomersByFirstOrder(orders, range),
    [orders, range],
  );

  // Real profit from the costs typed on the Marja page (admin-only):
  // revenue − cost = gross; − the other expenses = net (supplier and raw
  // material payments are the cost itself, so they aren't subtracted twice).
  const breakdown = useMemo(() => {
    if (!showMargin) return null;
    const summary = summarize(buildMarginRows(ordersInRange.filter(isSaleOrder), orderProducts, orderCosts));
    return profitBreakdown(summary, expensesInRange);
  }, [showMargin, ordersInRange, orderProducts, orderCosts, expensesInRange]);

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
      ...(breakdown && breakdown.mode === "margin"
        ? ([
            ["Tannarx (Marja)", breakdown.cost],
            ["Yalpi foyda", breakdown.gross],
            ["Xarajatlar (tannarxdan tashqari)", breakdown.otherExpenses],
            ["Sof foyda", breakdown.net],
          ] as [string, number][])
        : ([
            ["Chiqim", expenseTotal],
            ["Sof foyda", profit],
          ] as [string, number][])),
      ["Chegirmalar", discountTotal],
      ["Yetkazish xarajati", deliveryTotal],
      ["Qarzdorlik (shu davr buyurtmalari)", periodDebt],
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

      {breakdown ? (
        // Admins: cost from the Marja page, then the expenses typed below.
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Kirim"
            value={formatMoneyShort(breakdown.revenue)}
            hint={`${formatMoney(breakdown.revenue)} · Buyurtmalar summasi`}
            tone="emerald"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Tannarx (Marja)"
            value={breakdown.costedLines ? formatMoneyShort(breakdown.cost) : "—"}
            hint={
              <>
                {breakdown.costedLines ? `kiritilgan: ${breakdown.costedLines} / ${breakdown.lines} qator · ` : "hali kiritilmagan · "}
                <Link to="/margin" className="font-semibold text-brand-700 hover:underline">
                  Marja →
                </Link>
              </>
            }
            tone="violet"
            icon={<Lock className="h-5 w-5" />}
            progress={breakdown.lines ? (breakdown.costedLines / breakdown.lines) * 100 : undefined}
          />
          <StatCard
            title={breakdown.mode === "margin" ? "Xarajatlar" : "Chiqim"}
            value={formatMoneyShort(breakdown.otherExpenses)}
            hint={
              breakdown.mode === "margin" && breakdown.costExpenses > 0
                ? `${formatMoney(breakdown.otherExpenses)} · ta'minotchi/xomashyo (${formatMoneyShort(breakdown.costExpenses)}) tannarxda`
                : formatMoney(breakdown.otherExpenses)
            }
            tone="rose"
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <StatCard
            title="Sof foyda"
            value={formatMoneyShort(breakdown.net)}
            hint={
              breakdown.mode === "margin"
                ? `${formatMoney(breakdown.net)} · kirim − tannarx − xarajat${breakdown.missingLines ? ` (${breakdown.missingLines} qator tannarxsiz)` : ""}`
                : `${formatMoney(breakdown.net)} · kirim − chiqim`
            }
            tone={breakdown.net >= 0 ? "brand" : "rose"}
            icon={<PiggyBank className="h-5 w-5" />}
          />
          {debtCard}
        </div>
      ) : (
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
        {debtCard}
      </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="To'langan (naqd kirim)"
          value={formatMoneyShort(collected)}
          hint={`${formatMoney(collected)} · Qarzdorlik (shu davr): ${formatMoney(periodDebt)}`}
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

      {breakdown && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-700" />
              <h2 className="font-display text-base font-bold text-ink-900">Foyda tarkibi (tannarx bilan) — faqat admin</h2>
            </div>
            <Link to="/margin" className="text-sm font-semibold text-brand-700 hover:underline">
              Marja panelida tannarx kiritish →
            </Link>
          </div>
          <ProfitLines b={breakdown} />
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

      <SuppliersPanel expenses={expenses} loading={loading} onChanged={load} />
    </div>
  );
}

