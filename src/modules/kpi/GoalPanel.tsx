import { useState } from "react";
import { CalendarDays, Loader2, PhoneCall, ReceiptText, Target } from "lucide-react";
import { COMPONENTS, short, so } from "../../lib/managerBonus";
import type { BonusRow } from "./useBonusMonth";

// Maqsad kalkulyatori: "I want to earn N this month" → the turnover that
// takes, how far along the manager is, the daily pace, orders and leads,
// and how much less they'd need to sell with a better KPI. Admin-only for
// now (the KPI va bonus page); the admin sets the goal.

const PRESETS = [5e6, 10e6, 15e6, 20e6];

export default function GoalPanel({ row, onSave }: { row: BonusRow; onSave?: (goal: number | null) => Promise<void> }) {
  const [draft, setDraft] = useState(row.goal ? String(row.goal) : "");
  const [saving, setSaving] = useState(false);
  const g = row.goalPlan;
  const value = Number(draft.replace(/\s/g, "")) || 0;

  const save = async (v: number | null) => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-surface p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-600" />
          <h3 className="font-display text-[15px] font-bold text-ink-900">{row.manager.name} — bu oy qancha topmoqchi?</h3>
        </div>
        {onSave && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="input w-48 text-lg font-extrabold tabular-nums"
              inputMode="numeric"
              placeholder="Maqsad, so'm"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d\s]/g, ""))}
              aria-label="Maqsad summasi"
            />
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setDraft(String(p));
                  void save(p);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${row.goal === p ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}
              >
                {short(p)}
              </button>
            ))}
            <button type="button" className="btn-primary px-3 py-2" disabled={saving || value === (row.goal || 0)} onClick={() => void save(value || null)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {value ? "Saqlash" : "Olib tashlash"}
            </button>
          </div>
        )}

        {!g ? (
          <p className="mt-4 text-sm text-ink-500">Maqsad qo'yilmagan — summani yozing, tizim kerakli oborotni hisoblaydi.</p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Kerakli oborot</div>
                <div className="font-display text-4xl font-extrabold tabular-nums text-ink-900">{short(g.required)}</div>
                <div className="text-xs text-ink-500">
                  {short(row.goal!)} ÷ (bonus {row.rate.toFixed(1).replace(".", ",")}% × KPI {Math.round(g.kpi)}%)
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Hozir</div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-ink-900">{short(row.turnover)}</div>
                <div className="text-xs text-ink-500">qoldi {short(g.left)}</div>
              </div>
            </div>
            <div className="relative mt-3 h-3 rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (row.turnover / g.required) * 100)}%` }} />
              <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink-900" style={{ left: `${Math.min(100, (g.expectedByNow / g.required) * 100)}%` }} title="Bugungacha bo'lishi kerak edi" />
            </div>
            <div className="mt-2 text-xs">
              <span className={`chip font-bold ${g.gap >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                {g.gap >= 0 ? "▲" : "▼"} {short(Math.abs(g.gap))} {g.gap >= 0 ? "oldinda" : "orqada"}
              </span>{" "}
              <span className="text-ink-500">— bugungacha {short(g.expectedByNow)} bo'lishi kerak edi</span>
            </div>

            <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-100 px-4">
              <Step icon={<CalendarDays className="h-4 w-4" />} label="Qolgan ish kunlarida har kuni" value={g.perDay === null ? "oy tugadi" : `${short(g.perDay)} sotuv`} />
              <Step
                icon={<ReceiptText className="h-4 w-4" />}
                label={row.avgCheck ? `O'rtacha chek ${short(row.avgCheck)} — kerak` : "O'rtacha chek hisoblanmadi (buyurtma yo'q)"}
                value={g.orders === null ? "—" : `≈ ${g.orders} ta buyurtma`}
              />
              <Step
                icon={<PhoneCall className="h-4 w-4" />}
                label={row.conversion ? `amoCRM konversiyasi ${Math.round(row.conversion)}% — ishlash kerak` : "amoCRM konversiyasi yo'q (amoCRM foydalanuvchisi bog'lanmagan)"}
                value={g.leads === null ? "—" : `≈ ${g.leads} ta lid`}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              Bonus foizi — {row.rateFromHistory ? "oxirgi 3 oyda buyurtmalarga yozilgan bonuslar o'rtachasi" : "tarix yo'q, standart foiz (Ulushlar sozlamasi)"}; KPI'da reja qismi bajarilgan deb olinadi.
            </p>
          </>
        )}
      </div>

      {g && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5">
            <h3 className="font-display text-[15px] font-bold text-ink-900">Kerakli oborotni qanday kamaytirish mumkin</h3>
            <p className="text-xs text-ink-500">KPI yaxshilansa, o'sha maqsadga kamroq sotib yetadi</p>
            <div className="mt-2 divide-y divide-ink-100">
              {g.gains.length ? (
                g.gains.map((x) => {
                  const c = COMPONENTS.find((c) => c.key === x.key)!;
                  return (
                    <div key={x.key} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-ink-700">
                        <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                        <b className="text-ink-900">{c.label}</b> {Math.round(x.from)}% → 100%
                      </span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">−{short(x.saves)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="py-2.5 text-sm text-ink-500">KPI qismlari 100% — kamaytiradigan joy yo'q 👏</div>
              )}
            </div>
            {g.gains.length > 1 && (
              <div className="mt-2 flex justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm dark:bg-brand-900/30">
                <b className="text-ink-900">Hammasi 100% bo'lsa</b>
                <b className="tabular-nums text-brand-700 dark:text-brand-300">{short(g.allPerfect)} yetadi</b>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-ink-100 bg-surface p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Admin rejasi (bonusdagi "Reja" qismi)</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-xl font-extrabold tabular-nums text-ink-900">{row.plan > 0 ? short(row.plan) : "qo'yilmagan"}</span>
              {row.plan > 0 && <span className="text-xs text-ink-500">bajarildi {Math.round((row.turnover / row.plan) * 100)}%</span>}
            </div>
            {row.plan > 0 && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (row.turnover / row.plan) * 100)}%`, background: COMPONENTS[0].color }} />
              </div>
            )}
            <p className="mt-2 text-xs text-ink-500">
              Shaxsiy maqsad rejani o'zgartirmaydi.{row.plan > 0 && g.required > row.plan ? " Maqsad rejadan katta 💪" : ""} Bonus fondi hozir: {so(row.fund)}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-ink-500">{label}</div>
        <div className="font-display text-lg font-extrabold tabular-nums text-ink-900">{value}</div>
      </div>
    </div>
  );
}
