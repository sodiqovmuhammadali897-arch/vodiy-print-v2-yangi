import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeadHref } from "./leadLink";
import { CheckCircle2, Clock } from "lucide-react";
import { TASK_COLUMNS, dueLabel, snoozeSlot, taskColumn, taskDueAt, taskTypeInfo } from "../../../lib/crm";
import { completeLeadTask, moveLeadTask, type Actor } from "../../../lib/crmService";
import type { Lead, LeadTask } from "../../../lib/types";

// Zadachalar (step 3, 2026-11-26): open lead tasks in four columns like
// amoCRM — Muddati o'tgan · Bugun · Ertaga · Keyinroq. «Bajarildi» asks what
// came of it (required; quick answers fill it); ⏰ moves a task by an hour
// or to tomorrow 10:00, the same as the Telegram reminder's buttons.
const tashDay = (ms: number) => new Date(ms + 5 * 3600e3).toISOString().slice(0, 10);

export default function TaskList({ tasks, leads, actor }: { tasks: LeadTask[]; leads: Lead[]; actor: Actor }) {
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const open = useMemo(() => tasks.filter((t) => t.status === "open").sort((a, b) => taskDueAt(a) - taskDueAt(b)), [tasks]);
  const today = tashDay(Date.now());
  const doneToday = useMemo(() => tasks.filter((t) => t.status === "done" && t.completed_at && tashDay(Date.parse(t.completed_at)) === today).length, [tasks, today]);
  const cols = useMemo(() => {
    const m = new Map(TASK_COLUMNS.map((c) => [c.key, [] as LeadTask[]]));
    for (const t of open) m.get(taskColumn(t))!.push(t);
    return m;
  }, [open]);
  const late = cols.get("late")!.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
        <span>
          Ochiq: <b className="text-ink-900">{open.length}</b>
        </span>
        <span>
          Muddati o'tgan: <b className={late ? "text-rose-600" : "text-ink-900"}>{late}</b>
        </span>
        <span>
          Bugun bajarildi: <b className="text-emerald-700">{doneToday}</b>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((c) => {
          const list = cols.get(c.key)!;
          return (
            <section key={c.key} className="fon-col flex min-h-[160px] flex-col rounded-2xl bg-ink-100/70 p-2 dark:bg-ink-800/40 xl:min-h-[420px]">
              <div className="mb-2 flex items-center justify-between border-b-[3px] px-1 pb-1.5" style={{ borderColor: c.color }}>
                <span className={`text-xs font-bold ${c.key === "late" && list.length ? "text-rose-600" : "text-ink-900"}`}>{c.label}</span>
                <span className="text-xs text-ink-500">{list.length}</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {list.length ? (
                  list.map((t) => <TaskRow key={t.id} task={t} lead={byId.get(t.lead_id)} actor={actor} late={c.key === "late"} card />)
                ) : (
                  <p className="px-1 py-4 text-center text-xs text-ink-400">{c.key === "late" ? "Hammasi o'z vaqtida 👍" : "Zadacha yo'q"}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const QUICK = ["📞 Gaplashdim", "📵 Javob bermadi", "💬 Narx yubordim", "📐 Maket yubordim"];

export function TaskRow({ task, lead, actor, late, compact, card }: { task: LeadTask; lead?: Lead; actor: Actor; late?: boolean; compact?: boolean; card?: boolean }) {
  const leadHref = useLeadHref();
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);
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
  const move = async (kind: "h1" | "tomorrow") => {
    setSaving(true);
    setError(null);
    try {
      const s = snoozeSlot(kind);
      await moveLeadTask(task, s.date, s.time, actor);
      setMoving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bo'lmadi");
    }
    setSaving(false);
  };
  const leadLabel = lead ? `${lead.brand || lead.full_name || lead.phone}${lead.lead_number ? ` · ${lead.lead_number}` : ""}` : task.lead_name;
  const tone = late ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-900/10" : "border-ink-200";

  const closeForm = closing && (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setResult(q)} className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${result === q ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600 hover:bg-ink-50"}`}>
            {q}
          </button>
        ))}
      </div>
      <div className={card ? "space-y-1.5" : "flex flex-wrap gap-2"}>
        <input className={`input min-w-0 py-1.5 ${card ? "w-full" : "flex-1"}`} autoFocus placeholder="Natija: nima bo'ldi? (majburiy)" value={result} onChange={(e) => setResult(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void done()} />
        <div className="flex gap-2">
          <button type="button" className="btn-primary py-1.5" disabled={saving || !result.trim()} onClick={() => void done()}>
            Saqlash
          </button>
          <button type="button" className="btn-secondary py-1.5" onClick={() => setClosing(false)}>
            Bekor
          </button>
        </div>
      </div>
    </div>
  );
  const moveRow = moving && (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-ink-500">Ko'chirish:</span>
      <button type="button" disabled={saving} onClick={() => void move("h1")} className="rounded-lg border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
        ⏰ +1 soat
      </button>
      <button type="button" disabled={saving} onClick={() => void move("tomorrow")} className="rounded-lg border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
        📅 Ertaga 10:00
      </button>
      <button type="button" onClick={() => setMoving(false)} className="text-[11px] text-ink-400 hover:text-ink-700">
        bekor
      </button>
    </div>
  );
  const actions = !closing && !moving && (
    <div className={`${card ? "mt-2 flex" : "ml-auto flex"} items-center gap-1.5`}>
      <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => setClosing(true)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Bajarildi
      </button>
      <button type="button" title="Ko'chirish" aria-label="Ko'chirish" className="inline-flex items-center rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-900" onClick={() => setMoving(true)}>
        <Clock className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (card)
    return (
      <div className={`fon-solid rounded-xl border bg-surface p-2.5 shadow-sm ${tone}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-900">
            {info.icon} {info.label}
          </span>
          <span className={`shrink-0 text-[11px] font-semibold ${late ? "text-rose-600" : "text-emerald-700"}`}>{dueLabel(task)}</span>
        </div>
        {lead ? (
          <Link to={leadHref(lead.id)} className="mt-0.5 block truncate text-sm text-brand-700 hover:underline">
            {leadLabel}
          </Link>
        ) : (
          <div className="mt-0.5 truncate text-sm text-ink-600">{leadLabel}</div>
        )}
        {lead?.phone && <div className="text-xs tabular-nums text-ink-500">{lead.phone}</div>}
        {task.note && <div className="mt-1 text-xs text-ink-600">{task.note}</div>}
        <div className="mt-1 text-[11px] text-ink-400">{task.assigned_to_name || "biriktirilmagan"}</div>
        {actions}
        {moveRow}
        {closeForm}
        {error && <div className="mt-1 text-xs text-rose-600">{error}</div>}
      </div>
    );

  return (
    <div className={`${compact ? "rounded-xl border p-3" : "px-4 py-3"} ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink-900">
          {info.icon} {info.label}
        </span>
        <span className={`text-xs font-semibold ${late ? "text-rose-600" : "text-emerald-700"}`}>{dueLabel(task)}</span>
        {!compact && lead && (
          <Link to={leadHref(lead.id)} className="text-sm text-brand-700 hover:underline">
            {leadLabel}
          </Link>
        )}
        {!compact && <span className="text-xs text-ink-400">{task.assigned_to_name}</span>}
        {actions}
      </div>
      {task.note && <div className="mt-0.5 text-sm text-ink-600">{task.note}</div>}
      {moveRow}
      {closeForm}
      {error && <div className="mt-1 text-xs text-rose-600">{error}</div>}
    </div>
  );
}
