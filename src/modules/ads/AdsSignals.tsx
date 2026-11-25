import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { subscribeOne } from "../../lib/firestoreDb";

// Reklama 2.0, phase 4: what the agent sees right now (meta-webhook/
// adsSignals.js, after every full sync). Alerts only — nothing is changed;
// new ones also go to Telegram 🎯 Reklama (08:00–22:00, with cooldowns).
type Signal = { key: string; kind: string; level: "bad" | "warn" | "good"; title: string; evidence: string; advice: string };
const TONE = {
  bad: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
  warn: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
  good: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
};
const DOT = { bad: "🔴", warn: "🟠", good: "🟢" };
const hm = (iso?: string) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16) : "—");

export default function AdsSignals() {
  const [state, setState] = useState<{ items?: Signal[]; at?: string } | null | undefined>(undefined);
  useEffect(() => subscribeOne<{ items?: Signal[]; at?: string }>("ads_state", "signals", setState), []);
  if (state === undefined) return null;
  const items = [...(state?.items || [])].sort((a, b) => ["bad", "warn", "good"].indexOf(a.level) - ["bad", "warn", "good"].indexOf(b.level));
  return (
    <div className="rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-[15px] font-bold text-ink-900">Agent kuzatuvi</h3>
            <p className="text-xs text-ink-500">Har 30 daqiqada tekshiradi ({hm(state?.at)}) · faqat xabar beradi, budjetga tegmaydi · yangilari Telegram'ga ham boradi</p>
          </div>
        </div>
        {items.length > 0 && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-700">{items.length} ta</span>}
      </div>
      {items.length ? (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {items.map((s) => (
            <div key={s.key} className={`rounded-2xl border p-3.5 ${TONE[s.level] || TONE.warn}`}>
              <div className="text-sm font-semibold text-ink-900">
                {DOT[s.level] || "🟠"} {s.title}
              </div>
              <div className="mt-1 text-sm text-ink-700">{s.evidence}</div>
              <div className="mt-1.5 text-sm font-medium text-ink-900">👉 {s.advice}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-ink-50/60 p-4 text-sm text-ink-500">Hozir hammasi joyida — agent ogohlantiradigan narsa topmadi.</p>
      )}
    </div>
  );
}
