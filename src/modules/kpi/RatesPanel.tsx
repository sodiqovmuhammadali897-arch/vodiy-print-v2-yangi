import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { monthLabel, rateLabel, short, so } from "../../lib/salesKpi";
import type { KpiRow } from "./useKpiMonth";

// Reja va foizlar (admin): the manager's plan and its two rates for the
// month, with what they come to right now.

const PLANS = [50e6, 80e6, 100e6, 150e6];

export type RatesSave = { plan: number | null; sales_rate: number | null; collect_rate: number | null; carry: boolean };

const digits = (v: string) => v.replace(/[^\d]/g, "");
const grouped = (v: string) => digits(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const decimal = (v: string) => v.replace(/[^\d.,]/g, "");
const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const show = (n: number) => String(n).replace(".", ",");

export default function RatesPanel({ row, month, threshold, onSave }: { row: KpiRow; month: string; threshold: number; onSave: (v: RatesSave) => Promise<void> }) {
  const [plan, setPlan] = useState(row.rates.plan > 0 ? grouped(String(Math.round(row.rates.plan))) : "");
  const [salesRate, setSalesRate] = useState(show(row.rates.sales_rate));
  const [collectRate, setCollectRate] = useState(show(row.rates.collect_rate));
  const [carry, setCarry] = useState(true);
  const [saving, setSaving] = useState(false);

  const planNum = Number(digits(plan)) || 0;
  const sr = toNum(salesRate);
  const cr = toNum(collectRate);
  const valid = [sr, cr].every((x) => x === null || (Number.isFinite(x) && x >= 0 && x <= 100));
  const changed = planNum !== Math.round(row.rates.plan) || sr !== row.rates.sales_rate || cr !== row.rates.collect_rate;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ plan: planNum || null, sales_rate: sr, collect_rate: cr, carry });
    } finally {
      setSaving(false);
    }
  };

  const r = row.result;
  const left = row.rates.plan > 0 ? Math.max(0, row.rates.plan - row.salesSum) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-surface p-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand-600" />
          <h3 className="font-display text-[15px] font-bold text-ink-900">
            {row.manager.name} — {monthLabel(month)}
          </h3>
        </div>
        {row.frozen ? (
          <p className="mt-3 text-sm text-ink-500">Oy tasdiqlangan — o'zgartirish uchun oyni qayta oching.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Oylik reja (sotuv), so'm</span>
                <input className="input text-lg font-extrabold tabular-nums" inputMode="numeric" placeholder="80 000 000" value={plan} onChange={(e) => setPlan(grouped(e.target.value))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Sotuvdan, %</span>
                <input className="input text-lg font-extrabold tabular-nums" inputMode="decimal" value={salesRate} onChange={(e) => setSalesRate(decimal(e.target.value))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Kirimdan, %</span>
                <input className="input text-lg font-extrabold tabular-nums" inputMode="decimal" value={collectRate} onChange={(e) => setCollectRate(decimal(e.target.value))} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(grouped(String(p)))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${planNum === p ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}
                >
                  {short(p)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
                Keyingi oylarga ham shu reja va foizlar
              </label>
              <button type="button" className="btn-primary" disabled={saving || !changed || !valid} onClick={() => void save()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Saqlash
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Belgi o'chiq bo'lsa — faqat shu oy uchun. Foiz bo'sh qolsa — KPI sozlamalaridagi standart foiz ishlaydi.
            </p>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-surface p-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Hisob</div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl bg-brand-50 px-4 py-3 text-sm tabular-nums dark:bg-brand-900/30">
          <span className="text-ink-700">
            Sotuv {so(row.salesSum)} × {rateLabel(row.rates.sales_rate)}
          </span>
          <b className="text-right text-ink-900">{so(r.salesBonus)}</b>
          <span className="text-ink-700">
            Kirim {so(row.collectedSum)} × {rateLabel(row.rates.collect_rate)}
          </span>
          <b className={`text-right ${r.eligible ? "text-ink-900" : "text-rose-600 line-through"}`}>{so(r.collectPotential)}</b>
          {!r.eligible && (
            <span className="col-span-2 text-xs text-rose-600">
              Kirim bonusi berilmaydi: {[!r.attendanceOk && (row.staff ? "davomat" : "xodim profili bog'lanmagan"), !r.amoOk && "amoCRM zadachalar"].filter(Boolean).join(", ")} {row.staff ? `${threshold}% dan past` : ""}
            </span>
          )}
          <span className="border-t border-brand-100 pt-2 font-bold text-ink-900 dark:border-brand-800">To'lanadi</span>
          <b className="border-t border-brand-100 pt-2 text-right font-display text-lg text-brand-700 dark:border-brand-800 dark:text-brand-300">{so(r.payout)}</b>
        </div>
        {left > 0 && !row.frozen && (
          <p className="mt-3 text-xs text-ink-500">
            Rejaga {short(left)} qoldi — sotsa, sotuv bonusi yana +{short((left * row.rates.sales_rate) / 100)}.
          </p>
        )}
        {row.sales && row.sales.debt > 0 && !row.frozen && (
          <p className="mt-1 text-xs text-ink-500">
            Mijozlar qarzi {short(row.sales.debt)} — undirilsa, kirim bonusi +{short((row.sales.debt * row.rates.collect_rate) / 100)}.
          </p>
        )}
      </div>
    </div>
  );
}
