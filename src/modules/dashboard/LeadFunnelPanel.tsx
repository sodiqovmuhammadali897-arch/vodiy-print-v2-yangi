import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { listAll, listWhere } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { monthRange } from "../../lib/workdays";
import { LEAD_STATUS_OPTIONS } from "../../lib/orderConstants";
import type { Lead } from "../../lib/types";

// Only the pre-conversion stages belong in the funnel — once a lead hits
// "awaiting_advance" it has already become a real Customer + Order (see
// leadConversion.ts), so it has left the lead funnel, not stalled in it.
const FUNNEL_STAGES = LEAD_STATUS_OPTIONS.filter((s) => s.key !== "awaiting_advance" && s.key !== "lost");

export default function LeadFunnelPanel() {
  const { user, isAdmin, can } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canSeeAll = isAdmin || can("leads", "view");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = canSeeAll
        ? await listAll<Lead>("leads")
        : email
          ? await listWhere<Lead>("leads", "assigned_to_email", email)
          : [];
      if (!cancelled) {
        setLeads(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeeAll, email]);

  const { start, end } = monthRange(new Date());
  const lostThisMonth = leads.filter(
    (l) => l.status === "lost" && l.updated_at >= start && l.updated_at < end,
  ).length;

  const counts = FUNNEL_STAGES.map((s) => ({
    ...s,
    count: leads.filter((l) => l.status === s.key).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="card h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Filter className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Lid voronkasi</h2>
          <p className="text-xs text-ink-500">Hozir qaysi bosqichda turibdi</p>
        </div>
      </div>
      {loading ? (
        <div className="py-6 text-center text-sm text-ink-400">Yuklanmoqda...</div>
      ) : (
        <div>
          {counts.map((c) => (
            <div key={c.key} className="mb-3 last:mb-0">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-700">{c.label}</span>
                <span className="font-extrabold tabular-nums text-ink-900">{c.count}</span>
              </div>
              <div className="progress-track h-2.5">
                <div
                  className="progress-bar bg-brand-600"
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="mt-3.5 flex justify-between border-t border-dashed border-ink-200 pt-3 text-xs text-ink-500">
            <span>Shu oy rad etilgan</span>
            <span className="font-extrabold tabular-nums text-rose-600">{lostThisMonth} ta</span>
          </div>
        </div>
      )}
    </div>
  );
}
