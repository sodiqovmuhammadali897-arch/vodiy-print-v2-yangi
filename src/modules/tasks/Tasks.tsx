import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteOne, listAll, listWhere, subscribeAll, updateOne } from "../../lib/firestoreDb";
import type { Holiday, Task } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { deadlineInfo } from "../../lib/workingDays";
import { formatDate } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";
import TaskFormModal from "./TaskFormModal";

export default function Tasks() {
  const { user, isAdmin, can } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canManage = isAdmin || can("tasks", "edit");
  const canSeeAll = isAdmin || can("tasks", "view");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "done">("all");
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
    () => tasks.filter((t) => statusFilter === "all" || t.status === statusFilter),
    [tasks, statusFilter],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.status !== b.status) return a.status === "new" ? -1 : 1;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db_ = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db_;
      }),
    [filtered],
  );

  const markDone = async (task: Task) => {
    setBusyId(task.id);
    try {
      await updateOne("tasks", task.id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });
      void reloadMine();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Ushbu vazifani o'chirishni tasdiqlaysizmi?")) return;
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
            onChange={(e) => setStatusFilter(e.target.value as "all" | "new" | "done")}
          >
            <option value="all">Barchasi</option>
            <option value="new">Yangi</option>
            <option value="done">Bajarildi</option>
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
              return (
                <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{t.title}</span>
                      <span
                        className={`chip ${
                          t.status === "done"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {t.status === "done" ? "Bajarildi" : "Yangi"}
                      </span>
                      {t.status === "new" && dl?.overdue && (
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
                    <div className="mt-1.5 text-xs text-ink-500">
                      Xodim: <span className="font-medium text-ink-700">{t.assigned_to_name}</span>
                      {t.due_date && ` · Muddat: ${formatDate(t.due_date)}`}
                      {t.status === "done" && t.completed_at && ` · Bajarildi: ${formatDate(t.completed_at)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.status === "new" && isMine && (
                      <button
                        className="btn-primary"
                        onClick={() => markDone(t)}
                        disabled={busyId === t.id}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Bajardim
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
                        <button
                          className="btn-ghost text-rose-600 hover:bg-rose-50"
                          onClick={() => remove(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
