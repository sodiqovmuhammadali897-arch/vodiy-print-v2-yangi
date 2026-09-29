import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, History, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { deleteOne, listAll, listWhere, subscribeAll } from "../../lib/firestoreDb";
import type { Holiday, Task, TaskStatus } from "../../lib/types";
import { TASK_STATUS, TASK_STATUS_ORDER, changeTaskStatus, statusOf } from "../../lib/taskStatus";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { deadlineInfo } from "../../lib/workingDays";
import { formatDate, formatDateTime } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";
import TaskFormModal from "./TaskFormModal";

export default function Tasks() {
  const { user, staff: me, isAdmin, can } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canManage = isAdmin || can("tasks", "edit");
  const canSeeAll = isAdmin || can("tasks", "view");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | TaskStatus>("open");
  const [finishing, setFinishing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [staffData, holidaysData] = await Promise.all([
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
        listAll<Holiday>("holidays"),
      ]);
      if (cancelled) return;
      setStaff(staffData);
      setHolidays(holidaysData);
    })();

    let unsub: (() => void) | undefined;
    if (canSeeAll) {
      unsub = subscribeAll<Task>("tasks", (rows) => {
        setTasks(rows);
        setLoading(false);
      });
    } else if (email) {
      void listWhere<Task>("tasks", "assigned_to_email", email).then((rows) => {
        if (!cancelled) {
          setTasks(rows);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeAll, email]);

  const reloadMine = async () => {
    if (canSeeAll) return; // realtime subscription already handles it
    const rows = await listWhere<Task>("tasks", "assigned_to_email", email);
    setTasks(rows);
  };

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        statusFilter === "all" ? true : statusFilter === "open" ? statusOf(t) !== "done" : statusOf(t) === statusFilter,
      ),
    [tasks, statusFilter],
  );
  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { new: 0, in_progress: 0, done: 0 };
    for (const t of tasks) c[statusOf(t)]++;
    return c;
  }, [tasks]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (statusOf(a) !== statusOf(b)) return TASK_STATUS_ORDER[statusOf(a)] - TASK_STATUS_ORDER[statusOf(b)];
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db_ = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db_;
      }),
    [filtered],
  );

  const actor = { email, name: me?.full_name || email };
  const move = async (task: Task, status: TaskStatus, text = "") => {
    setBusyId(task.id);
    try {
      await changeTaskStatus(task, status, actor, text.trim());
      setFinishing(null);
      setNote("");
      void reloadMine();
    } finally {
      setBusyId(null);
    }
  };

  // In-page confirmation — browser confirm() dialogs can be blocked.
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const remove = async (id: string) => {
    setConfirmDel(null);
    await deleteOne("tasks", id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <ClipboardList className="h-6 w-6 text-brand-600" /> Vazifalar
          </h1>
          <p className="text-sm text-ink-500">
            {canSeeAll ? "Barcha xodimlarga biriktirilgan vazifalar" : "Sizga biriktirilgan vazifalar"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | TaskStatus)}
          >
            <option value="open">Bajarilmaganlar ({counts.new + counts.in_progress})</option>
            <option value="new">Yangi ({counts.new})</option>
            <option value="in_progress">Ishga olindi ({counts.in_progress})</option>
            <option value="done">Bajarildi ({counts.done})</option>
            <option value="all">Barchasi ({tasks.length})</option>
          </select>
          {canManage && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi vazifa
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={sorted.length === 0}
          emptyLabel="Vazifalar mavjud emas"
          emptyIcon={<ClipboardList className="h-5 w-5" />}
        >
          <div className="divide-y divide-ink-100">
            {sorted.map((t) => {
              const dl = deadlineInfo(t.due_date, holidays);
              const isMine = t.assigned_to_email.toLowerCase() === email;
              const st = statusOf(t);
              // Firestore rules: the assignee, or an admin, can move a task.
              const canMove = isMine || isAdmin;
              return (
                <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{t.title}</span>
                      <span className={`chip ${TASK_STATUS[st].chip}`}>{TASK_STATUS[st].label}</span>
                      {st !== "done" && dl?.overdue && (
                        <span className="chip gap-1 bg-rose-100 text-rose-700">
                          <AlertTriangle className="h-3 w-3" /> Kechikkan
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">
                        {t.description}
                      </p>
                    )}
                    {st === "done" && t.result_note && (
                      <p className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-900">
                        <b>Natija:</b> {t.result_note}
                      </p>
                    )}
                    <div className="mt-1.5 text-xs text-ink-500">
                      Xodim: <span className="font-medium text-ink-700">{t.assigned_to_name}</span>
                      {t.assigned_by_name && ` · Bergan: ${t.assigned_by_name}`}
                      {t.due_date && ` · Muddat: ${formatDate(t.due_date)}`}
                      {st !== "new" && t.started_at && ` · Ishga olindi: ${formatDateTime(t.started_at)}`}
                      {st === "done" && t.completed_at && ` · Bajarildi: ${formatDateTime(t.completed_at)}`}
                      {(t.history?.length || 0) > 0 && (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                          onClick={() => setHistoryOpen(historyOpen === t.id ? null : t.id)}
                        >
                          <History className="h-3 w-3" /> Tarix
                        </button>
                      )}
                    </div>
                    {historyOpen === t.id && (
                      <ol className="mt-2 space-y-1 border-l-2 border-ink-100 pl-3 text-xs text-ink-600">
                        {(t.history || []).map((h, i) => (
                          <li key={i}>
                            <span className={`chip mr-1.5 ${TASK_STATUS[h.status]?.chip || ""}`}>{TASK_STATUS[h.status]?.label || h.status}</span>
                            {formatDateTime(h.at)} · {h.by_name || h.by_email}
                            {h.note && <span className="text-ink-500"> — {h.note}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    {finishing === t.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          className="input min-w-[240px] flex-1"
                          placeholder="Nima qilindi? (ixtiyoriy: izoh yoki havola)"
                          value={note}
                          autoFocus
                          onChange={(e) => setNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && move(t, "done", note)}
                        />
                        <button className="btn-primary" onClick={() => move(t, "done", note)} disabled={busyId === t.id}>
                          <CheckCircle2 className="h-4 w-4" /> Tasdiqlash
                        </button>
                        <button className="btn-secondary" onClick={() => setFinishing(null)}>
                          Bekor
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canMove && st === "new" && (
                      <button className="btn-secondary" onClick={() => move(t, "in_progress")} disabled={busyId === t.id}>
                        <Play className="h-4 w-4" /> Ishga oldim
                      </button>
                    )}
                    {canMove && st !== "done" && finishing !== t.id && (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setFinishing(t.id);
                          setNote("");
                        }}
                        disabled={busyId === t.id}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Bajardim
                      </button>
                    )}
                    {canManage && st === "done" && (
                      <button className="btn-ghost text-xs" onClick={() => move(t, "in_progress", "Qayta ochildi")} disabled={busyId === t.id}>
                        Qayta ochish
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setEditing(t);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {confirmDel === t.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-ink-600">O'chirilsinmi?</span>
                            <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setConfirmDel(null)}>
                              Yo'q
                            </button>
                            <button className="btn-primary !bg-rose-600 !px-2 !py-1 text-xs" onClick={() => remove(t.id)}>
                              Ha
                            </button>
                          </span>
                        ) : (
                          <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => setConfirmDel(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AsyncState>
      </div>

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editing}
        staff={staff}
        onSaved={() => {
          setModalOpen(false);
          void reloadMine();
        }}
      />
    </div>
  );
}
