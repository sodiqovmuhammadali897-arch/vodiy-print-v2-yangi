import { useEffect, useRef, useState } from "react";
import { AlarmClock, X } from "lucide-react";
import { listWhere } from "../../lib/firestoreDb";
import { leadTaskTypeLabel } from "../../lib/orderConstants";
import type { LeadTask } from "../../lib/types";

// In-app "vazifa vaqti keldi" notification — no push/service worker, so
// it only fires while this tab is open. Polls every 30s and toasts each
// task exactly once, the moment its due date+time is first reached.
export default function LeadTaskToasts({ email }: { email: string }) {
  const [toasts, setToasts] = useState<LeadTask[]>([]);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!email) return;

    const check = async () => {
      const rows = await listWhere<LeadTask>("lead_tasks", "assigned_to_email", email);
      const now = new Date();
      const justDue = rows.filter((t) => {
        if (t.status !== "open") return false;
        if (notified.current.has(t.id)) return false;
        const due = new Date(`${t.due_date}T${t.due_time || "00:00"}`);
        return due <= now;
      });
      if (justDue.length > 0) {
        justDue.forEach((t) => notified.current.add(t.id));
        setToasts((prev) => [...prev, ...justDue].slice(-4));
      }
    };

    void check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [email]);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-pop">
          <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-amber-900">Vazifa vaqti keldi</div>
            <div className="mt-0.5 text-xs text-amber-800">
              {t.lead_name} — {leadTaskTypeLabel(t.type)}
            </div>
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-amber-500 hover:text-amber-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
