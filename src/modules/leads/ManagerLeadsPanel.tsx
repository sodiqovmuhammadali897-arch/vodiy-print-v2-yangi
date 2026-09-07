import { useEffect, useState } from "react";
import { Users, UserRound } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import { monthRange } from "../../lib/workdays";
import { initialsOf } from "../../lib/format";
import type { Lead } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";

type Row = { email: string; name: string; total: number; won: number };

export default function ManagerLeadsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { start, end } = monthRange(new Date());
      const leads = await listAll<Lead>("leads");
      if (cancelled) return;
      const monthLeads = leads.filter((l) => l.created_at >= start && l.created_at < end);
      const byEmail = new Map<string, Row>();
      for (const l of monthLeads) {
        if (!l.assigned_to_email) continue;
        const existing = byEmail.get(l.assigned_to_email) || {
          email: l.assigned_to_email,
          name: l.assigned_to_name || l.assigned_to_email,
          total: 0,
          won: 0,
        };
        existing.total += 1;
        if (l.status === "awaiting_advance") existing.won += 1;
        byEmail.set(l.assigned_to_email, existing);
      }
      const nextRows = Array.from(byEmail.values()).sort((a, b) => b.total - a.total);
      setRows(nextRows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="card h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Menejerlar — lidlar bo'yicha</h2>
          <p className="text-xs text-ink-500">Shu oy ishlangan lidlar soni</p>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Bu oy lid taqsimlanmagan"
        emptyDescription="Menejerlarga lid biriktirilganda shu yerda ko'rinadi"
        emptyIcon={<UserRound className="h-5 w-5" />}
      >
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={r.email} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
              <span className="w-4 text-center text-xs font-extrabold text-ink-400">{i + 1}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">
                {initialsOf(r.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-800">{r.name}</span>
                  <span className="text-sm font-extrabold tabular-nums text-ink-900">{r.total}</span>
                </div>
                <div className="progress-track mt-1">
                  <div
                    className="progress-bar bg-brand-600"
                    style={{ width: `${(r.total / maxTotal) * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[11px] text-ink-500">{r.won} ta mijozga aylandi</div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
