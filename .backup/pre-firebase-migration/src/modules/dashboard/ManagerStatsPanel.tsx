import { useEffect, useState } from "react";
import { UserRound, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatMoney, formatMoneyShort, initialsOf } from "../../lib/format";
import { monthRange } from "../../lib/workdays";
import type { Manager } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";

type Row = {
  manager: Manager;
  revenue: number;
  progress: number;
};

export default function ManagerStatsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { start, end } = monthRange(new Date());
      const [managersRes, ordersRes] = await Promise.all([
        supabase.from("managers").select("*").order("created_at"),
        supabase
          .from("orders")
          .select("manager_name, total_amount")
          .gte("created_at", start)
          .lt("created_at", end),
      ]);
      if (cancelled) return;
      const managers = (managersRes.data as Manager[]) || [];
      const orders =
        ((ordersRes.data as { manager_name: string; total_amount: number }[]) ||
          []);
      const totals = new Map<string, number>();
      for (const o of orders) {
        const key = (o.manager_name || "").trim();
        if (!key) continue;
        totals.set(key, (totals.get(key) || 0) + Number(o.total_amount || 0));
      }
      const nextRows: Row[] = managers.map((m) => {
        const revenue = totals.get(m.name) || 0;
        const progress =
          Number(m.monthly_plan) > 0 ? (revenue / Number(m.monthly_plan)) * 100 : 0;
        return { manager: m, revenue, progress };
      });
      nextRows.sort((a, b) => b.progress - a.progress);
      setRows(nextRows);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card p-5 h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">
              Managerlar statistikasi
            </h2>
            <p className="text-xs text-ink-500">Oy bo'yicha reja bajarilishi</p>
          </div>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Managerlar mavjud emas"
        emptyDescription="Sozlamalar bo'limida managerlarni qo'shing"
        emptyIcon={<UserRound className="h-5 w-5" />}
      >
        <div className="space-y-3">
          {rows.map(({ manager, revenue, progress }) => (
            <div
              key={manager.id}
              className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white">
                {initialsOf(manager.name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-ink-800">
                    {manager.name}
                  </div>
                  <div className="text-sm font-semibold text-ink-700">
                    {formatMoneyShort(revenue)}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="progress-track flex-1">
                    <div
                      className={`progress-bar ${
                        progress >= 100
                          ? "bg-emerald-500"
                          : progress >= 60
                          ? "bg-brand-600"
                          : progress >= 30
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(150, progress)}%` }}
                    />
                  </div>
                  <div
                    className={`w-14 text-right text-xs font-bold ${
                      progress >= 100 ? "text-emerald-600" : "text-ink-700"
                    }`}
                  >
                    {progress.toFixed(0)}%
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-ink-500">
                  Reja: {formatMoney(manager.monthly_plan)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
