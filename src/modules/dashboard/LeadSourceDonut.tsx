import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { listAll, listWhere } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { monthRange } from "../../lib/workdays";
import type { Lead } from "../../lib/types";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import AsyncState from "../../components/ui/AsyncState";

const PALETTE = ["#0062db", "#0ea5e9", "#f59e0b", "#8b5cf6", "#059669", "#94a3b8"];

export default function LeadSourceDonut() {
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
  const monthLeads = leads.filter((l) => l.created_at >= start && l.created_at < end);

  const counts = new Map<string, number>();
  for (const l of monthLeads) {
    const key = l.source.trim() || "Boshqa";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const restTotal = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
  const slices: DonutSlice[] = top.map(([label, value], i) => ({
    label,
    value,
    color: PALETTE[i % PALETTE.length],
  }));
  if (restTotal > 0) {
    slices.push({ label: "Boshqa", value: restTotal, color: PALETTE[PALETTE.length - 1] });
  }

  return (
    <div className="card h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Radar className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Lid manbalari</h2>
          <p className="text-xs text-ink-500">Shu oy, jami {monthLeads.length} ta</p>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={monthLeads.length === 0}
        emptyLabel="Bu oy lid yo'q"
        emptyDescription="Sotuv bo'limida yangi lid qo'shilganda shu yerda ko'rinadi"
        emptyIcon={<Radar className="h-5 w-5" />}
      >
        <SimpleDonutChart data={slices} valueFormat="count" size={140} />
      </AsyncState>
    </div>
  );
}
