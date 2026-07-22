import { ReactNode } from "react";

export type StatCardTone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";

const toneMap: Record<StatCardTone, { bg: string; iconBg: string; text: string }> = {
  brand: { bg: "bg-brand-50", iconBg: "bg-brand-100 text-brand-700", text: "text-brand-700" },
  emerald: { bg: "bg-emerald-50", iconBg: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", iconBg: "bg-amber-100 text-amber-700", text: "text-amber-700" },
  rose: { bg: "bg-rose-50", iconBg: "bg-rose-100 text-rose-700", text: "text-rose-700" },
  sky: { bg: "bg-sky-50", iconBg: "bg-sky-100 text-sky-700", text: "text-sky-700" },
  violet: { bg: "bg-slate-50", iconBg: "bg-slate-100 text-slate-700", text: "text-slate-700" },
};

type Props = {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: StatCardTone;
  progress?: number;
  progressLabel?: string;
};

export default function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "brand",
  progress,
  progressLabel,
}: Props) {
  const t = toneMap[tone];
  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {title}
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold text-ink-900">
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-xs text-ink-500">{hint}</div>
          )}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.iconBg}`}>
          {icon}
        </div>
      </div>
      {typeof progress === "number" && (
        <div className="mt-4">
          <div className="progress-track">
            <div
              className={`progress-bar ${
                tone === "rose"
                  ? "bg-rose-500"
                  : tone === "amber"
                  ? "bg-amber-500"
                  : tone === "emerald"
                  ? "bg-emerald-500"
                  : "bg-brand-600"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          {progressLabel && (
            <div className={`mt-1.5 text-[11px] font-semibold ${t.text}`}>
              {progressLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
