import { useEffect, useMemo, useState } from "react";
import { Loader, Pause, Play, Send, Trash2, X } from "lucide-react";
import { deleteOne, insertOne, subscribeAll, subscribeWhere, updateOne } from "../../lib/firestoreDb";
import type { Holiday, Task, TaskComment, TaskFile, TaskTemplate } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { REPEAT_LABEL, TASK_PRIORITY, fileToDataUrl, statusOf } from "../../lib/taskStatus";
import { formatDateTime } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";

type Actor = { email: string; name: string };

// ── comments (tasks/{id}/comments) ───────────────────────────────────
export function TaskComments({ task, actor }: { task: Task; actor: Actor }) {
  const [rows, setRows] = useState<TaskComment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(
    () => subscribeAll<TaskComment>(`tasks/${task.id}/comments`, (r) => setRows([...r].sort((a, b) => a.created_at.localeCompare(b.created_at)))),
    [task.id],
  );
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      // The server notifies the other side on Telegram (meta-webhook/tasks.js).
      await insertOne(`tasks/${task.id}/comments`, { task_id: task.id, text: text.trim(), by_email: actor.email, by_name: actor.name, via: "web" });
      setText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="mt-2 rounded-xl bg-ink-50 p-3">
      {rows.length === 0 ? (
        <p className="text-xs text-ink-500">Hali izoh yo'q.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${c.by_email === actor.email ? "ml-auto bg-brand-50 text-ink-900" : "bg-surface text-ink-800"}`}>
              <div className="whitespace-pre-wrap">{c.text}</div>
              <div className="mt-0.5 text-[11px] text-ink-500">
                {c.by_name} · {formatDateTime(c.created_at)}
                {c.via === "telegram" && " · Telegram"}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Izoh yoki savol yozing…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()}
        />
        <button className="btn-primary" onClick={send} disabled={sending || !text.trim()} aria-label="Yuborish">
          {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── proof files (tasks/{id}/files) ───────────────────────────────────
export const uploadTaskFiles = async (taskId: string, files: File[], actor: Actor) => {
  for (const f of files) {
    const { data, mime, size } = await fileToDataUrl(f);
    await insertOne(`tasks/${taskId}/files`, { task_id: taskId, name: f.name, mime, data, size, by_email: actor.email, by_name: actor.name });
  }
};

export function TaskFiles({ task, actor, canAdd }: { task: Task; actor: Actor; canAdd: boolean }) {
  const [rows, setRows] = useState<TaskFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<TaskFile | null>(null);
  useEffect(() => subscribeAll<TaskFile>(`tasks/${task.id}/files`, (r) => setRows([...r].sort((a, b) => a.created_at.localeCompare(b.created_at)))), [task.id]);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    try {
      await uploadTaskFiles(task.id, [...list], actor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 rounded-xl bg-ink-50 p-3">
      {rows.length === 0 && <p className="text-xs text-ink-500">Fayl yo'q.</p>}
      <div className="flex flex-wrap gap-2">
        {rows.map((f) => (
          <div key={f.id} className="group relative">
            {f.mime.startsWith("image/") ? (
              <button type="button" onClick={() => setView(f)} className="block overflow-hidden rounded-lg ring-1 ring-ink-100">
                <img src={f.data} alt={f.name} className="h-20 w-20 object-cover" />
              </button>
            ) : (
              <a href={f.data} download={f.name} className="flex h-20 w-28 items-center justify-center rounded-lg bg-surface px-2 text-center text-xs font-semibold text-brand-700 ring-1 ring-ink-100">
                {f.name}
              </a>
            )}
            <div className="mt-0.5 w-20 truncate text-[10px] text-ink-500">{f.by_name}</div>
            {f.by_email === actor.email && (
              <button type="button" onClick={() => deleteOne(`tasks/${task.id}/files`, f.id)} className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-rose-600 p-0.5 text-white group-hover:block" aria-label="O'chirish">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {canAdd && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700">
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : "+"} Rasm yoki fayl qo'shish
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => void add(e.target.files)} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4" onClick={() => setView(null)}>
          <img src={view.data} alt={view.name} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

// ── recurring tasks ──────────────────────────────────────────────────
export function TemplatesPanel({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const [rows, setRows] = useState<TaskTemplate[]>([]);
  useEffect(
    () => (isAdmin ? subscribeAll<TaskTemplate>("task_templates", setRows) : subscribeWhere<TaskTemplate>("task_templates", "assigned_by_email", email, setRows)),
    [isAdmin, email],
  );
  if (!rows.length) return <div className="card p-5 text-sm text-ink-500">Takrorlanuvchi vazifa yo'q. «Yangi vazifa» oynasida «Takrorlansinmi?» ni tanlang.</div>;
  return (
    <div className="card divide-y divide-ink-100">
      {rows.map((t) => (
        <div key={t.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${t.active ? "" : "opacity-60"}`}>
          <div>
            <div className="font-semibold text-ink-900">
              {TASK_PRIORITY[t.priority || "normal"]?.icon} {t.title}
            </div>
            <div className="text-xs text-ink-500">
              {REPEAT_LABEL(t.repeat)} · Xodim: {t.assigned_to_name} · Bergan: {t.assigned_by_name}
              {t.last_created_date && ` · Oxirgisi: ${t.last_created_date}`}
              {!t.active && " · to'xtatilgan"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-ghost text-xs" onClick={() => updateOne("task_templates", t.id, { active: !t.active })}>
              {t.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {t.active ? "To'xtatish" : "Davom ettirish"}
            </button>
            <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => deleteOne("task_templates", t.id)} aria-label="O'chirish">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── rating (per employee, one month) ─────────────────────────────────
export function TaskRating({ tasks, staff, holidays }: { tasks: Task[]; staff: Staff[]; holidays: Holiday[] }) {
  const [month, setMonth] = useState(() => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7));
  const rows = useMemo(() => {
    const inMonth = tasks.filter((t) => String(t.created_at || "").slice(0, 7) === month || String(t.completed_at || "").slice(0, 7) === month);
    const by = new Map<string, { name: string; total: number; done: number; onTime: number; late: number; overdueOpen: number; hours: number[] }>();
    for (const t of inMonth) {
      const k = t.assigned_to_email.toLowerCase();
      const r = by.get(k) || { name: t.assigned_to_name || k, total: 0, done: 0, onTime: 0, late: 0, overdueOpen: 0, hours: [] };
      r.total++;
      if (statusOf(t) === "done") {
        r.done++;
        const doneDay = String(t.completed_at || "").slice(0, 10);
        if (!t.due_date || doneDay <= String(t.due_date).slice(0, 10)) r.onTime++;
        else r.late++;
        if (t.completed_at && t.created_at) r.hours.push((Date.parse(t.completed_at) - Date.parse(t.created_at)) / 3600000);
      } else if (deadlineInfo(t.due_date, holidays)?.overdue) r.overdueOpen++;
      by.set(k, r);
    }
    for (const s of staff) if (!by.has(s.email.toLowerCase())) by.set(s.email.toLowerCase(), { name: s.full_name || s.email, total: 0, done: 0, onTime: 0, late: 0, overdueOpen: 0, hours: [] });
    return [...by.values()]
      .map((r) => {
        const avg = r.hours.length ? r.hours.reduce((a, b) => a + b, 0) / r.hours.length : null;
        // Score: share done on time, minus open overdue ones.
        const score = r.total ? Math.max(0, Math.round(((r.onTime - r.overdueOpen * 0.5) / r.total) * 100)) : null;
        return { ...r, avg, score };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.done - a.done);
  }, [tasks, staff, holidays, month]);

  const fmtHours = (h: number | null) => (h === null ? "—" : h < 24 ? `${Math.round(h)} soat` : `${Math.round((h / 24) * 10) / 10} kun`);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-ink-900">Xodimlar bo'yicha vazifalar reytingi</h3>
        <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Xodim</th>
              <th className="py-2 pr-3 text-right">Jami</th>
              <th className="py-2 pr-3 text-right">Bajarildi</th>
              <th className="py-2 pr-3 text-right">O'z vaqtida</th>
              <th className="py-2 pr-3 text-right">Kech</th>
              <th className="py-2 pr-3 text-right">Kechikkan (ochiq)</th>
              <th className="py-2 pr-3 text-right">O'rtacha vaqt</th>
              <th className="py-2 text-right">Ball</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 tabular-nums">
            {rows.map((r, i) => (
              <tr key={r.name + i}>
                <td className="py-2 pr-3 text-ink-500">{i + 1}</td>
                <td className="py-2 pr-3 font-semibold text-ink-900">{r.name}</td>
                <td className="py-2 pr-3 text-right">{r.total}</td>
                <td className="py-2 pr-3 text-right">{r.done}</td>
                <td className="py-2 pr-3 text-right text-emerald-700">{r.onTime}</td>
                <td className="py-2 pr-3 text-right text-amber-700">{r.late}</td>
                <td className="py-2 pr-3 text-right text-rose-700">{r.overdueOpen}</td>
                <td className="py-2 pr-3 text-right">{fmtHours(r.avg)}</td>
                <td className="py-2 text-right">
                  {r.score === null ? (
                    <span className="text-ink-400">—</span>
                  ) : (
                    <span className={`chip ${r.score >= 80 ? "bg-emerald-100 text-emerald-700" : r.score >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>{r.score}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-500">Ball = o'z vaqtida bajarilganlar ulushi, har bir muddati o'tgan ochiq vazifa uchun yarim ball ayriladi.</p>
    </div>
  );
}

// ── tasks of one order (shown on the order page) ─────────────────────
export function useLinkedTasks(field: "order_id" | "customer_id", value: string | undefined, isAdmin: boolean, email: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!value) return;
    // Non-admins may only read their own tasks, so filter those locally.
    if (isAdmin) return subscribeWhere<Task>("tasks", field, value, setTasks);
    let a: Task[] = [];
    let b: Task[] = [];
    const push = () => setTasks([...new Map([...a, ...b].filter((t) => t[field] === value).map((t) => [t.id, t])).values()]);
    const u1 = subscribeWhere<Task>("tasks", "assigned_to_email", email, (r) => ((a = r), push()));
    const u2 = subscribeWhere<Task>("tasks", "assigned_by_email", email, (r) => ((b = r), push()));
    return () => {
      u1();
      u2();
    };
  }, [field, value, isAdmin, email]);
  return tasks;
}
