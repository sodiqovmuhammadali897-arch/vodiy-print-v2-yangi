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
} from "lucide-react";
import { getOne, listAll } from "../../lib/firestoreDb";
import type { Customer, Expense, MonthlyPlan, Order, OrderPayment } from "../../lib/types";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import {
  defaultDateRange,
  inRange,
  type DateRange,
} from "../../lib/dateRange";
import { exportCsv } from "../../lib/exportCsv";
import { exportNodeToPdf } from "../../lib/exportPdf";
import StatCard from "../../components/ui/StatCard";
import DateRangeFilter from "../../components/ui/DateRangeFilter";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import ExpensesPanel from "./ExpensesPanel";
import DebtsPanel from "./DebtsPanel";

const PAYMENT_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];

const planId = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default function Finance() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);

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
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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

  const income = paymentsInRange.reduce((s, p) => s + Number(p.amount || 0), 0);
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
      ["Kirim", income],
      ["Chiqim", expenseTotal],
      ["Sof foyda", profit],
      ["Chegirmalar", discountTotal],
      ["Yetkazish xarajati", deliveryTotal],
      ["Umumiy qarzdorlik", debtTotal],
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
          hint={formatMoney(income)}
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

      <div className="card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-ink-900">
          To'lov turlari bo'yicha kirim
        </h2>
        <SimpleDonutChart data={paymentTypeDonut} />
      </div>

      <ExpensesPanel expenses={expensesInRange} loading={loading} onChanged={load} />

      <DebtsPanel orders={orders} customers={customers} loading={loading} />
    </div>
  );
}
