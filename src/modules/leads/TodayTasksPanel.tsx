import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { listWhere } from "../../lib/firestoreDb";
import { leadTaskTypeLabel } from "../../lib/orderConstants";
import { completeLeadTaskWithFollowUp } from "../../lib/leadTasks";
import { useAuth } from "../../lib/AuthContext";
import type { LeadTask } from "../../lib/types";

type Group = { key: string; label: string; color: string; rows: LeadTask[] };

const dueDateTime = (t: LeadTask): Date => new Date(`${t.due_date}T${t.due_time || "00:00"}`);

const groupTasks = (rows: LeadTask[]): Group[] => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const overdue = rows.filter((t) => t.due_date < todayStr);
  const dueNow = rows.filter((t) => t.due_date === todayStr && dueDateTime(t) <= now);
  const today = rows.filter((t) => t.due_date === todayStr && dueDateTime(t) > now);
  const tomorrow = rows.filter((t) => t.due_date === tomorrowStr);

  return [
    { key: "overdue", label: "Muddati o'tgan", color: "#be123c", rows: overdue },
    { key: "now", label: "Hozir bajarish kerak", color: "#92400e", rows: dueNow },
    { key: "today", label: "Bugun", color: "#334155", rows: today },
    { key: "tomorrow", label: "Ertaga", color: "#94a3b8", rows: tomorrow },
  ].filter((g) => g.rows.length > 0);
};

export default function TodayTasksPanel() {
  const { user, staff } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!email) return;
    const rows = await listWhere<LeadTask>("lead_tasks", "assigned_to_email", email);
    setTasks(rows.filter((t) => t.status === "open"));
  };

  useEffect(() => {
    void load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const groups = useMemo(() => groupTasks(tasks), [tasks]);
  const urgentCount = (groups.find((g) => g.key === "overdue")?.rows.length || 0) + (groups.find((g) => g.key === "now")?.rows.length || 0);

  const complete = async (task: LeadTask) => {
    setBusyId(task.id);
    const actorEmail = email;
    const actorName = staff?.full_name || email;
    await completeLeadTaskWithFollowUp(task, actorEmail, actorName);
    await load();
    setBusyId(null);
  };

  return (
    <div className="relative">
      <button
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-surface text-ink-600 hover:bg-ink-50"
        onClick={() => setOpen((v) => !v)}
        title="Bugungi vazifalarim"
      >
        <Bell className="h-4 w-4" />
        {urgentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {urgentCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 max-h-[70vh] w-[380px] max-w-[92vw] overflow-y-auto rounded-2xl border border-ink-100 bg-surface shadow-pop">
            <div className="border-b border-ink-100 px-4 py-3 font-display text-sm font-bold text-ink-900">
              Bugungi vazifalarim
            </div>
            {groups.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-400">Vazifalar yo'q</div>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="px-4 py-2.5">
                  <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: g.color }}>
                    {g.label} · {g.rows.length}
                  </div>
                  {g.rows.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 border-b border-ink-100 py-2 last:border-0">
                      <div className="w-9 shrink-0 text-[11px] font-extrabold" style={{ color: g.color }}>
                        {t.due_time}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-ink-800">
                          {t.lead_name} — {leadTaskTypeLabel(t.type)}
                        </div>
                        <div className="text-[10.5px] text-ink-500">{t.assigned_to_name}</div>
                      </div>
                      <button
                        className="shrink-0 rounded-lg border border-ink-200 px-2 py-1 text-[10.5px] font-bold text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                        disabled={busyId === t.id}
                        onClick={() => complete(t)}
                      >
                        Bajarildi
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
