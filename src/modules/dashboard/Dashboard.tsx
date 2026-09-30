import { useEffect, useMemo, useState } from "react";
import { Target, TrendingUp, TrendingDown, Wallet, PackageOpen, ClipboardList, CircleCheck as CheckCircle2, Hourglass, Info } from "lucide-react";
import { getOne, listAll } from "../../lib/firestoreDb";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import { computeWorkdayStats, startOfDay } from "../../lib/workdays";
import { currentMonth, isSale, saleDay } from "../../lib/salesPeriod";
import { useAuth } from "../../lib/AuthContext";
import { ownOrdersOnly } from "../../lib/orderScope";
import type { Expense, Holiday, Manager, MonthlyPlan, Order, OrderPayment } from "../../lib/types";
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
  const { can, isAdmin, staff } = useAuth();
  // Orders/finance data is permission-gated in Firestore rules (see
  // firestore.rules); a staff member can have dashboard.view without
  // orders.view or finance.view (e.g. attendance-only accounts). Querying
  // those collections anyway throws permission-denied, which used to
  // reject the whole Promise.all and freeze every stat — including ones
  // that don't depend on orders/finance — at its zero default.
  const canOrders = isAdmin || can("orders", "view");
  const canFinance = isAdmin || can("finance", "view");

  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [companyPlan, setCompanyPlan] = useState(0);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const today = new Date();
      const [allOrders, planRow, holidaysData, paymentRows, expenseRows, managerRows] = await Promise.all([
        canOrders ? listAll<Order>("orders", { orderBy: ["created_at", "desc"] }) : Promise.resolve([]),
        getOne<MonthlyPlan>("monthly_plans", planId(today.getFullYear(), today.getMonth() + 1)),
        listAll<Holiday>("holidays"),
        canOrders ? listAll<OrderPayment>("order_payments") : Promise.resolve([]),
        canFinance ? listAll<Expense>("expenses") : Promise.resolve([]),
        canOrders ? listAll<Manager>("managers", { orderBy: ["created_at", "asc"] }).catch(() => []) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setOrders(allOrders);
      setCompanyPlan(planRow?.plan_amount ?? 0);
      setHolidays(holidaysData);
      setPayments(paymentRows);
      setExpenses(expenseRows);
      setManagers(managerRows);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [canOrders, canFinance]);

  // Same rule as Buyurtmalar and Hisobot (lib/orderScope.ts): a staff
  // member set to "faqat o'ziniki" sees only their own numbers, whatever
  // their role. Everyone else sees the company and may pick one manager.
  const ownOnly = ownOrdersOnly(staff);
  const myManager = useMemo(
    () => (ownOnly ? managers.find((m) => m.id === staff?.report_manager_id) || null : null),
    [managers, staff],
  );
  const manager = myManager || managers.find((m) => m.id === picked) || null;
  // One person's numbers: company-wide cards (expenses) are hidden.
  const scopedView = !!manager || ownOnly;

  const { stats, recentOrders } = useMemo(() => {
    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const todayDateStr = dayStart.slice(0, 10);
    const name = manager ? manager.name.trim().toLowerCase() : "";
    // A linked account whose manager record is gone sees nothing rather than the company.
    const scoped = manager
      ? orders.filter((o) => (o.manager_name || "").trim().toLowerCase() === name)
      : ownOnly
        ? []
        : orders;
    const scopedIds = new Set(scoped.map((o) => o.id));

    const todayIncome = payments
      .filter((p) => p.payment_date === todayDateStr && (!manager || scopedIds.has(p.order_id)))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const todayExpense = expenses.filter((e) => e.date === todayDateStr).reduce((s, e) => s + Number(e.amount || 0), 0);
    const open = (o: Order) => o.status !== "delivered" && o.status !== "closed" && o.status !== "cancelled";
    // Same rule as Hisobot and Marja: the order's Sana, no cancelled or drafts.
    const month = currentMonth(today);
    const monthOrders = scoped.filter((o) => isSale(o) && saleDay(o).startsWith(month));

    const next: Stats = {
      plan: manager ? Number(manager.monthly_plan) || 0 : companyPlan,
      revenue: monthOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
      debt: monthOrders.reduce((s, o) => s + Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0)), 0),
      activeCount: monthOrders.filter(open).length,
      todayCount: scoped.filter((o) => o.created_at >= dayStart).length,
      doneCount: scoped.filter(
        (o) => (o.status === "delivered" || o.status === "closed") && !!o.completed_at && o.completed_at >= dayStart,
      ).length,
      todayIncome,
      todayExpense,
      unfinishedCount: scoped.filter(open).length,
    };
    return { stats: loading ? emptyStats : next, recentOrders: scoped.slice(0, 6) };
  }, [orders, payments, expenses, companyPlan, manager, ownOnly, loading]);

  const workday = computeWorkdayStats(new Date(), holidays);
  const planProgress = stats.plan > 0 ? (stats.revenue / stats.plan) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashboardHero />

      {canOrders && (ownOnly || managers.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              {ownOnly ? "Mening ko'rsatkichlarim" : manager ? manager.name : "Kompaniya bo'yicha"}
            </h2>
            <p className="text-xs text-ink-500">
              {manager ? `${manager.name} — shaxsiy reja, sotuv va buyurtmalar` : "Barcha menejerlarning umumiy ko'rsatkichlari"}
            </p>
          </div>
          {!ownOnly && (
            <select className="input w-auto" value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Kimning ko'rsatkichlari">
              <option value="">Umumiy (kompaniya)</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {(canOrders || (canFinance && !scopedView)) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {canOrders && (
            <>
              <StatCard
                title="Bu oy rejasi"
                value={formatMoneyShort(stats.plan)}
                hint={stats.plan > 0 ? <>Reja: {formatMoney(stats.plan)}</> : "Reja belgilanmagan"}
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
                hint={<>{manager ? "Qarz" : "Umumiy qarz"}: {formatMoney(stats.debt)}</>}
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
          {canFinance && !scopedView && (
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
        {canOrders && !ownOnly && (
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
