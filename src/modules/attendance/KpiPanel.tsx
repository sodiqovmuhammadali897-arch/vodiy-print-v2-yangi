import { useEffect, useMemo, useState } from "react";
import { Gauge, Info } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { getOne, listWhere } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type KpiSettings, type Task, type WorkSchedule } from "../../lib/types";
import { getWorkSchedule, listMonthAttendance } from "../../services/attendanceService";
import { computeAttendanceKpi, dateCodeOf, workingDaysSoFar } from "../../utils/attendanceCalculations";

export default function KpiPanel() {
  const { user } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weights, setWeights] = useState(DEFAULT_KPI_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const monthPrefix = dateCodeOf(new Date()).slice(0, 7);
        const [sched, rows, settings, myTasks] = await Promise.all([
          getWorkSchedule(),
          listMonthAttendance(email, monthPrefix),
          getOne<KpiSettings>("kpi_settings", "default"),
          listWhere<Task>("tasks", "assigned_to_email", email),
        ]);
        setSchedule(sched);
        setRecords(rows);
        setTasks(myTasks.filter((t) => t.created_at.slice(0, 7) === monthPrefix));
        if (settings?.weights) setWeights(settings.weights);
      } catch (err) {
        setError(err instanceof Error ? err.message : "KPI ma'lumotlarini yuklab bo'lmadi");
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  const result = useMemo(() => {
    if (!schedule) return null;
    const workingDays = workingDaysSoFar(dateCodeOf(new Date()), schedule);
    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const kpi = computeAttendanceKpi(records, workingDays, weights, { total: tasks.length, done: doneTasks });
    return {
      ...kpi,
      taskCount: tasks.length,
      doneTasks,
      availableMax: kpi.maxScore,
      availableScore: kpi.score,
    };
  }, [schedule, records, tasks, weights]);

  if (error) {
    return <div className="card p-5 text-center text-sm text-rose-600">{error}</div>;
  }

  if (loading || !result) {
    return <div className="card p-5 text-center text-sm text-ink-500">Yuklanmoqda...</div>;
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-bold text-ink-900">Shaxsiy KPI (shu oy)</h2>
      </div>

      <div className="flex items-end gap-2">
        <span className="font-display text-3xl font-extrabold text-brand-700">
          {result.availableScore}
        </span>
        <span className="mb-1 text-sm text-ink-500">/ {result.availableMax} ball</span>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <KpiRow label={`Davomat (${weights.attendance} balldan)`} value={result.attendanceScore} />
        <KpiRow label={`Vaqtida kelish (${weights.punctuality} balldan)`} value={result.punctualityScore} />
        <KpiRow label={`Ishlangan soat (${weights.hoursWorked} balldan)`} value={result.hoursScore} />
        {result.hasTasks && (
          <KpiRow
            label={`Bajarilgan vazifalar (${result.doneTasks}/${result.taskCount}, ${weights.tasksCompleted} balldan)`}
            value={result.tasksScore}
          />
        )}
      </div>

      <div className="mt-4 flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {result.hasTasks
            ? "Buyurtmalarni vaqtida tugatish va rahbar bahosi keyingi bosqichda qo'shiladi."
            : "Bu oy sizga vazifa biriktirilmagan. Buyurtmalarni vaqtida tugatish va rahbar bahosi keyingi bosqichda qo'shiladi."}
        </span>
      </div>
    </div>
  );
}

function KpiRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
      <span className="text-ink-600">{label}</span>
      <span className="font-semibold text-ink-800">{value}</span>
    </div>
  );
}
