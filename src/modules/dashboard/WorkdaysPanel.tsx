import { Calendar, Sun, Moon } from "lucide-react";
import type { WorkdayStats } from "../../lib/workdays";

export default function WorkdaysPanel({ stats }: { stats: WorkdayStats }) {
  const passedPct = stats.workDays
    ? (stats.workDaysPassed / stats.workDays) * 100
    : 0;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-500">
        <Calendar className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Ish kunlari
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="font-display text-3xl font-extrabold text-ink-900">
          {stats.monthName}
        </div>
        <div className="pb-1 text-sm text-ink-500">{stats.year}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-50 p-3">
          <div className="text-[11px] font-semibold uppercase text-ink-500">
            Umumiy
          </div>
          <div className="mt-0.5 text-lg font-bold text-ink-900">
            {stats.totalDays} kun
          </div>
        </div>
        <div className="rounded-xl bg-brand-50 p-3">
          <div className="text-[11px] font-semibold uppercase text-brand-700">
            Ish kuni
          </div>
          <div className="mt-0.5 text-lg font-bold text-brand-800">
            {stats.workDays} kun
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-emerald-700">
            <Sun className="h-3 w-3" /> O'tgan
          </div>
          <div className="mt-0.5 text-lg font-bold text-emerald-800">
            {stats.workDaysPassed} kun
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-amber-700">
            <Moon className="h-3 w-3" /> Qoldi
          </div>
          <div className="mt-0.5 text-lg font-bold text-amber-800">
            {stats.workDaysLeft} kun
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-500">
          <span>Oy bajarilgani</span>
          <span>{passedPct.toFixed(0)}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-bar bg-gradient-to-r from-brand-500 to-brand-700"
            style={{ width: `${passedPct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Yakshanba dam olish kuni sifatida avtomatik hisoblanadi. Bayram kunlarini
          Sozlamalarda qo'shishingiz mumkin.
        </p>
      </div>
    </div>
  );
}
