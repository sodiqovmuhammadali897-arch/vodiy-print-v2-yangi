import { useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, CalendarCheck, Check, ChevronDown, ListChecks, Loader2, Lock, TrendingUp, X } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { currentMonth } from "../../lib/salesPeriod";
import { formatDate } from "../../lib/format";
import { dateCodeOf } from "../../utils/attendanceCalculations";
import { boostTips, canForecast, daysLeft, forecastPayout, monthLabel, monthProgress, num, rateLabel, short, so, type BoostTip, type KpiMonthStatus } from "../../lib/salesKpi";
import { useKpiMonth, type KpiRow } from "./useKpiMonth";

// Mening KPI — a manager's own month, live: the money earned so far up
// front, then what each part is made of, what would raise it, and the
// orders behind it. Works for any month the server has sums for.

export const pct = (n: number | null) => (n === null ? "—" : `${String(Math.round(n * 10) / 10).replace(".", ",")}%`);
const MONTHS_GEN = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
// "2026-11-22" → "22-noyabr".
export const dayLabel = (day: string) => `${Number(day.slice(8, 10))}-${MONTHS_GEN[Number(day.slice(5, 7)) - 1] || ""}`;

export function Gauge({ value, threshold, color = "bg-brand-600" }: { value: number; threshold?: number; color?: string }) {
  return (
    <div className="relative h-2.5 rounded-full bg-ink-100 dark:bg-ink-200">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {threshold !== undefined && <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-rose-500" style={{ left: `${threshold}%` }} title={`${threshold}% chegarasi`} />}
    </div>
  );
}

// The plan bar with a tick where the calendar is today.
export function PlanBar({ value, today, color }: { value: number; today?: number; color: string }) {
  return (
    <div className="relative h-2.5 rounded-full bg-ink-100 dark:bg-ink-200">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {today !== undefined && today > 0 && today < 100 && (
        <span className="absolute -top-1.5 h-[22px] w-0.5 rounded bg-ink-900 dark:bg-white" style={{ left: `${today}%` }} title={`bugungi kunga kerak ${Math.round(today)}%`} />
      )}
    </div>
  );
}

const STEPS: { key: KpiMonthStatus; label: string }[] = [
  { key: "open", label: "Hisoblanmoqda" },
  { key: "approved", label: "Tasdiqlandi" },
  { key: "paid", label: "To'landi" },
];

export default function MyKpi() {
  const { staff, user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [all, setAll] = useState(false);
  const managerId = staff?.report_manager_id || "";
  const email = (user?.email || "").toLowerCase();
  const { rows, settings, error } = useKpiMonth(month, managerId ? { managerId, email } : null);
  if (!managerId) return null;
  const r = rows?.[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink-900">Mening KPI</h2>
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
        <Body row={r} month={month} threshold={settings.threshold} all={all} setAll={setAll} />
      )}
    </section>
  );
}

