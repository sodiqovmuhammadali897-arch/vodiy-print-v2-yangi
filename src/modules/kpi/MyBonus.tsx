import { useState } from "react";
import { Coins, Loader2, Lock } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { currentMonth } from "../../lib/salesPeriod";
import { COMPONENTS, computeBonus, so } from "../../lib/managerBonus";
import { useBonusMonth } from "./useBonusMonth";
import { OrdersOfManager, ScoreBar } from "./KpiBonusPage";
import GoalPanel from "./GoalPanel";

// A manager's own bonus for a month — live while the month is open, the
// approved numbers after. Shown on Davomat va KPI → KPI for accounts linked
// to a Managerlar record.

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

export default function MyBonus() {
  const { staff, user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const managerId = staff?.report_manager_id || "";
  const email = (user?.email || "").toLowerCase();
  const { rows, settings, error } = useBonusMonth(month, managerId ? { managerId, email } : null);
  if (!managerId) return null;
  const r = rows?.[0];

  const hint = (() => {
    if (!r || r.frozen || !(r.plan > 0) || r.turnover >= r.plan) return null;
    const atPlan = computeBonus(r.fund, { ...r.result.scores, plan: 100 }, settings.weights).payout;
    const more = atPlan - r.result.payout;
    return more > 0 ? `Rejaga yana ${so(r.plan - r.turnover)} qoldi — bajarsangiz bonus +${so(more)} oshadi.` : null;
  })();

  const detail: Record<string, string> = r
    ? {
        plan: r.plan > 0 ? `Oborot ${so(r.turnover)} / reja ${so(r.plan)}. ${settings.plan_floor}% dan past bo'lsa bu qism 0.` : "Reja kiritilmagan — admin qo'yadi.",
        tasks: r.tasks.total ? `${r.tasks.total} ta vazifadan ${r.tasks.onTime} tasi muddatida${r.tasks.late ? `, ${r.tasks.late} tasi kechikkan` : ""}.` : "Bu oy hisoblanadigan vazifa yo'q.",
        attendance: "Davomat KPI'sidan: kelish, vaqtida kelish, ishlangan soat.",
        crm: r.result.scores.crm === null ? "Oy oxirida admin qo'yadi." : "Admin qo'ygan baho (amoCRM'da muddati o'tgan vazifa va javobsiz lid yo'qligi).",
      }
    : {};

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-lg font-bold text-ink-900">Mening bonusim</h2>
        </div>
        <input type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Oy" />
      </div>
      {error && <div className="card p-4 text-sm font-semibold text-rose-600">{error}</div>}
      {!r ? (
        !error && (
          <div className="flex justify-center py-10 text-ink-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr]">
          <div className="card p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
              {r.frozen && <Lock className="h-3 w-3" />}
              {r.frozen ? (r.kpiMonth?.status === "paid" ? "To'langan" : "Tasdiqlangan") : "Hozircha"}
            </div>
            <div className="mt-1 font-display text-[34px] font-extrabold tabular-nums text-ink-900">{so(r.result.payout)}</div>
            <div className="text-sm text-ink-500">
              bonus fondi {so(r.fund)} × KPI {r.result.total.toFixed(1).replace(".", ",")}%
            </div>
            <div className="mt-4">
              <ScoreBar row={r} weights={r.kpiMonth?.snapshot?.weights || settings.weights} />
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              {COMPONENTS.map((c) => (
                <div key={c.key} className="flex justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-700">
                    <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="tabular-nums text-ink-700">
                    <b className="text-ink-900">{r.result.points[c.key] === null ? "—" : r.result.points[c.key]!.toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}</b> / {settings.weights[c.key]}
                  </span>
                </div>
              ))}
            </div>
            {hint && <div className="mt-4 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-3 py-2.5 text-[13px] text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">💡 {hint}</div>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMPONENTS.map((c) => {
              const s = r.result.scores[c.key];
              return (
                <div key={c.key} className="card p-4">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-ink-500">
                    <span>{c.label}</span>
                    <span>{settings.weights[c.key]} ulush</span>
                  </div>
                  <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-900">{pct(s)}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, s || 0)}%`, background: c.color }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-500">{detail[c.key]}</p>
                </div>
              );
            })}
            {r.goalPlan && (
              <div className="sm:col-span-2">
                <GoalPanel row={r} />
              </div>
            )}
            <div className="card p-4 sm:col-span-2">
              <h3 className="font-display text-sm font-bold text-ink-900">Bonus fondi — buyurtmalar</h3>
              <div className="mt-1 overflow-x-auto">
                <OrdersOfManager row={r} admin={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
