import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { monthLabel, short, so } from "../../lib/managerBonus";
import type { BonusRow } from "./useBonusMonth";

// Reja va bonus foizi (admin): the manager's turnover plan and bonus rate
// for the month. Fund = hand-written order bonuses + rate × the rest.

const PLANS = [50e6, 80e6, 100e6, 150e6];
const RATES = [5, 7, 10];

export type PlanRateSave = { plan: number | null; rate: number | null; carry: boolean };

const digits = (v: string) => v.replace(/[^\d]/g, "");
const grouped = (v: string) => digits(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function PlanRatePanel({ row, month, onSave }: { row: BonusRow; month: string; onSave: (v: PlanRateSave) => Promise<void> }) {
  const [plan, setPlan] = useState(row.plan > 0 ? grouped(String(Math.round(row.plan))) : "");
  const [rate, setRate] = useState(row.bonusRate ? String(row.bonusRate).replace(".", ",") : "");
  const [carry, setCarry] = useState(true);
  const [saving, setSaving] = useState(false);

  const planNum = Number(digits(plan)) || 0;
  const rateNum = Number(rate.replace(",", ".")) || 0;
  const changed = planNum !== Math.round(row.plan) || rateNum !== (row.bonusRate || 0);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ plan: planNum || null, rate: rateNum > 0 ? Math.min(100, rateNum) : null, carry });
    } finally {
      setSaving(false);
    }
  };

  const rateLabel = row.bonusRate ? `${String(row.bonusRate).replace(".", ",")}%` : "";
  const more = row.plan > 0 && row.bonusRate ? Math.max(0, row.plan - row.turnover) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-surface p-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand-600" />
          <h3 className="font-display text-[15px] font-bold text-ink-900">
            {row.manager.name} — {monthLabel(month)} rejasi
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-ink-500">Oborot rejaga yetsa — reja qismi 100%. Bonus fondi = oborot × foiz.</p>
        {row.frozen ? (
          <p className="mt-4 text-sm text-ink-500">Oy tasdiqlangan — o'zgartirish uchun oyni qayta oching.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Oylik reja (oborot), so'm</span>
                <input className="input text-lg font-extrabold tabular-nums" inputMode="numeric" placeholder="100 000 000" value={plan} onChange={(e) => setPlan(grouped(e.target.value))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Bonus foizi, %</span>
                <input className="input text-lg font-extrabold tabular-nums" inputMode="decimal" placeholder="7" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ""))} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANS.map((p) => (
                <Chip key={p} on={planNum === p} onClick={() => setPlan(grouped(String(p)))}>
                  {short(p)}
                </Chip>
              ))}
              <span className="w-3" />
              {RATES.map((r) => (
                <Chip key={r} on={rateNum === r} onClick={() => setRate(String(r))}>
                  {r}%
                </Chip>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
                Keyingi oylarga ham shu reja va foiz
              </label>
              <button type="button" className="btn-primary" disabled={saving || !changed} onClick={() => void save()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Saqlash
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Buyurtmaga qo'lda bonus yozilgan bo'lsa (buyurtma ichidagi «Menejer bonusi»), o'sha buyurtmada qo'lda yozilgani olinadi, qolganlariga foiz.
              <br />
              Belgi o'chiq bo'lsa — faqat shu oy uchun. Oy tasdiqlangach raqamlar qotiriladi.
            </p>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-surface p-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Hisob</div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl bg-brand-50 px-4 py-3 text-sm tabular-nums dark:bg-brand-900/30">
          <span className="text-ink-700">Oborot</span>
          <b className="text-right text-ink-900">{so(row.turnover)}</b>
          {row.frozen ? null : row.bonusRate ? (
            <>
              <span className="text-ink-700">
                × {rateLabel} ({row.ratedOrders} ta buyurtma)
              </span>
              <b className="text-right text-ink-900">{so(row.fundByRate)}</b>
            </>
          ) : (
            <>
              <span className="text-amber-700 dark:text-amber-300">Foiz qo'yilmagan</span>
              <b className="text-right text-ink-400">—</b>
            </>
          )}
          {!row.frozen && row.fundManual > 0 && (
            <>
              <span className="text-ink-700">+ qo'lda yozilgan ({row.bonuses.size} ta)</span>
              <b className="text-right text-ink-900">{so(row.fundManual)}</b>
            </>
          )}
          <span className="border-t border-brand-100 pt-2 font-bold text-ink-900 dark:border-brand-800">Bonus fondi</span>
          <b className="border-t border-brand-100 pt-2 text-right text-ink-900 dark:border-brand-800">{so(row.fund)}</b>
          <span className="text-ink-700">× KPI ball {row.result.total.toFixed(1).replace(".", ",")}%</span>
          <b className="text-right font-display text-lg text-brand-700 dark:text-brand-300">{so(row.result.payout)}</b>
        </div>
        {more > 0 && !row.frozen && (
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Reja bajarilsa ({short(row.plan)})</div>
            <div className="font-display text-2xl font-extrabold tabular-nums text-ink-900">≈ {so(row.fund + (more * row.bonusRate!) / 100)} fond</div>
            <div className="text-xs text-ink-500">
              yana {short(more)} sotsa, bonus fondi +{short((more * row.bonusRate!) / 100)} oshadi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}
    >
      {children}
    </button>
  );
}
