import { useEffect, useState } from "react";
import { CircleX, ThumbsUp } from "lucide-react";
import { listAll, listWhere } from "../../lib/firestoreDb";
import type { Lead } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";

const daysAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Bugun";
  if (diff === 1) return "Kecha";
  return `${diff} kun`;
};

type Props = { managerEmail: string };

export default function RecentLostLeadsPanel({ managerEmail }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const rows =
        managerEmail === "all"
          ? await listAll<Lead>("leads")
          : await listWhere<Lead>("leads", "assigned_to_email", managerEmail);
      if (!cancelled) {
        setLeads(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managerEmail]);

  const lost = leads
    .filter((l) => l.status === "lost")
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="card h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <CircleX className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">So'nggi rad etilgan lidlar</h2>
          <p className="text-xs text-ink-500">Sabablari bilan</p>
        </div>
      </div>
      <AsyncState
        loading={loading}
        empty={lost.length === 0}
        emptyLabel="Rad etilgan lid yo'q"
        emptyDescription="Ajoyib — hozircha yo'qotilgan lidlar yo'q"
        emptyIcon={<ThumbsUp className="h-5 w-5" />}
      >
        <div>
          {lost.map((l) => (
            <div key={l.id} className="flex items-start gap-3 border-b border-ink-100 py-2.5 last:border-0">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <CircleX className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink-800">{l.full_name}</div>
                <div className="text-[11.5px] text-ink-500">
                  Sabab: {l.lost_reason || "Ko'rsatilmagan"}
                </div>
              </div>
              <div className="shrink-0 text-[11px] text-ink-400">{daysAgo(l.updated_at)}</div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
