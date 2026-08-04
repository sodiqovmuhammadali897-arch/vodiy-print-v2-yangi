import { useEffect, useMemo, useState } from "react";
import { Gauge, Info } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { getOne } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type KpiSettings, type WorkSchedule } from "../../lib/types";
import { getWorkSchedule, listMonthAttendance } from "../../services/attendanceService";
import { attendancePercent, dateCodeOf, isWeeklyOff } from "../../utils/attendanceCalculations";

export default function KpiPanel() {
  const { user } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [weights, setWeights] = useState(DEFAULT_KPI_WEIGHTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const [sched, rows, settings] = await Promise.all([
        getWorkSchedule(),
        listMonthAttendance(email, dateCodeOf(new Date()).slice(0, 7)),
        getOne<KpiSettings>("kpi_settings", "default"),
      ]);
      setSchedule(sched);
      setRecords(rows);
      if (settings?.weights) setWeights(settings.weights);
      setLoading(false);
    })();
  }, [email]);

  const result = useMemo(() => {
    if (!schedule) return null;
    const todayCode = dateCodeOf(new Date());
    let workingDays = 0;
    const [year, month] = todayCode.split("-").map(Number);
    for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
      const dateCode = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateCode > todayCode) break;
      if (!isWeeklyOff(new Date(`${dateCode}T00:00:00`), schedule)) workingDays++;
    }
    const present = records.filter((r) => r.checkInTime).length;
    const onTime = records.filter((r) => r.checkInTime && r.lateMinutes === 0).length;
    const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
    const expectedMinutesPerDay = 8 * 60;
    const expectedMinutes = workingDays * expectedMinutesPerDay;

    const attendanceScore = (attendancePercent(present, workingDays) / 100) * weights.attendance;
    const punctualityScore = present > 0 ? (onTime / present) * weights.punctuality : 0;
    const hoursScore =
      expectedMinutes > 0
        ? Math.min(1, totalWorkedMinutes / expectedMinutes) * weights.hoursWorked
        : 0;

    const availableMax = weights.attendance + weights.punctuality + weights.hoursWorked;
    const availableScore = attendanceScore + punctualityScore + hoursScore;

    return {
      attendanceScore: Math.round(attendanceScore * 10) / 10,
      punctualityScore: Math.round(punctualityScore * 10) / 10,
      hoursScore: Math.round(hoursScore * 10) / 10,
      availableMax,
      availableScore: Math.round(availableScore * 10) / 10,
    };
  }, [schedule, records, weights]);

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
      </div>

      <div className="mt-4 flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Hozircha faqat davomat asosidagi ko'rsatkichlar hisoblanmoqda. Bajarilgan vazifalar,
          buyurtmalarni vaqtida tugatish va rahbar bahosi keyingi bosqichda qo'shiladi.
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
