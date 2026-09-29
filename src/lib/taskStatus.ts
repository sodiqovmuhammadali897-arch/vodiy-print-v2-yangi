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

export const TASK_PRIORITY: Record<import("./types").TaskPriority, { label: string; chip: string; rank: number; icon: string }> = {
  high: { label: "Shoshilinch", chip: "bg-rose-100 text-rose-700", rank: 0, icon: "🔴" },
  normal: { label: "Oddiy", chip: "bg-amber-50 text-amber-800", rank: 1, icon: "🟡" },
  low: { label: "Past", chip: "bg-ink-100 text-ink-600", rank: 2, icon: "⚪" },
};
export const priorityOf = (t: { priority?: string }) => (t.priority === "high" || t.priority === "low" ? t.priority : "normal");

export const REPEAT_LABEL = (r: import("./types").TaskRepeat | null | undefined): string => {
  if (!r) return "";
  const days = ["", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];
  if (r.type === "daily") return "Har kuni (yakshanbadan tashqari)";
  if (r.type === "weekly") return `Har hafta, ${days[r.weekday || 1]}`;
  return `Har oy, ${r.day || 1}-sana`;
};

// Shrinks a photo to fit in a Firestore document (≤ ~700 KB as a data URL).
export const fileToDataUrl = async (file: File): Promise<{ data: string; mime: string; size: number }> => {
  const readAsDataUrl = (f: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
      r.readAsDataURL(f);
    });
  if (!file.type.startsWith("image/")) {
    if (file.size > 650 * 1024) throw new Error(`${file.name}: 650 KB dan katta fayl — rasm yoki havola yuboring`);
    const data = await readAsDataUrl(file);
    return { data, mime: file.type || "application/octet-stream", size: file.size };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
      i.src = url;
    });
    for (const [max, q] of [[1600, 0.8], [1280, 0.72], [1000, 0.65], [800, 0.6]] as const) {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length < 900 * 1024) return { data, mime: "image/jpeg", size: Math.round((data.length * 3) / 4) };
    }
    throw new Error(`${file.name}: rasm juda katta`);
  } finally {
    URL.revokeObjectURL(url);
  }
};
