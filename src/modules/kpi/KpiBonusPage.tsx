import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock, Settings2, Unlock, Wallet } from "lucide-react";
import { updateOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { exportCsv } from "../../lib/exportCsv";
import { currentMonth } from "../../lib/salesPeriod";
import { COMPONENTS, DEFAULT_BONUS_SETTINGS, short, so, type BonusSettings, type BonusWeights, type KpiMonth } from "../../lib/managerBonus";
import Modal from "../../components/ui/Modal";
import { useBonusMonth, type BonusRow } from "./useBonusMonth";
import MyBonus from "./MyBonus";
import GoalPanel from "./GoalPanel";
import PlanRatePanel, { type PlanRateSave } from "./PlanRatePanel";
import { canSeeOwnKpi } from "../../lib/permissions";

// KPI va bonus (admin): each manager's bonus fund for the month (their %
// of turnover, or the bonus written by hand on an order) × their KPI
// score = what is paid.

const pct = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : `${n.toFixed(digits).replace(".", ",")}%`);
const STATUS: Record<KpiMonth["status"], { label: string; cls: string }> = {
  open: { label: "hisoblanmoqda", cls: "bg-ink-100 text-ink-700" },
  approved: { label: "tasdiqlangan", cls: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" },
  paid: { label: "to'landi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};

export function ScoreBar({ row, weights }: { row: BonusRow; weights: BonusWeights }) {
  const scale = 100 / Math.max(1, COMPONENTS.reduce((s, c) => s + (row.result.scores[c.key] === null ? 0 : weights[c.key]), 0));
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
      {COMPONENTS.map((c) => {
        const p = row.result.points[c.key];
        return p ? <i key={c.key} className="block h-full" style={{ width: `${Math.min(100, p * scale)}%`, background: c.color }} /> : null;
      })}
    </div>
  );
}

// An admin account linked to a manager sees only its own bonus here.
export default function KpiBonusRoute() {
  const { isManagerAccount, staff } = useAuth();
  if (!isManagerAccount) return <KpiBonusPage />;
  return canSeeOwnKpi(staff) ? <MyBonus /> : <div className="card p-6 text-sm text-ink-500">KPI va bonusni ko'rish uchun ruxsat yo'q.</div>;
}

function KpiBonusPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const { rows, settings, error, reload } = useBonusMonth(month, null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [crmDraft, setCrmDraft] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const me = (user?.email || "").toLowerCase();

  const totals = useMemo(
    () => (rows || []).reduce((t, r) => ({ turnover: t.turnover + r.turnover, fund: t.fund + r.fund, payout: t.payout + r.result.payout }), { turnover: 0, fund: 0, payout: 0 }),
    [rows],
  );

  const write = async (row: BonusRow, patch: Partial<KpiMonth>) => {
    setBusy(row.manager.id);
    setActionError(null);
    try {
      await upsertOne("kpi_months", `${month}_${row.manager.id}`, {
        id: `${month}_${row.manager.id}`,
        month,
        manager_id: row.manager.id,
        manager_name: row.manager.name,
        crm_score: row.kpiMonth?.crm_score ?? null,
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

  const saveCrm = (row: BonusRow) => {
    const raw = crmDraft[row.manager.id];
    if (raw === undefined) return;
    const v = raw.trim() === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
    if (v !== null && !Number.isFinite(v)) return;
    if (v === (row.kpiMonth?.crm_score ?? null)) return;
    void write(row, { crm_score: v });
  };

  // Reja va bonus foizi: this month's own values; "keyingi oylarga ham"
  // also makes them the manager's standing plan and rate.
  const savePlanRate = async (row: BonusRow, v: PlanRateSave) => {
    if (v.carry) {
      try {
        await updateOne("managers", row.manager.id, { monthly_plan: v.plan || 0, bonus_rate: v.rate });
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
        return;
      }
    }
    await write(row, { plan: v.plan, rate: v.rate });
  };

  const approve = (row: BonusRow) =>
    write(row, {
      status: "approved",
      snapshot: { ...row.result, turnover: row.turnover, plan: row.plan, fund: row.fund, weights: settings.weights },
      plan: row.plan || null,
      rate: row.bonusRate,
      approved_at: new Date().toISOString(),
      approved_by: me,
    });

  const approveAll = async () => {
    if (!rows) return;
    const todo = rows.filter((r) => !r.frozen && r.fund > 0);
    if (!todo.length) return;
    if (!window.confirm(`${month} oyi uchun ${todo.length} menejer bonusini tasdiqlaysizmi? Raqamlar qotiriladi va menejerlarga Telegram'da hisobot boradi.`)) return;
    for (const r of todo) await approve(r);
  };

  const exportReport = () => {
    if (!rows) return;
    exportCsv(
      `kpi-bonus-${month}`,
      ["Menejer", "Oborot", "Reja", "Bonus fondi", "Reja %", "Vazifalar %", "Davomat %", "CRM %", "Umumiy ball %", "To'lanadi", "Holat"],
      rows.map((r) => [
        r.manager.name,
        Math.round(r.turnover),
        Math.round(r.plan),
        Math.round(r.fund),
        r.result.scores.plan === null ? "" : Math.round(r.result.scores.plan),
        r.result.scores.tasks === null ? "" : Math.round(r.result.scores.tasks),
        r.result.scores.attendance === null ? "" : Math.round(r.result.scores.attendance),
        r.result.scores.crm ?? "",
        r.result.total,
        r.result.payout,
        STATUS[r.kpiMonth?.status || "open"].label,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">KPI va bonus</h1>
          <p className="text-sm text-ink-500">Bonus fondi — oborot × menejer foizi (yoki buyurtmaga qo'lda yozilgan bonus); to'lanadi = fond × KPI ball</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" className="input w-auto" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Oy" />
          <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Ulushlar
          </button>
          <button type="button" className="btn-secondary" onClick={exportReport} disabled={!rows}>
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-700">
        <b>Ulushlar:</b>
        {COMPONENTS.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
            {c.label} <b>{settings.weights[c.key]}%</b>
          </span>
        ))}
        <span className="text-ink-500">
          · reja {settings.plan_floor}% dan past → 0, {settings.plan_cap}% gacha ustama
        </span>
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
            <Tile label="Oborot" value={so(totals.turnover)} />
            <Tile label="Bonus fondi" value={so(totals.fund)} hint="oborot × foiz + qo'lda yozilgan" />
            <Tile label="To'lanadi" value={so(totals.payout)} hint="KPI ballga qarab" strong />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-sm tabular-nums">
                <thead className="bg-ink-50/60">
                  <tr>
                    {["", "Menejer", "Oborot", "Bonus fondi", "Reja", "Vazifalar", "Davomat", "CRM", "Umumiy ball", "To'lanadi", "Holat"].map((h, i) => (
                      <th key={i} className={`table-th ${i >= 2 && i <= 7 ? "text-right" : ""} ${i === 9 ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((r) => {
                    const st = r.kpiMonth?.status || "open";
                    const expanded = open === r.manager.id;
                    const s = r.result.scores;
                    return (
                      <FragmentRow key={r.manager.id}>
                        <tr className={expanded ? "bg-ink-50/50" : ""}>
                          <td className="table-td w-8 pr-0">
                            <button type="button" onClick={() => setOpen(expanded ? null : r.manager.id)} className="rounded p-1 text-ink-400 hover:bg-ink-100" aria-label="Maqsad va buyurtmalarni ko'rsatish">
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="table-td">
                            <div className="font-semibold text-ink-900">{r.manager.name}</div>
                            {!r.staff && <div className="text-[11px] text-amber-600">xodim profili bog'lanmagan</div>}
                            <button
                              type="button"
                              onClick={() => setOpen(r.manager.id)}
                              className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${r.plan > 0 || r.bonusRate ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}
                            >
                              {r.plan > 0 || r.bonusRate
                                ? `Reja ${r.plan > 0 ? short(r.plan) : "—"} · ${r.bonusRate ? `${String(r.bonusRate).replace(".", ",")}%` : "foiz yo'q"}`
                                : "+ reja va foiz qo'yish"}
                            </button>
                            {r.goalPlan ? (
                              <button type="button" onClick={() => setOpen(r.manager.id)} className="mt-0.5 block text-left text-[11px] text-ink-500 hover:underline">
                                🎯 {short(r.goal!)} → {short(r.goalPlan.required)} oborot ·{" "}
                                <b className={r.goalPlan.gap >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                  {r.goalPlan.gap >= 0 ? "▲" : "▼"} {short(Math.abs(r.goalPlan.gap))}
                                </b>
                              </button>
                            ) : (
                              <button type="button" onClick={() => setOpen(r.manager.id)} className="mt-0.5 block text-[11px] text-brand-700 hover:underline">
                                + maqsad qo'yish
                              </button>
                            )}
                          </td>
                          <td className="table-td whitespace-nowrap text-right">{so(r.turnover)}</td>
                          <td className="table-td text-right">
                            <div className="whitespace-nowrap font-semibold text-ink-900">{so(r.fund)}</div>
                            {!r.frozen && r.bonusRate ? (
                              <div className="text-[11px] text-ink-500">
                                oborotdan {String(r.bonusRate).replace(".", ",")}%{r.bonuses.size ? ` + ${r.bonuses.size} ta qo'lda` : ""}
                              </div>
                            ) : (
                              r.unpriced > 0 && !r.frozen && <div className="text-[11px] text-amber-600">foiz yo'q · {r.unpriced} ta buyurtmada bonus yo'q</div>
                            )}
                          </td>
                          <td className={`table-td text-right font-semibold ${s.plan === 0 ? "text-rose-600" : ""}`}>
                            {r.plan > 0 ? pct((r.turnover / r.plan) * 100) : <span className="text-[11px] font-normal text-amber-600">reja yo'q</span>}
                          </td>
                          <td className="table-td text-right">
                            {pct(s.tasks)}
                            {r.tasks.total > 0 && <div className="text-[11px] text-ink-400">{r.tasks.onTime}/{r.tasks.total}</div>}
                          </td>
                          <td className="table-td text-right">{pct(s.attendance)}</td>
                          <td className="table-td text-right">
                            {r.frozen ? (
                              pct(s.crm)
                            ) : (
                              <input
                                className="input w-20 px-2 py-1.5 text-right"
                                inputMode="numeric"
                                placeholder="—"
                                value={crmDraft[r.manager.id] ?? (r.kpiMonth?.crm_score ?? "").toString()}
                                onChange={(e) => setCrmDraft((d) => ({ ...d, [r.manager.id]: e.target.value.replace(/[^\d]/g, "") }))}
                                onBlur={() => saveCrm(r)}
                                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                aria-label={`${r.manager.name}: CRM bali`}
                              />
                            )}
                          </td>
                          <td className="table-td w-48">
                            <ScoreBar row={r} weights={r.kpiMonth?.snapshot?.weights || settings.weights} />
                            <div className="mt-1 text-xs">
                              <b>{pct(r.result.total, 1)}</b>
                              {s.plan === 0 && <span className="text-rose-600"> · reja {settings.plan_floor}% dan past</span>}
                              {s.plan !== null && s.plan > 100 && <span className="text-emerald-600"> · reja ustamasi</span>}
                              {r.result.missing.length > 0 && <span className="text-ink-400"> · {r.result.missing.map((k) => COMPONENTS.find((c) => c.key === k)!.label).join(", ")} hisobsiz</span>}
                            </div>
                          </td>
                          <td className="table-td whitespace-nowrap text-right font-display text-[15px] font-extrabold text-ink-900">{so(r.result.payout)}</td>
                          <td className="table-td">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`chip ${STATUS[st].cls}`}>
                                {st !== "open" && <Lock className="h-3 w-3" />}
                                {STATUS[st].label}
                              </span>
                              {busy === r.manager.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                              ) : st === "open" ? (
                                <button type="button" className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40" disabled={!r.fund} onClick={() => void approve(r)}>
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
                                <PlanRatePanel row={r} month={month} onSave={(v) => savePlanRate(r, v)} />
                                <GoalPanel row={r} onSave={(goal) => write(r, { goal })} />
                                <div className="rounded-2xl border border-ink-100 bg-surface px-4 py-2">
                                  <OrdersOfManager row={r} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
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
            <p className="text-xs text-ink-500">
              CRM bali (0–100) oy oxirida qo'lda qo'yiladi. Bo'sh ulushlar hisobga olinmaydi, qolganlari 100% ga moslanadi. Tasdiqlangan oy qotiriladi va menejerga Telegram'da hisobot boradi.
            </p>
            <button type="button" className="btn-primary" onClick={() => void approveAll()} disabled={!rows.some((r) => !r.frozen && r.fund > 0)}>
              <CheckCircle2 className="h-4 w-4" /> Oyni yopish va tasdiqlash
            </button>
          </div>
        </>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSaved={reload} />
    </div>
  );
}

// A <tr> pair needs a keyed wrapper without adding a DOM node.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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

export function OrdersOfManager({ row, admin = true }: { row: BonusRow; admin?: boolean }) {
  if (!row.orders.length) return <div className="py-3 text-sm text-ink-500">Bu oyda buyurtma yo'q</div>;
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
          <th className="py-2 pr-3">Buyurtma</th>
          <th className="py-2 pr-3">Nomi</th>
          <th className="py-2 pr-3 text-right">Summa</th>
          <th className="py-2 pr-3 text-right">Marja</th>
          <th className="py-2 pr-3 text-right">Bonus</th>
        </tr>
      </thead>
      <tbody>
        {row.orders.map((o) => {
          const b = row.bonuses.get(o.id);
          return (
            <tr key={o.id} className="border-t border-ink-100">
              <td className="py-2 pr-3 font-semibold">
                {admin ? (
                  <Link to={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                    {o.order_number || "—"}
                  </Link>
                ) : (
                  o.order_number || "—"
                )}
              </td>
              <td className="max-w-[260px] truncate py-2 pr-3 text-ink-700">{o.title}</td>
              <td className="py-2 pr-3 text-right">{so(Number(o.total_amount || 0))}</td>
              <td className="py-2 pr-3 text-right">{b?.margin === null || b?.margin === undefined ? "—" : `${b.margin}%`}</td>
              <td className="py-2 pr-3 text-right font-semibold">
                {b ? (
                  <>
                    {so(b.amount)}
                    {admin && row.bonusRate ? <div className="text-[10px] font-normal text-ink-400">qo'lda</div> : null}
                  </>
                ) : row.bonusRate ? (
                  <>
                    {so(Math.round((Number(o.total_amount || 0) * row.bonusRate) / 100))}
                    {admin && <div className="text-[10px] font-normal text-ink-400">{String(row.bonusRate).replace(".", ",")}%</div>}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> yozilmagan
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SettingsModal({ open, onClose, settings, onSaved }: { open: boolean; onClose: () => void; settings: BonusSettings; onSaved: () => void }) {
  const [draft, setDraft] = useState<BonusSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(settings);
  }
  const sum = COMPONENTS.reduce((s, c) => s + (Number(draft.weights[c.key]) || 0), 0);

  const save = async () => {
    if (sum !== 100) return setError(`Ulushlar yig'indisi 100 bo'lishi kerak (hozir ${sum})`);
    setSaving(true);
    setError(null);
    try {
      await upsertOne("kpi_settings", "bonus", {
        id: "bonus",
        ...draft,
        tiers: draft.tiers.map((t) => ({ min_margin: Number(t.min_margin) || 0, pct: Number(t.pct) || 0 })).sort((a, b) => b.min_margin - a.min_margin),
        updatedAt: new Date().toISOString(),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => Number(v.replace(/[^\d-]/g, "")) || 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="KPI ulushlari va bonus foizlari"
      footer={
        <>
          <button type="button" className="btn-ghost mr-auto" onClick={() => setDraft(DEFAULT_BONUS_SETTINGS)}>
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
      <div className="space-y-5">
        <div>
          <div className="label">Ulushlar (jami 100)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COMPONENTS.map((c) => (
              <label key={c.key} className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                  {c.label}
                </span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={draft.weights[c.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, weights: { ...d.weights, [c.key]: num(e.target.value) } }))}
                />
              </label>
            ))}
          </div>
          <div className={`mt-1 text-xs font-semibold ${sum === 100 ? "text-emerald-600" : "text-rose-600"}`}>Jami: {sum}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Reja pastki chegarasi, %</span>
            <input className="input" inputMode="numeric" value={draft.plan_floor} onChange={(e) => setDraft((d) => ({ ...d, plan_floor: num(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="label">Reja ustamasi chegarasi, %</span>
            <input className="input" inputMode="numeric" value={draft.plan_cap} onChange={(e) => setDraft((d) => ({ ...d, plan_cap: num(e.target.value) }))} />
          </label>
          <label className="col-span-2 block">
            <span className="label">Maqsad kalkulyatori: standart bonus foizi, %</span>
            <input className="input" inputMode="decimal" value={draft.default_rate ?? 5} onChange={(e) => setDraft((d) => ({ ...d, default_rate: Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 }))} />
            <span className="mt-1 block text-xs text-ink-500">Menejerning oxirgi 3 oyda bonus tarixi bo'lmasa, oborotdan shu foiz bonus deb hisoblanadi.</span>
          </label>
        </div>
        <div>
          <div className="label">Tavsiya foiz — buyurtma marjasiga qarab</div>
          <div className="space-y-2">
            {draft.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-ink-700">
                <span>Marja</span>
                <input
                  className="input w-20 px-2 py-1.5"
                  inputMode="numeric"
                  value={t.min_margin <= -100 ? "0" : t.min_margin}
                  onChange={(e) => setDraft((d) => ({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, min_margin: num(e.target.value) } : x)) }))}
                />
                <span>% va yuqori →</span>
                <input
                  className="input w-20 px-2 py-1.5"
                  inputMode="numeric"
                  value={t.pct}
                  onChange={(e) => setDraft((d) => ({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, pct: num(e.target.value) } : x)) }))}
                />
                <span>% summadan</span>
              </div>
            ))}
          </div>
        </div>
        {error && <div className="text-sm font-semibold text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}
