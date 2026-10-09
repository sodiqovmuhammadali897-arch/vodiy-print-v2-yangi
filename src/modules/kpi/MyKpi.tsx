import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Loader2, Lock } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { currentMonth } from "../../lib/salesPeriod";
import { formatDate } from "../../lib/format";
import { rateLabel, short, so } from "../../lib/salesKpi";
import { useKpiMonth, type KpiRow } from "./useKpiMonth";

// Mening KPI — a manager's own month, live: every order entered adds its
// sales %, every payment its collect % (while attendance and amoCRM hold).
// Shown on Davomat va KPI → KPI for accounts linked to a Managerlar record.

const pct = (n: number | null) => (n === null ? "—" : `${String(Math.round(n * 10) / 10).replace(".", ",")}%`);

export function Gauge({ value, threshold, color = "bg-brand-600" }: { value: number; threshold?: number; color?: string }) {
  return (
    <div className="relative h-2.5 rounded-full bg-ink-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {threshold !== undefined && <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-rose-500" style={{ left: `${threshold}%` }} title={`${threshold}% chegarasi`} />}
    </div>
  );
}

export default function MyKpi() {
  const { staff, user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const managerId = staff?.report_manager_id || "";
  const email = (user?.email || "").toLowerCase();
  const { rows, settings, error } = useKpiMonth(month, managerId ? { managerId, email } : null);
  if (!managerId) return null;
  const r = rows?.[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-lg font-bold text-ink-900">Mening KPI</h2>
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
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,1fr)_1.4fr]">
            <div className="card p-5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                {r.frozen && <Lock className="h-3 w-3" />}
                {r.frozen ? (r.kpiMonth?.status === "paid" ? "To'langan" : "Tasdiqlangan") : "Bugungacha"}
              </div>
              <div className="mt-1 font-display text-[34px] font-extrabold tabular-nums text-ink-900">{so(r.result.payout)}</div>
              <div className="text-sm text-ink-500">
                {so(r.result.salesBonus)} sotuvdan + {so(r.result.collectBonus)} kirimdan
              </div>
              {r.rates.plan > 0 && (
                <div className="mt-5">
                  <div className="flex justify-between text-[13px]">
                    <b className="text-ink-900">
                      Reja: {short(r.salesSum)} / {short(r.rates.plan)}
                    </b>
                    <span className="text-ink-500">{Math.round(r.result.planPct || 0)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <Gauge value={r.result.planPct || 0} color={(r.result.planPct || 0) >= 100 ? "bg-emerald-500" : "bg-brand-600"} />
                  </div>
                  {!r.frozen && r.salesSum < r.rates.plan && (
                    <div className="mt-1 text-xs text-ink-500">
                      qoldi {short(r.rates.plan - r.salesSum)} → yana +{short(((r.rates.plan - r.salesSum) * r.rates.sales_rate) / 100)}
                    </div>
                  )}
                </div>
              )}
              <Warning row={r} threshold={settings.threshold} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Part
                title={`Sotuvdan ${rateLabel(r.rates.sales_rate)} — aniq`}
                value={so(r.result.salesBonus)}
                note={`${r.sales?.order_count || 0} ta buyurtma, jami ${so(r.salesSum)}. Har yangi buyurtma darhol qo'shiladi.`}
              />
              <Part
                title={`Kirimdan ${rateLabel(r.rates.collect_rate)} — intizom`}
                value={so(r.result.eligible ? r.result.collectBonus : r.result.collectPotential)}
                strike={!r.result.eligible}
                note={
                  r.result.eligible
                    ? `Shu oy kelgan pul ${so(r.collectedSum)}.${r.sales && r.sales.debt > 0 && !r.frozen ? ` Mijozlar qarzi ${short(r.sales.debt)} — undirsangiz +${short((r.sales.debt * r.rates.collect_rate) / 100)}.` : ""}`
                    : `Davomat yoki amoCRM ${settings.threshold}% dan past — bu qism berilmaydi.`
                }
              />
              <div className="card p-4">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  <span>Davomat</span>
                  <span>chegara {settings.threshold}%</span>
                </div>
                <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${r.result.attendanceOk ? "text-ink-900" : "text-rose-600"}`}>{pct(r.attendancePct)}</div>
                <div className="mt-2">
                  <Gauge value={r.attendancePct ?? 0} threshold={settings.threshold} color={r.result.attendanceOk ? "bg-emerald-500" : "bg-rose-500"} />
                </div>
                {r.attendance && (
                  <p className="mt-2 text-xs text-ink-500">
                    {r.attendance.lateCount} marta kech ({r.attendance.lateMinutes} daq), {r.attendance.earlyCount} marta erta ketdi, {r.attendance.absent} kun kelmagan.
                  </p>
                )}
              </div>
              <div className="card p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">amoCRM zadachalar</div>
                <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-400">{pct(r.amoPct)}</div>
                <p className="mt-2 text-xs text-ink-500">Tez kunda ulanadi: amoCRM'dagi zadachalar vaqtida bajarilgani shu yerda hisoblanadi.</p>
              </div>
            </div>
          </div>
          <LinesOfMonth row={r} />
        </>
      )}
    </section>
  );
}

function Part({ title, value, note, strike }: { title: string; value: string; note: string; strike?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{title}</div>
      <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${strike ? "text-rose-600 line-through" : "text-ink-900"}`}>{value}</div>
      <p className="mt-2 text-xs text-ink-500">{note}</p>
    </div>
  );
}

// Close to losing (or already lost) the collect part: say so.
function Warning({ row, threshold }: { row: KpiRow; threshold: number }) {
  if (row.frozen || row.attendancePct === null) return null;
  if (!row.result.attendanceOk)
    return (
      <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
        ⚠️ Davomat {threshold}% dan past — kirim bonusi ({so(row.result.collectPotential)}) hozircha berilmaydi.
      </div>
    );
  if (row.attendancePct < threshold + 5)
    return (
      <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        ⚠️ Davomat {threshold}% chegarasiga yaqin — kech qolmang, aks holda kirim bonusini ({so(row.result.collectPotential)}) yo'qotasiz.
      </div>
    );
  return null;
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
