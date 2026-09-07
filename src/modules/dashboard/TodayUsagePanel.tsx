import { useEffect, useState } from "react";
import { TimerReset, UserRound } from "lucide-react";
import { listWhere } from "../../lib/firestoreDb";
import { formatDuration, initialsOf } from "../../lib/format";
import type { DailyActivity } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";

const todayStr = (): string => new Date().toISOString().slice(0, 10);

export default function TodayUsagePanel() {
  const [rows, setRows] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await listWhere<DailyActivity>("activity_daily", "date", todayStr());
      if (!cancelled) {
        setRows(data.sort((a, b) => b.seconds - a.seconds));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds));

  return (
    <div className="card h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <TimerReset className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Bugungi tizimdan foydalanish</h2>
          <p className="text-xs text-ink-500">Har bir xodim bugun necha vaqt faol bo'lgan</p>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Hali ma'lumot yo'q"
        emptyDescription="Xodimlar tizimga kirib, sahifani ochiq turgach shu yerda ko'rinadi"
        emptyIcon={<UserRound className="h-5 w-5" />}
      >
        <div>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-ink-100 py-2.5 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                {initialsOf(r.full_name || r.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-800">{r.full_name || r.email}</span>
                  <span className="text-xs font-extrabold tabular-nums text-ink-900">{formatDuration(r.seconds)}</span>
                </div>
                <div className="progress-track mt-1">
                  <div
                    className="progress-bar bg-slate-500"
                    style={{ width: `${(r.seconds / maxSeconds) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
