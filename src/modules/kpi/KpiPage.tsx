import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Download, Loader2, Lock, Settings2, Unlock, Wallet } from "lucide-react";
import { updateOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { exportCsv } from "../../lib/exportCsv";
import { currentMonth } from "../../lib/salesPeriod";
import { canSeeOwnKpi } from "../../lib/permissions";
import { canForecast, DEFAULT_SALES_KPI, forecastPayout, forecastSales, monthBefore, monthLabel, monthProgress, planState, rateLabel, short, so, type KpiMonth, type KpiSnapshot, type PlanState, type SalesKpiSettings } from "../../lib/salesKpi";
import { dateCodeOf } from "../../utils/attendanceCalculations";
import Modal from "../../components/ui/Modal";
import { useKpiMonth, type KpiRow } from "./useKpiMonth";
import MyKpi, { dayLabel, LinesOfMonth, pct, PlanBar } from "./MyKpi";
import RatesPanel, { type RatesSave } from "./RatesPanel";

// KPI (admin): every sales manager's month — sales % of the orders they
// entered, plus collect % of the money in when attendance and amoCRM
// tasks hold — with each manager's plan and rates, and month approval.

const STATUS: Record<KpiMonth["status"], { label: string; cls: string }> = {
  open: { label: "hisoblanmoqda", cls: "bg-ink-100 text-ink-700" },
  approved: { label: "tasdiqlangan", cls: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" },
  paid: { label: "to'landi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};

// A manager account sees only its own KPI here.
export default function KpiRoute() {
  const { isManagerAccount, staff } = useAuth();
  if (!isManagerAccount) return <KpiPage />;
  return canSeeOwnKpi(staff) ? <MyKpi /> : <div className="card p-6 text-sm text-ink-500">KPI'ni ko'rish uchun ruxsat yo'q.</div>;
}

function KpiPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const { rows, settings, error, reload } = useKpiMonth(month, null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const me = (user?.email || "").toLowerCase();

  const totals = useMemo(
    () => (rows || []).reduce((t, r) => ({ sales: t.sales + r.salesSum, collected: t.collected + r.collectedSum, payout: t.payout + r.result.payout }), { sales: 0, collected: 0, payout: 0 }),
    [rows],
  );

  const write = async (row: KpiRow, patch: Partial<KpiMonth>) => {
    setBusy(row.manager.id);
    setActionError(null);
    try {
      await upsertOne("kpi_months", `${month}_${row.manager.id}`, {
        id: `${month}_${row.manager.id}`,
        month,
        manager_id: row.manager.id,
        manager_name: row.manager.name,
        status: row.kpiMonth?.status || "open",
        ...patch,
      });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  // "Keyingi oylarga ham" also makes them the manager's standing values.
  const saveRates = async (row: KpiRow, v: RatesSave) => {
    if (v.carry) {
      try {
        await updateOne("managers", row.manager.id, { monthly_plan: v.plan || 0, sales_rate: v.sales_rate, collect_rate: v.collect_rate });
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
        return;
      }
    }
    await write(row, { plan: v.plan, sales_rate: v.sales_rate, collect_rate: v.collect_rate });
  };

  const snapshotOf = (r: KpiRow): KpiSnapshot => ({
    plan: r.rates.plan,
    sales: r.salesSum,
    collected: r.collectedSum,
    sales_rate: r.rates.sales_rate,
    collect_rate: r.rates.collect_rate,
    threshold: settings.threshold,
    attendance_pct: r.attendancePct,
    amo_pct: r.amoPct,
    sales_bonus: r.result.salesBonus,
    collect_bonus: r.result.collectBonus,
    eligible: r.result.eligible,
    payout: r.result.payout,
  });

  // Back to counting: the snapshot goes, the Telegram notes may go again,
  // and what was already paid is kept so only the difference is paid.
  const reopen = (r: KpiRow) => {
    const paid = r.kpiMonth?.status === "paid" ? Math.max(r.paidBefore, r.result.payout) : r.paidBefore;
    return write(r, { status: "open", snapshot: null, notified_at: null, paid_notified_at: null, paid_before: paid || null });
  };

  const recount = (r: KpiRow) => {
    if (!r.stale) return;
    const was = r.kpiMonth?.status === "paid" ? ` To'langan ${so(r.result.payout)} eslab qolinadi — keyingi to'lovda faqat farq to'lanadi.` : "";
    if (!window.confirm(`${r.manager.name} — ${monthLabel(month)}: sotuv ${short(r.salesSum)} → ${short(r.stale.sales)}, kirim ${short(r.collectedSum)} → ${short(r.stale.collected)}. Oy qayta ochiladi, keyin yana «Tasdiqlash» bosasiz.${was}`)) return;
    void reopen(r);
  };

  const approve = (r: KpiRow) => write(r, { status: "approved", snapshot: snapshotOf(r), approved_at: new Date().toISOString(), approved_by: me });

  const approveAll = async () => {
    if (!rows) return;
    const todo = rows.filter((r) => !r.frozen && r.result.payout > 0);
    if (!todo.length) return;
    if (!window.confirm(`${month} oyi uchun ${todo.length} menejer KPI'sini tasdiqlaysizmi? Raqamlar qotiriladi va menejerlarga Telegram'da hisobot boradi.`)) return;
    for (const r of todo) await approve(r);
  };

  const exportReport = () => {
    if (!rows) return;
    exportCsv(
      `kpi-${month}`,
      ["Menejer", "Reja", "Sotuv", "Sotuv %", "Sotuv bonusi", "Kirim", "Kirim %", "Davomat %", "amoCRM %", "Kirim bonusi", "Jami", "Avval to'langan", "Qo'shimcha", "Holat"],
      rows.map((r) => [
        r.manager.name,
        Math.round(r.rates.plan),
        Math.round(r.salesSum),
        r.rates.sales_rate,
        r.result.salesBonus,
        Math.round(r.collectedSum),
        r.rates.collect_rate,
        r.attendancePct ?? "",
        r.amoPct ?? "",
        r.result.collectBonus,
        r.result.payout,
        r.paidBefore || "",
        r.paidBefore ? Math.max(0, r.result.payout - r.paidBefore) : "",
        STATUS[r.kpiMonth?.status || "open"].label,
      ]),
    );
  };

  const today = dateCodeOf(new Date());
  const live = month === today.slice(0, 7);
  const progress = monthProgress(month, today);
  const forecast = (rows || []).reduce((t, r) => t + forecastPayout(r, progress), 0);
  const planTotal = (rows || []).reduce((t, r) => t + (r.rates.plan > 0 ? r.rates.plan : 0), 0);
  const locked = (rows || []).reduce((t, r) => t + (r.result.eligible ? 0 : r.result.collectPotential), 0);
  const people = (rows || []).filter((r) => r.result.payout > 0).length;
  const openRow = rows?.find((r) => r.manager.id === open) || null;
  const prev = monthBefore(month);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">KPI · {monthLabel(month)}</h1>
          <p className="text-sm text-ink-500">
            Har menejer qancha oladi va nima uchun · {live ? `${dayLabel(today)} holati` : "yopilgan oy"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => setMonth(prev)} title={monthLabel(prev)}>
            <ChevronLeft className="h-4 w-4" /> {monthLabel(prev).split(" ")[0]}
          </button>
          <input type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Oy" />
          <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Sozlamalar
          </button>
          <button type="button" className="btn-secondary" onClick={exportReport} disabled={!rows}>
            <Download className="h-4 w-4" /> Excel
          </button>
          <button type="button" className="btn-primary" onClick={() => void approveAll()} disabled={!rows?.some((r) => !r.frozen && r.result.payout > 0)}>
            <CheckCircle2 className="h-4 w-4" /> Hammasini tasdiqlash
          </button>
        </div>
      </div>

      {(error || actionError) && <div className="card p-4 text-sm font-semibold text-rose-600">{error || actionError}</div>}

      {!rows ? (
        !error && (
          <div className="flex justify-center py-16 text-ink-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lg shadow-brand-900/20">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <Wallet className="h-3.5 w-3.5" /> Jami to'lanadi
              </div>
              <div className="mt-1.5 font-display text-[28px] font-extrabold tabular-nums">{short(totals.payout)}</div>
              <div className="text-xs text-white/85">
                {people} menejer{live && forecast > totals.payout ? ` · oy oxirigacha prognoz ≈ ${short(forecast)}` : ""}
              </div>
            </div>
            <Tile
              label="Sotuv"
              value={short(totals.sales)}
              hint={planTotal > 0 ? `rejaning ${Math.round((totals.sales / planTotal) * 100)}%${live ? ` · oyning ${Math.round(progress * 100)}%` : ""}` : "kiritilgan buyurtmalar"}
            />
            <Tile label="Kirim" value={short(totals.collected)} hint="shu oy tushgan pul" />
            <Tile label="Qulfda" value={short(locked)} hint={live ? "shart bajarilmagan kirim bonusi" : "shart bajarilmagani uchun berilmagan"} warn={locked > 0} />
          </div>

          {!rows.length ? (
            <div className="card p-10 text-center text-sm text-ink-500">Managerlar yo'q — Sozlamalar → Managerlar</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => (
                <ManagerCard
                  key={r.manager.id}
                  row={r}
                  index={i}
                  live={live}
                  progress={progress}
                  threshold={settings.threshold}
                  busy={busy === r.manager.id}
                  expanded={open === r.manager.id}
                  onToggle={() => setOpen(open === r.manager.id ? null : r.manager.id)}
                  onApprove={() => void approve(r)}
                  onPaid={() => void write(r, { status: "paid", paid_at: new Date().toISOString(), paid_by: me })}
                  onReopen={() => void reopen(r)}
                  onRecount={() => recount(r)}
                />
              ))}
            </div>
          )}

          {openRow && (
            <div className="card space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-ink-900">{openRow.manager.name} — batafsil</h2>
                <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>
                  Yopish
                </button>
              </div>
              <RatesPanel key={`${month}_${openRow.manager.id}`} row={openRow} month={month} threshold={settings.threshold} onSave={(v) => saveRates(openRow, v)} />
              <LinesOfMonth row={openRow} admin />
            </div>
          )}

          <p className="max-w-4xl text-xs text-ink-500">
            «Batafsil» — reja va foizlar, buyurtmalar va to'lovlar ro'yxati, har biridan qancha bonus. Sotuv — shu oy kiritilgan buyurtmalar (bekor qilingan va qoralama kirmaydi). Kirim — shu oy
            kelgan pul, eski qarzlar ham. Tasdiqlangan oy qotiriladi va menejerga Telegram'da hisobot boradi.
          </p>
        </>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSaved={reload} />
    </div>
  );
}

const AVATAR = ["from-violet-500 to-indigo-600", "from-sky-500 to-teal-600", "from-rose-500 to-orange-500", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600"];
const PLAN_PILL: Record<PlanState, { label: string; cls: string } | null> = {
  done: { label: "reja bajarildi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  on: { label: "rejada", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  behind: { label: "ortda", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  risk: { label: "xavf", cls: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  none: null,
};

function ManagerCard({
  row: r,
  index,
  live,
  progress,
  threshold,
  busy,
  expanded,
  onToggle,
  onApprove,
  onPaid,
  onReopen,
  onRecount,
}: {
  row: KpiRow;
  index: number;
  live: boolean;
  progress: number;
  threshold: number;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onPaid: () => void;
  onReopen: () => void;
  onRecount: () => void;
}) {
  const st = r.kpiMonth?.status || "open";
  const res = r.result;
  const state = planState(res.planPct, progress);
  // A closed month either made the plan or did not.
  const pill = !live && state !== "done" && state !== "none" ? { label: "reja bajarilmadi", cls: PLAN_PILL.behind!.cls } : PLAN_PILL[state];
  const forecast = forecastPayout(r, progress);
  const need = live && !r.frozen ? progress * 100 : undefined;
  const bar = state === "done" || state === "on" ? "bg-emerald-500" : state === "risk" ? "bg-gradient-to-r from-rose-400 to-rose-600" : "bg-brand-600";
  const lockedCollect = !res.eligible && res.collectPotential > 0;
  return (
    <div className={`card flex flex-col p-5 ${expanded ? "ring-2 ring-brand-500" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base font-bold text-white ${AVATAR[index % AVATAR.length]}`}>
          {(r.manager.name || "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-bold text-ink-900">{r.manager.name}</div>
          {r.rates.plan > 0 ? (
            <div className="text-xs text-ink-500">Reja {short(r.rates.plan)}</div>
          ) : (
            <button type="button" onClick={onToggle} className="text-xs font-semibold text-amber-600 hover:underline">
              + reja qo'yish
            </button>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {pill && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pill.cls}`}>{pill.label}</span>}
          {st !== "open" && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[st].cls}`}>
              <Lock className="h-3 w-3" /> {STATUS[st].label}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 font-display text-[28px] font-extrabold leading-tight tabular-nums text-ink-900">{so(res.payout)}</div>
      <div className="text-xs text-ink-500">
        to'lanadi{live && !r.frozen && forecast > res.payout ? ` · prognoz ≈ ${short(forecast)}` : ""}
        {r.paidBefore > 0 && (
          <>
            {" · "}avval to'langan {short(r.paidBefore)} · <b className="text-ink-800">qo'shimcha {short(Math.max(0, res.payout - r.paidBefore))}</b>
          </>
        )}
      </div>

      {r.stale && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <b>Tasdiqlangandan keyin raqamlar o'zgargan.</b> Hozir: sotuv {short(r.stale.sales)} (edi {short(r.salesSum)}), kirim {short(r.stale.collected)} (edi {short(r.collectedSum)}) → {short(r.stale.payout)}.
          <button type="button" className="mt-1.5 block font-bold text-amber-800 underline hover:no-underline dark:text-amber-200" onClick={onRecount}>
            Qayta hisoblash
          </button>
        </div>
      )}

      {res.planPct !== null && (
        <div className="mt-3">
          <PlanBar value={res.planPct} today={need} color={bar} />
          <div className="mt-1.5 flex justify-between text-xs text-ink-500">
            <span>
              Sotuv {short(r.salesSum)} · {Math.round(res.planPct)}%
            </span>
            {live && !r.frozen && canForecast(progress) && <span>→ {short(forecastSales(r.salesSum, progress))}</span>}
          </div>
        </div>
      )}
      {res.planPct === null && <div className="mt-3 text-xs text-ink-500">Sotuv {short(r.salesSum)} · {r.sales?.order_count || 0} ta buyurtma</div>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-200/50">
          <div className="font-display text-base font-extrabold tabular-nums text-ink-900">{short(res.salesBonus)}</div>
          <div className="text-[11px] text-ink-500">sotuv bonusi {rateLabel(r.rates.sales_rate)}</div>
        </div>
        <div className={`rounded-xl px-3 py-2 ${lockedCollect ? "bg-rose-50 dark:bg-rose-900/25" : "bg-ink-50 dark:bg-ink-200/50"}`}>
          <div className={`font-display text-base font-extrabold tabular-nums ${lockedCollect ? "text-rose-600 line-through" : "text-ink-900"}`}>
            {short(lockedCollect ? res.collectPotential : res.collectBonus)}
          </div>
          <div className="text-[11px] text-ink-500">{lockedCollect ? "kirim bonusi — qulf" : `kirim bonusi ${rateLabel(r.rates.collect_rate)}`}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.staff ? (
          <CondChip ok={res.attendanceOk} label={`Davomat ${pct(r.attendancePct)}`} />
        ) : (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Sozlamalar → Xodimlar → «Manager profili»">
            profil bog'lanmagan
          </span>
        )}
        {r.amoPct === null ? (
          <span className="rounded-md bg-ink-100 px-2 py-0.5 dark:bg-ink-200/70 text-[11px] font-semibold text-ink-500" title={`amoCRM foydalanuvchisi tanlanmagan yoki bu oy vazifa yo'q (chegara ${threshold}%)`}>
            Vazifalar —
          </span>
        ) : (
          <CondChip ok={res.amoOk} label={`Vazifalar ${pct(r.amoPct)}`} />
        )}
        {live && !r.frozen && r.sales && r.sales.debt > 0 && (
          <span className="rounded-md bg-ink-100 px-2 py-0.5 dark:bg-ink-200/70 text-[11px] font-semibold text-ink-600">qarz {short(r.sales.debt)}</span>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <button type="button" className="btn-secondary justify-center" onClick={onToggle}>
          {expanded ? "Yopish" : "Batafsil"}
        </button>
        {busy ? (
          <span className="flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
          </span>
        ) : st === "open" ? (
          <button type="button" className="btn-primary justify-center" disabled={!res.payout} onClick={onApprove}>
            Tasdiqlash
          </button>
        ) : st === "approved" ? (
          <div className="flex gap-1.5">
            <button type="button" className="btn-primary flex-1 justify-center bg-emerald-600 hover:bg-emerald-700" onClick={onPaid}>
              To'landi
            </button>
            <button type="button" className="btn-secondary px-2.5" title="Qayta ochish" aria-label="Qayta ochish" onClick={onReopen}>
              <Unlock className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="flex items-center justify-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> To'langan
          </span>
        )}
      </div>
    </div>
  );
}

function CondChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`}
    >
      {label} {ok ? "✓" : "✗"}
    </span>
  );
}

function Tile({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1.5 font-display text-[28px] font-extrabold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : "text-ink-900"}`}>{value}</div>
      {hint && <div className="text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

function SettingsModal({ open, onClose, settings, onSaved }: { open: boolean; onClose: () => void; settings: SalesKpiSettings; onSaved: () => void }) {
  const [draft, setDraft] = useState({ sales_rate: "", collect_rate: "", threshold: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft({ sales_rate: String(settings.sales_rate).replace(".", ","), collect_rate: String(settings.collect_rate).replace(".", ","), threshold: String(settings.threshold) });
  }
  const num = (v: string) => Number(v.replace(",", "."));

  const save = async () => {
    const v = { sales_rate: num(draft.sales_rate), collect_rate: num(draft.collect_rate), threshold: num(draft.threshold) };
    if (![v.sales_rate, v.collect_rate, v.threshold].every((x) => Number.isFinite(x) && x >= 0 && x <= 100)) return setError("Foizlar 0 dan 100 gacha bo'lishi kerak");
    setSaving(true);
    setError(null);
    try {
      await upsertOne("kpi_settings", "sales", { id: "sales", ...v, updatedAt: new Date().toISOString() });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof draft, label: string, hint: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" inputMode="decimal" value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/[^\d.,]/g, "") }))} />
      <span className="mt-1 block text-xs text-ink-500">{hint}</span>
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="KPI sozlamalari"
      footer={
        <>
          <button
            type="button"
            className="btn-ghost mr-auto"
            onClick={() => setDraft({ sales_rate: String(DEFAULT_SALES_KPI.sales_rate).replace(".", ","), collect_rate: String(DEFAULT_SALES_KPI.collect_rate), threshold: String(DEFAULT_SALES_KPI.threshold) })}
          >
            Standart
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {field("sales_rate", "Sotuvdan, % (aniq pul)", "Har bir kiritilgan buyurtma summasidan. Menejerga alohida foiz qo'yilmagan bo'lsa shu ishlaydi.")}
        {field("collect_rate", "Kirimdan, % (intizom bonusi)", "Shu oy kelgan puldan — davomat va amoCRM sharti bajarilsa.")}
        {field("threshold", "Shart chegarasi, %", "Davomat va amoCRM zadachalari shu foizdan past bo'lsa, kirim bonusi berilmaydi.")}
        {error && <div className="text-sm font-semibold text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}
