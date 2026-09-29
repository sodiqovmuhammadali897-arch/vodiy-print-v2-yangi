import type { Task, TaskHistoryEntry, TaskStatus } from "./types";
import { updateOne } from "./firestoreDb";

export const TASK_STATUS: Record<TaskStatus, { label: string; chip: string }> = {
  new: { label: "Yangi", chip: "bg-sky-100 text-sky-700" },
  in_progress: { label: "Ishga olindi", chip: "bg-amber-100 text-amber-800" },
  done: { label: "Bajarildi", chip: "bg-emerald-100 text-emerald-700" },
};

// Order used when sorting: open work first.
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, new: 1, done: 2 };

export const statusOf = (t: Pick<Task, "status">): TaskStatus => (t.status in TASK_STATUS ? t.status : "new");

// Moves a task to a new status and appends who did it to its history.
// The server (meta-webhook/tasks.js) sees the change and sends the
// Telegram notices.
export const changeTaskStatus = async (
  task: Task,
  status: TaskStatus,
  actor: { email: string; name: string },
  note = "",
) => {
  const now = new Date().toISOString();
  const entry: TaskHistoryEntry = { status, at: now, by_name: actor.name, by_email: actor.email, ...(note ? { note } : {}) };
  await updateOne("tasks", task.id, {
    status,
    started_at: status === "new" ? null : task.started_at || now,
    completed_at: status === "done" ? now : null,
    ...(status === "done" ? { result_note: note } : {}),
    history: [...(task.history || []), entry],
    updated_at: now,
  });
};