function Body({ row: r, month, threshold, all, setAll }: { row: KpiRow; month: string; threshold: number; all: boolean; setAll: (v: boolean) => void }) {
  const today = dateCodeOf(new Date());
  const live = month === today.slice(0, 7);
  const progress = monthProgress(month, today);
  const forecast = forecastPayout(r, progress);
  const status = r.kpiMonth?.status || "open";
  const res = r.result;
  const planPct = res.planPct;
  const need = live ? progress * 100 : undefined;
  const debt = r.sales?.debt || 0;
  const tips = live && !r.frozen ? boostTips({ ...r, debt, attendanceOk: res.attendanceOk, amoOk: res.amoOk }) : [];
  const orders = [...(r.sales?.orders || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.n.localeCompare(a.n));
  const left = daysLeft(month, today);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Hero: the money */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-5 text-white shadow-lg shadow-brand-900/20 lg:col-span-2">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative">
          <div className="text-sm font-semibold text-white/85">{live ? "Shu oy topgan pulingiz" : `${monthLabel(month)} — topganingiz`}</div>
          <div className="mt-1 flex items-baseline gap-2 font-display font-extrabold tabular-nums">
            <span className="text-[40px] leading-none sm:text-5xl">{num(r.result.payout)}</span>
            <span className="text-lg font-bold text-white/80">so'm</span>
          </div>
          <div className="mt-1.5 text-[13px] text-white/85">
            {live ? `${dayLabel(today)} holati · oy oxirigacha ${left} kun` : r.frozen ? "Oy yopilgan — raqamlar qotirilgan" : "O'tgan oy — admin tasdiqlashini kutmoqda"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {live && !r.frozen && canForecast(progress) ? (
              <HeroTile value={`≈ ${short(forecast)}`} note="shu sur'atda oy oxiri" />
            ) : (
              <HeroTile value={short(res.salesBonus)} note="sotuvdan" />
            )}
            {res.eligible ? (
              <HeroTile value={`+${short(res.collectBonus)}`} note="kirim bonusi qo'shildi" />
            ) : res.collectPotential > 0 ? (
              <HeroTile value={`+${short(res.collectPotential)}`} note={r.frozen || !live ? "kirim bonusi — berilmadi" : "kirim bonusi kutyapti"} />
            ) : (
              <HeroTile value="0" note="kirim bonusi" />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => {
              const at = STEPS.findIndex((x) => x.key === status);
              const on = i === at;
              const done = i < at;
              return (
                <span
                  key={s.key}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-white text-brand-700" : done ? "bg-white/25 text-white" : "bg-white/10 text-white/70"}`}
                >
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
                  {done && <Check className="h-3 w-3" />}
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sotuv bonusi */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Sotuv bonusi</h3>
            <p className="text-xs text-ink-500">har doim to'lanadi</p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{short(res.salesBonus)}</div>
            <div className="text-[11px] font-semibold text-ink-500">topildi</div>
          </div>
        </div>
        <Formula>
          Sotuv <b>{short(r.salesSum)}</b> × {rateLabel(r.rates.sales_rate)} = <b>{short(res.salesBonus)}</b> · {r.sales?.order_count || 0} ta buyurtma
        </Formula>
        {planPct !== null ? (
          <div className="mt-4">
            <PlanBar value={planPct} today={need} color={planPct >= 100 ? "bg-emerald-500" : need !== undefined && planPct < need - 15 ? "bg-rose-500" : "bg-brand-600"} />
            <div className="mt-1.5 flex justify-between gap-2 text-xs text-ink-500">
              <span>
                Reja {short(r.rates.plan)} · <b className="text-ink-700">{Math.round(planPct)}%</b>
              </span>
              {need !== undefined && !r.frozen && (
                <span className={planPct >= need ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}>
                  bugungi kunga kerak {Math.round(need)}% {planPct >= need ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-500">Bu oyga reja qo'yilmagan.</p>
        )}
      </div>

      {/* Kirim bonusi */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Kirim bonusi</h3>
            <p className="text-xs text-ink-500">shartlar bajarilsa to'lanadi</p>
          </div>
          <div className="text-right">
            <div className={`font-display text-2xl font-extrabold tabular-nums ${res.eligible ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {short(res.eligible ? res.collectBonus : res.collectPotential)}
            </div>
            <div className="text-[11px] font-semibold text-ink-500">{res.eligible ? "topildi" : live && !r.frozen ? "hozir qulf" : "berilmadi"}</div>
          </div>
        </div>
        <Formula>
          Kirim <b>{short(r.collectedSum)}</b> × {rateLabel(r.rates.collect_rate)} = <b>{short(res.collectPotential)}</b>
        </Formula>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Condition ok={res.attendanceOk} value={r.staff ? pct(r.attendancePct) : "—"} label="Davomat" threshold={threshold} />
          <Condition ok={res.amoOk} value={pct(r.amoPct)} label="amoCRM vazifalar" threshold={threshold} muted={r.amoPct === null} />
        </div>
        {(r.attendance || (r.amo && r.amo.due > 0)) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {r.attendance && (r.attendance.lateCount > 0 || r.attendance.absent > 0) && (
              <span className="rounded-md bg-ink-100 px-1.5 py-0.5 dark:bg-ink-200/70 text-ink-700">
                {r.attendance.lateCount} marta kech · {r.attendance.absent} kun kelmagan
              </span>
            )}
            {r.amo && r.amo.due > 0 && (
              <span className="rounded-md bg-ink-100 px-1.5 py-0.5 dark:bg-ink-200/70 text-ink-700">
                {r.amo.on_time}/{r.amo.due} vazifa vaqtida
              </span>
            )}
            {!r.frozen && live && r.amo && r.amo.overdue_open > 0 && (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">muddati o'tgan: {r.amo.overdue_open}</span>
            )}
            {!r.frozen && live && r.amo && r.amo.no_task_leads > 0 && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">vazifasiz bitim: {r.amo.no_task_leads}</span>
            )}
          </div>
        )}
        <LockNote row={r} threshold={threshold} live={live} />
      </div>

      {/* Qanday ko'paytiraman */}
      {tips.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-base font-bold text-ink-900">Qanday ko'paytiraman</h3>
          <div className="mt-2 divide-y divide-ink-100">
            {tips.map((t) => (
              <Tip key={t.kind} tip={t} eligible={res.eligible} threshold={threshold} toPlan={r.rates.plan > r.salesSum} />
            ))}
          </div>
        </div>
      )}

      {/* Oxirgi buyurtmalar */}
      <div className={`card p-5 ${tips.length ? "" : "lg:col-span-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink-900">Oxirgi buyurtmalar</h3>
          {(orders.length > 3 || (r.sales?.payments.length || 0) > 0) && (
            <button type="button" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" onClick={() => setAll(!all)}>
              {all ? "Yig'ish" : "Hammasi"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${all ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {!orders.length ? (
          <p className="mt-2 text-sm text-ink-500">Bu oyda buyurtma yo'q</p>
        ) : (
          <div className="mt-1 divide-y divide-ink-100">
            {orders.slice(0, 3).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span className="min-w-0 truncate text-ink-600">
                  <b className="font-semibold text-ink-800">{o.n || "—"}</b> · {o.customer || o.title} · {short(o.total)}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-emerald-700 dark:text-emerald-400">+{short((o.total * r.rates.sales_rate) / 100)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {all && (
        <div className="lg:col-span-2">
          <LinesOfMonth row={r} />
        </div>
      )}
    </div>
  );
}

function HeroTile({ value, note }: { value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-3.5 py-3 backdrop-blur-sm">
      <div className="font-display text-lg font-extrabold tabular-nums">{value}</div>
      <div className="text-[11px] text-white/85">{note}</div>
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2.5 text-[13px] tabular-nums text-ink-700 dark:bg-ink-200/50">{children}</div>;
}

function Condition({ ok, value, label, threshold, muted }: { ok: boolean; value: string; label: string; threshold: number; muted?: boolean }) {
  const cls = muted
    ? "bg-ink-50 text-ink-500 dark:bg-ink-200/50"
    : ok
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <div className={`rounded-xl px-3 py-2.5 ${cls}`}>
      <div className="font-display text-xl font-extrabold tabular-nums">{value}</div>
      <div className="flex items-center gap-1 text-[11px] font-semibold">
        {label} {muted ? null : ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      </div>
      <div className="text-[11px] opacity-80">{muted ? "ma'lumot yo'q" : `kerak ${threshold}%`}</div>
    </div>
  );
}

// Why the collect part is locked, or a nudge when attendance is close.
function LockNote({ row, threshold, live }: { row: KpiRow; threshold: number; live: boolean }) {
  const res = row.result;
  const box = "mt-3 flex gap-2 rounded-xl px-3 py-2.5 text-[13px]";
  if (!row.staff)
    return <div className={`${box} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}>Xodim profili bog'lanmagan — admin Sozlamalar → Xodimlar'da bog'lashi kerak.</div>;
  if (!res.eligible && res.collectPotential > 0) {
    const what = !res.amoOk ? "Vazifalarni o'z vaqtida bajarib" : "Ishga o'z vaqtida kelib";
    return (
      <div className={`${box} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}>
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {live && !row.frozen ? (
            <>
              {what}, <b>{threshold}%</b> ga chiqaring — <b>{short(res.collectPotential)}</b> bonusingizga qo'shiladi.
            </>
          ) : (
            <>
              {!res.amoOk ? "amoCRM vazifalar" : "Davomat"} {threshold}% dan past bo'lgani uchun <b>{short(res.collectPotential)}</b> berilmadi.
            </>
          )}
        </span>
      </div>
    );
  }
  if (live && !row.frozen && row.attendancePct !== null && row.attendancePct < threshold + 5)
    return (
      <div className={`${box} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}>
        Davomat {threshold}% chegarasiga yaqin — kech qolmang, aks holda {short(res.collectPotential)} kirim bonusini yo'qotasiz.
      </div>
    );
  return null;
}

function Tip({ tip, eligible, threshold, toPlan }: { tip: BoostTip; eligible: boolean; threshold: number; toPlan: boolean }) {
  const icon = {
    sales: <TrendingUp className="h-4 w-4" />,
    debt: <Banknote className="h-4 w-4" />,
    tasks: <ListChecks className="h-4 w-4" />,
    attendance: <CalendarCheck className="h-4 w-4" />,
  }[tip.kind];
  const tint = {
    sales: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    debt: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    tasks: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    attendance: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  }[tip.kind];
  const g = <b className="text-emerald-700 dark:text-emerald-400">+{short(tip.gain)}</b>;
  const a = <b className="text-emerald-700 dark:text-emerald-400">{short(tip.amount)}</b>;
  return (
    <div className="flex items-center gap-3 py-3 text-sm text-ink-800">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span>
        {tip.kind === "sales" && (
          <>
            {toPlan ? "Rejagacha yana" : "Yana"} {a} sotuv → {g}
          </>
        )}
        {tip.kind === "debt" && (
          <>
            Qarzni undiring: {a} → {g}
            {!eligible && <span className="text-xs text-ink-500"> (shartlar bajarilsa)</span>}
          </>
        )}
        {tip.kind === "tasks" && (
          <>
            Vazifalar {threshold}% → kirim bonusi {g}
          </>
        )}
        {tip.kind === "attendance" && (
          <>
            Davomat {threshold}% dan yuqori → kirim bonusi {g}
          </>
        )}
      </span>
    </div>
  );
}

// The orders and payments behind the month's sums, each with what it adds.
export function LinesOfMonth({ row, admin = false }: { row: KpiRow; admin?: boolean }) {
  const s = row.sales;
  const orders = s?.orders || [];
  const payments = s?.payments || [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="card p-4">
        <h3 className="font-display text-sm font-bold text-ink-900">Buyurtmalar — sotuvdan {rateLabel(row.rates.sales_rate)}</h3>
        <div className="mt-1 max-h-96 overflow-auto">
          {!orders.length ? (
            <div className="py-3 text-sm text-ink-500">Bu oyda buyurtma yo'q</div>
          ) : (
            <table className="w-full text-[13px] tabular-nums">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-ink-100 first:border-0">
                    <td className="py-2 pr-3 font-semibold">
                      {admin ? (
                        <Link to={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                          {o.n || "—"}
                        </Link>
                      ) : (
                        o.n || "—"
                      )}
                      <div className="text-[11px] font-normal text-ink-400">{formatDate(o.date)}</div>
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-ink-700">{o.customer || o.title}</td>
                    <td className="py-2 pr-3 text-right">{so(o.total)}</td>
                    <td className="py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">+{so((o.total * row.rates.sales_rate) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-display text-sm font-bold text-ink-900">Kirim — {rateLabel(row.rates.collect_rate)}</h3>
        <div className="mt-1 max-h-96 overflow-auto">
          {!payments.length ? (
            <div className="py-3 text-sm text-ink-500">Bu oyda kirim yo'q</div>
          ) : (
            <table className="w-full text-[13px] tabular-nums">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-ink-100 first:border-0">
                    <td className="py-2 pr-3 font-semibold">
                      {admin ? (
                        <Link to={`/orders/${p.order_id}`} className="text-brand-700 hover:underline">
                          {p.n || "—"}
                        </Link>
                      ) : (
                        p.n || "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-500">{formatDate(p.date)}</td>
                    <td className="py-2 pr-3 text-right">{so(p.amount)}</td>
                    <td className={`py-2 text-right font-semibold ${row.result.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-ink-400 line-through"}`}>
                      +{so((p.amount * row.rates.collect_rate) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
