import { useEffect, useState } from "react";
import { Target, TrendingUp, TrendingDown, Wallet, PackageOpen, ClipboardList, CircleCheck as CheckCircle2, Hourglass, Info } from "lucide-react";
import { getOne, listAll } from "../../lib/firestoreDb";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import { computeWorkdayStats, monthRange, startOfDay } from "../../lib/workdays";
import { useAuth } from "../../lib/AuthContext";
import type { Expense, Holiday, MonthlyPlan, Order, OrderPayment } from "../../lib/types";
import StatCard from "../../components/ui/StatCard";
import DashboardHero from "./DashboardHero";
import WorkdaysPanel from "./WorkdaysPanel";
import ManagerStatsPanel from "./ManagerStatsPanel";
import RecentOrdersPanel from "./RecentOrdersPanel";

type Stats = {
  plan: number;
  revenue: number;
  debt: number;
  activeCount: number;
  todayCount: number;
  doneCount: number;
  todayIncome: number;
  todayExpense: number;
  unfinishedCount: number;
};

const emptyStats: Stats = {
  plan: 0,
  revenue: 0,
  debt: 0,
  activeCount: 0,
  todayCount: 0,
  doneCount: 0,
  todayIncome: 0,
  todayExpense: 0,
  unfinishedCount: 0,
};

const planId = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export default function Dashboard() {
  const { can, isAdmin } = useAuth();
  // Orders/finance data is permission-gated in Firestore rules (see
  // firestore.rules); a staff member can have dashboard.view without
  // orders.view or finance.view (e.g. attendance-only accounts). Querying
  // those collections anyway throws permission-denied, which used to
  // reject the whole Promise.all and freeze every stat — including ones
  // that don't depend on orders/finance — at its zero default.
  const canOrders = isAdmin || can("orders", "view");
  const canFinance = isAdmin || can("finance", "view");

  const [stats, setStats] = useState<Stats>(emptyStats);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const today = new Date();
      const { start, end } = monthRange(today);
      const dayStart = startOfDay(today).toISOString();

      const [allOrders, planRow, holidaysData, payments, expenses] = await Promise.all([
        canOrders ? listAll<Order>("orders", { orderBy: ["created_at", "desc"] }) : Promise.resolve([]),
        getOne<MonthlyPlan>(
          "monthly_plans",
          planId(today.getFullYear(), today.getMonth() + 1),
        ),
        listAll<Holiday>("holidays"),
        canOrders ? listAll<OrderPayment>("order_payments") : Promise.resolve([]),
        canFinance ? listAll<Expense>("expenses") : Promise.resolve([]),
      ]);

      if (cancelled) return;

      const todayDateStr = dayStart.slice(0, 10);
      const todayIncome = payments
        .filter((p) => p.payment_date === todayDateStr)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const todayExpense = expenses
        .filter((e) => e.date === todayDateStr)
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const unfinishedCount = allOrders.filter(
        (o) => o.status !== "delivered" && o.status !== "closed" && o.status !== "cancelled",
      ).length;

      const monthOrders = allOrders.filter(
        (o) => o.created_at >= start && o.created_at < end && o.status !== "cancelled",
      );
      const plan = planRow?.plan_amount ?? 0;
      const revenue = monthOrders.reduce(
        (s, o) => s + Number(o.total_amount || 0),
        0,
      );
      const debt = monthOrders.reduce(
        (s, o) =>
          s +
          Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0)),
        0,
      );
      const activeCount = monthOrders.filter(
        (o) =>
          o.status !== "delivered" &&
          o.status !== "closed" &&
          o.status !== "cancelled",
      ).length;
      const todayCount = allOrders.filter((o) => o.created_at >= dayStart).length;
      const doneCount = allOrders.filter(
        (o) =>
          (o.status === "delivered" || o.status === "closed") &&
          !!o.completed_at &&
          o.completed_at >= dayStart,
      ).length;

      setStats({
        plan,
        revenue,
        debt,
        activeCount,
        todayCount,
        doneCount,
        todayIncome,
        todayExpense,
        unfinishedCount,
      });
      setHolidays(holidaysData);
      setRecentOrders(allOrders.slice(0, 6));
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [canOrders, canFinance]);

  const workday = computeWorkdayStats(new Date(), holidays);
  const planProgress = stats.plan > 0 ? (stats.revenue / stats.plan) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashboardHero />

      {(canOrders || canFinance) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {canOrders && (
            <>
              <StatCard
                title="Bu oy rejasi"
                value={formatMoneyShort(stats.plan)}
                hint={<>Reja: {formatMoney(stats.plan)}</>}
                tone="brand"
                icon={<Target className="h-5 w-5" />}
                progress={planProgress}
                progressLabel={`${planProgress.toFixed(1)}% bajarilgan`}
              />
              <StatCard
                title="Bu oy aylanmasi"
                value={formatMoneyShort(stats.revenue)}
                hint={<>Real sotuv: {formatMoney(stats.revenue)}</>}
                tone="emerald"
                icon={<TrendingUp className="h-5 w-5" />}
                progress={Math.min(100, planProgress)}
                progressLabel="Rejaga nisbatan"
              />
              <StatCard
                title="Bu oy qarzdorlik"
                value={formatMoneyShort(stats.debt)}
                hint={<>Umumiy qarz: {formatMoney(stats.debt)}</>}
                tone="rose"
                icon={<Wallet className="h-5 w-5" />}
              />
              <StatCard
                title="Faol buyurtmalar"
                value={stats.activeCount}
                hint="Bu oy ichida ishlab turgan"
                tone="amber"
                icon={<PackageOpen className="h-5 w-5" />}
              />
              <StatCard
                title="Bugungi buyurtmalar"
                value={stats.todayCount}
                hint="Bugun tushgan zakazlar"
                tone="sky"
                icon={<ClipboardList className="h-5 w-5" />}
              />
              <StatCard
                title="Tugallangan buyurtmalar"
                value={stats.doneCount}
                hint="Bugun bajarilganlari"
                tone="emerald"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <StatCard
                title="Bugungi kirim"
                value={formatMoneyShort(stats.todayIncome)}
                hint={<>To'langan: {formatMoney(stats.todayIncome)}</>}
                tone="emerald"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                title="Bitmagan buyurtmalar"
                value={stats.unfinishedCount}
                hint="Hozircha yakunlanmagan, jami"
                tone="amber"
                icon={<Hourglass className="h-5 w-5" />}
              />
            </>
          )}
          {canFinance && (
            <StatCard
              title="Bugungi chiqim"
              value={formatMoneyShort(stats.todayExpense)}
              hint={<>Xarajat: {formatMoney(stats.todayExpense)}</>}
              tone="rose"
              icon={<TrendingDown className="h-5 w-5" />}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <WorkdaysPanel stats={workday} />
        {canOrders && (
          <div className="xl:col-span-2">
            <ManagerStatsPanel />
          </div>
        )}
      </div>

      {canOrders ? (
        <RecentOrdersPanel orders={recentOrders} loading={loading} />
      ) : (
        !canFinance && (
          <div className="card flex items-center gap-3 p-5 text-sm text-ink-600">
            <Info className="h-5 w-5 shrink-0 text-ink-400" />
            Buyurtmalar va moliya ko'rsatkichlarini ko'rish uchun sizda ruxsat
            yo'q. Kerak bo'lsa administratorga murojaat qiling.
          </div>
        )
      )}
    </div>
  );
}
