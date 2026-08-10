import { useEffect, useState } from "react";
import { Target, TrendingUp, Wallet, PackageOpen, ClipboardList, CircleCheck as CheckCircle2 } from "lucide-react";
import { getOne, listAll } from "../../lib/firestoreDb";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import { computeWorkdayStats, monthRange, startOfDay } from "../../lib/workdays";
import type { Holiday, MonthlyPlan, Order } from "../../lib/types";
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
};

const emptyStats: Stats = {
  plan: 0,
  revenue: 0,
  debt: 0,
  activeCount: 0,
  todayCount: 0,
  doneCount: 0,
};

const planId = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export default function Dashboard() {
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

      const [allOrders, planRow, holidaysData] = await Promise.all([
        listAll<Order>("orders", { orderBy: ["created_at", "desc"] }),
        getOne<MonthlyPlan>(
          "monthly_plans",
          planId(today.getFullYear(), today.getMonth() + 1),
        ),
        listAll<Holiday>("holidays"),
      ]);

      if (cancelled) return;

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
      });
      setHolidays(holidaysData);
      setRecentOrders(allOrders.slice(0, 6));
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const workday = computeWorkdayStats(new Date(), holidays);
  const planProgress = stats.plan > 0 ? (stats.revenue / stats.plan) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashboardHero />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <WorkdaysPanel stats={workday} />
        <div className="xl:col-span-2">
          <ManagerStatsPanel />
        </div>
      </div>

      <RecentOrdersPanel orders={recentOrders} loading={loading} />
    </div>
  );
}
