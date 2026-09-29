import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { formatDate } from "../../lib/format";
import { TASK_PRIORITY, TASK_STATUS, priorityOf, statusOf } from "../../lib/taskStatus";
import TaskFormModal, { type TaskPreset } from "./TaskFormModal";
import { useLinkedTasks } from "./TaskExtras";

// "Vazifalar" card for an order or customer page: its linked tasks and a
// button to give a new one already linked to it.
export default function LinkedTasksCard({ field, preset }: { field: "order_id" | "customer_id"; preset: TaskPreset }) {
  const { user, isAdmin } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const value = field === "order_id" ? preset.order_id : preset.customer_id || undefined;
  const tasks = useLinkedTasks(field, value, isAdmin, email);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }).then(setStaff).catch(() => setStaff([]));
  }, []);
  const sorted = [...tasks].sort((a, b) => (statusOf(a) === "done" ? 1 : 0) - (statusOf(b) === "done" ? 1 : 0));

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
          <ClipboardList className="h-4 w-4 text-brand-600" /> Vazifalar
        </h3>
        <button className="btn-ghost text-sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Vazifa berish
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-500">Bog'langan vazifa yo'q.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {sorted.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                {priorityOf(t) === "high" && `${TASK_PRIORITY.high.icon} `}
                <span className="font-semibold text-ink-900">{t.title}</span>
                <span className="block text-xs text-ink-500">
                  {t.assigned_to_name}
                  {t.due_date && ` · ${formatDate(t.due_date)}`}
                </span>
              </span>
              <span className={`chip ${TASK_STATUS[statusOf(t)].chip}`}>{TASK_STATUS[statusOf(t)].label}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/tasks" className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
        Barcha vazifalar →
      </Link>
      <TaskFormModal open={open} onClose={() => setOpen(false)} task={null} staff={staff} preset={preset} onSaved={() => setOpen(false)} />
    </div>
  );
}
