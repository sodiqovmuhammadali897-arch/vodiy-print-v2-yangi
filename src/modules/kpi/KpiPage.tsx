import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock, Settings2, Unlock, Wallet } from "lucide-react";
import { updateOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { exportCsv } from "../../lib/exportCsv";
import { currentMonth } from "../../lib/salesPeriod";
import { canSeeOwnKpi } from "../../lib/permissions";
import { DEFAULT_SALES_KPI, num, rateLabel, short, so, type KpiMonth, type KpiSnapshot, type SalesKpiSettings } from "../../lib/salesKpi";
import Modal from "../../components/ui/Modal";
import { useKpiMonth, type KpiRow } from "./useKpiMonth";
import MyKpi, { Gauge, LinesOfMonth } from "./MyKpi";
import RatesPanel, { type RatesSave } from "./RatesPanel";

// KPI (admin): every sales manager's month — sales % of the orders they
// entered, plus collect % of the money in when attendance and amoCRM
// tasks hold — with each manager's plan and rates, and month approval.

const STATUS: Record<KpiMonth["status"], { label: string; cls: string }> = {
  open: { label: "hisoblanmoqda", cls: "bg-ink-100 text-ink-700" },
  approved: { label: "tasdiqlangan", cls: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" },
  paid: { label: "to'landi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};
const pct = (n: number | null) => (n === null ? "—" : `${String(Math.round(n * 10) / 10).replace(".", ",")}%`);

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
      ["Menejer", "Reja", "Sotuv", "Sotuv %", "Sotuv bonusi", "Kirim", "Kirim %", "Davomat %", "amoCRM %", "Kirim bonusi", "Jami", "Holat"],
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
        STATUS[r.kpiMonth?.status || "open"].label,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">KPI</h1>
          <p className="text-sm text-ink-500">
            Sotuvdan {rateLabel(settings.sales_rate)} — aniq; kirimdan {rateLabel(settings.collect_rate)} — davomat va amoCRM {settings.threshold}% dan yuqori bo'lsa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Oy" />
          <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Sozlamalar
          </button>
          <button type="button" className="btn-secondary" onClick={exportReport} disabled={!rows}>
            <Download className="h-4 w-4" /> Excel
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Sotuv" value={so(totals.sales)} hint="kiritilgan buyurtmalar" />
            <Tile label="Kirim" value={so(totals.collected)} hint="shu oy kelgan pul" />
            <Tile label="To'lanadi" value={so(totals.payout)} hint="sotuv bonusi + kirim bonusi" strong />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm tabular-nums">
                <thead className="bg-ink-50/60">
                  <tr>
                    {["", "Menejer", "Sotuv, so'm", "Reja", "Sotuv bonusi", "Kirim, so'm", "Davomat", "amoCRM", "Kirim bonusi", "Jami, so'm", "Holat"].map((h, i) => (
                      <th key={i} className={`table-th ${[2, 4, 5, 8, 9].includes(i) ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((r) => {
                    const st = r.kpiMonth?.status || "open";
                    const expanded = open === r.manager.id;
                    const set = r.rates.plan > 0 || r.manager.sales_rate != null || r.kpiMonth?.sales_rate != null;
                    return (
                      <Fragment key={r.manager.id}>
                        <tr className={expanded ? "bg-ink-50/50" : ""}>
                          <td className="table-td w-8 pr-0">
                            <button type="button" onClick={() => setOpen(expanded ? null : r.manager.id)} className="rounded p-1 text-ink-400 hover:bg-ink-100" aria-label="Batafsil">
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="table-td">
                            <div className="font-semibold text-ink-900">{r.manager.name}</div>
                            {!r.staff && <div className="text-[11px] text-amber-600">xodim profili bog'lanmagan</div>}
                            <button
                              type="button"
                              onClick={() => setOpen(r.manager.id)}
                              className={`mt-1 inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${set ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}
                            >
                              {set ? `${r.rates.plan > 0 ? `Reja ${short(r.rates.plan)}` : "Reja —"} · ${rateLabel(r.rates.sales_rate)} / ${rateLabel(r.rates.collect_rate)}` : "+ reja qo'yish"}
                            </button>
                          </td>
                          <td className="table-td whitespace-nowrap text-right">
                            {num(r.salesSum)}
                            <div className="text-[11px] text-ink-400">{r.sales?.order_count || 0} ta buyurtma</div>
                          </td>
                          <td className="table-td">
                            {r.result.planPct === null ? (
                              <span className="text-[11px] text-amber-600">reja yo'q</span>
                            ) : (
                              <>
                                <div className="w-24">
                                  <Gauge value={r.result.planPct} color={r.result.planPct >= 100 ? "bg-emerald-500" : "bg-brand-600"} />
                                </div>
                                <div className="mt-1 whitespace-nowrap text-xs">
                                  <b>{Math.round(r.result.planPct)}%</b> <span className="text-ink-400">/ {short(r.rates.plan)}</span>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="table-td whitespace-nowrap text-right font-semibold text-ink-900">
                            {num(r.result.salesBonus)}
                            <div className="text-[11px] font-normal text-ink-400">{rateLabel(r.rates.sales_rate)}</div>
                          </td>
                          <td className="table-td whitespace-nowrap text-right">
                            {num(r.collectedSum)}
                            {!r.frozen && r.sales && r.sales.debt > 0 && <div className="text-[11px] text-ink-400">qarz {short(r.sales.debt)}</div>}
                          </td>
                          <td className="table-td whitespace-nowrap">
                            {r.staff ? (
                              <Cond ok={r.result.attendanceOk} value={pct(r.attendancePct)} threshold={settings.threshold} />
                            ) : (
                              <span className="text-xs font-semibold text-amber-600" title="Sozlamalar → Xodimlar → «Manager profili»">
                                profil bog'lanmagan
                              </span>
                            )}
                          </td>
                          <td className="table-td whitespace-nowrap">
                            {r.amoPct === null ? (
                              <span className="text-xs text-ink-400" title="Xodim profilida amoCRM foydalanuvchisi tanlanmagan yoki bu oy zadacha yo'q">
                                {r.amo ? "zadacha yo'q" : "—"}
                              </span>
                            ) : (
                              <Cond ok={r.result.amoOk} value={pct(r.amoPct)} threshold={settings.threshold} />
                            )}
                            {r.amo && r.amo.due > 0 && (
                              <div className="text-[11px] text-ink-400">
                                {r.amo.on_time}/{r.amo.due} vaqtida{!r.frozen && r.amo.overdue_open ? ` · ${r.amo.overdue_open} ochiq` : ""}
                              </div>
                            )}
                          </td>
                          <td className={`table-td whitespace-nowrap text-right font-semibold ${r.result.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}>
                            {r.result.eligible ? `+${num(r.result.collectBonus)}` : "0"}
                            <div className="text-[11px] font-normal text-ink-400">
                              {r.result.eligible ? rateLabel(r.rates.collect_rate) : r.result.collectPotential > 0 ? `${num(r.result.collectPotential)} berilmaydi` : ""}
                            </div>
                          </td>
                          <td className="table-td whitespace-nowrap text-right font-display text-[15px] font-extrabold text-ink-900">{num(r.result.payout)}</td>
                          <td className="table-td">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`chip ${STATUS[st].cls}`}>
                                {st !== "open" && <Lock className="h-3 w-3" />}
                                {STATUS[st].label}
                              </span>
                              {busy === r.manager.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                              ) : st === "open" ? (
                                <button type="button" className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40" disabled={!r.result.payout} onClick={() => void approve(r)}>
                                  Tasdiqlash
                                </button>
                              ) : st === "approved" ? (
                                <>
                                  <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => void write(r, { status: "paid", paid_at: new Date().toISOString(), paid_by: me })}>
                                    To'landi
                                  </button>
                                  <button type="button" className="text-xs text-ink-500 hover:underline" title="Qayta ochish" onClick={() => void write(r, { status: "open", snapshot: null })}>
                                    <Unlock className="inline h-3 w-3" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={11} className="bg-ink-50/50 px-6 pb-4 pt-1">
                              <div className="space-y-4 pt-2">
                                <RatesPanel row={r} month={month} threshold={settings.threshold} onSave={(v) => saveRates(r, v)} />
                                <LinesOfMonth row={r} admin />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={11} className="table-td py-10 text-center text-ink-500">
                        Managerlar yo'q — Sozlamalar → Managerlar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-xs text-ink-500">
              Sotuv — shu oy kiritilgan buyurtmalar (bekor qilingan va qoralama hisobga kirmaydi). Kirim — shu oy kelgan pul, eski buyurtmalar qarzi ham. Davomat — ish jadvalidagi vaqtdan
              ishlagani: kelmagan kun, kech kelish va erta ketish ayiriladi. Tasdiqlangan oy qotiriladi va menejerga Telegram'da hisobot boradi.
            </p>
            <button type="button" className="btn-primary" onClick={() => void approveAll()} disabled={!rows.some((r) => !r.frozen && r.result.payout > 0)}>
              <CheckCircle2 className="h-4 w-4" /> Oyni yopish va tasdiqlash
            </button>
          </div>
        </>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSaved={reload} />
    </div>
  );
}

function Cond({ ok, value, threshold }: { ok: boolean; value: string; threshold: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <b className={ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}>{value}</b>
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`}>
        {ok ? "✓" : `${threshold}% dan past`}
      </span>
    </span>
  );
}

function Tile({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {strong && <Wallet className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={`mt-1 font-display font-extrabold tabular-nums ${strong ? "text-2xl text-brand-700 dark:text-brand-300" : "text-xl text-ink-900"}`}>{value}</div>
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
