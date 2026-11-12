import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { dueLabel, taskDueAt, taskState, taskTypeInfo } from "../../../lib/crm";
import { completeLeadTask, type Actor } from "../../../lib/crmService";
import type { Lead, LeadTask } from "../../../lib/types";

// Open lead tasks: late first (red), then today, then later. «Bajarildi»
// asks what came of it — the result is required.
export default function TaskList({ tasks, leads, actor }: { tasks: LeadTask[]; leads: Lead[]; actor: Actor }) {
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const open = useMemo(() => tasks.filter((t) => t.status === "open").sort((a, b) => taskDueAt(a) - taskDueAt(b)), [tasks]);
  const groups = [
    { key: "late", label: "Muddati o'tgan", cls: "text-rose-600" },
    { key: "today", label: "Bugun", cls: "text-ink-900" },
    { key: "later", label: "Keyingi kunlar", cls: "text-ink-500" },
  ] as const;
  if (!open.length) return <div className="card p-8 text-center text-sm text-ink-500">Ochiq zadacha yo'q.</div>;
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const list = open.filter((t) => taskState(t) === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="card overflow-hidden">
            <h3 className={`border-b border-ink-100 px-4 py-2.5 text-sm font-bold ${g.cls}`}>
              {g.label} · {list.length}
            </h3>
            <div className="divide-y divide-ink-100">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} lead={byId.get(t.lead_id)} actor={actor} late={g.key === "late"} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TaskRow({ task, lead, actor, late, compact }: { task: LeadTask; lead?: Lead; actor: Actor; late?: boolean; compact?: boolean }) {
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = taskTypeInfo(task.type);
  const done = async () => {
    setSaving(true);
    setError(null);
    try {
      await completeLeadTask(task, result, actor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bo'lmadi");
      setSaving(false);
    }
  };
  return (
    <div className={`${compact ? "rounded-xl border p-3" : "px-4 py-3"} ${late ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-900/10" : "border-ink-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink-900">
          {info.icon} {info.label}
        </span>
        <span className={`text-xs font-semibold ${late ? "text-rose-600" : "text-emerald-700"}`}>{dueLabel(task)}</span>
        {!compact && lead && (
          <Link to={`/leads/${lead.id}`} className="text-sm text-brand-700 hover:underline">
            {lead.brand || lead.full_name || lead.phone} {lead.lead_number ? `· ${lead.lead_number}` : ""}
          </Link>
        )}
        {!compact && <span className="text-xs text-ink-400">{task.assigned_to_name}</span>}
        {!closing && (
          <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => setClosing(true)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Bajarildi
          </button>
        )}
      </div>
      {task.note && <div className="mt-0.5 text-sm text-ink-600">{task.note}</div>}
      {closing && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1 py-1.5" autoFocus placeholder="Natija: nima bo'ldi? (majburiy)" value={result} onChange={(e) => setResult(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void done()} />
          <button type="button" className="btn-primary py-1.5" disabled={saving || !result.trim()} onClick={() => void done()}>
            Saqlash
          </button>
          <button type="button" className="btn-secondary py-1.5" onClick={() => setClosing(false)}>
            Bekor
          </button>
          {error && <span className="w-full text-xs text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
