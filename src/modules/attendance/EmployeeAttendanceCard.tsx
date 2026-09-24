import { useEffect, useMemo, useState } from "react";
import { Clock, AlarmClock, CalendarX, Percent, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { getOne } from "../../lib/firestoreDb";
import type { Staff } from "../../lib/permissions";
import type { AttendanceRecord, WorkSchedule } from "../../lib/types";
import {
  getTodayAttendance,
  getWorkSchedule,
  listMonthAttendance,
} from "../../services/attendanceService";
import { attendancePercent, dateCodeOf, formatMinutes, workingDaysSoFar } from "../../utils/attendanceCalculations";
import CheckInButton from "./CheckInButton";
import CheckOutButton from "./CheckOutButton";

export default function EmployeeAttendanceCard() {
  const { user } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [now, setNow] = useState(new Date());
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const sched = await getWorkSchedule();
      setSchedule(sched);
      const [t, m] = await Promise.all([
        getTodayAttendance(email),
        listMonthAttendance(email, dateCodeOf(new Date()).slice(0, 7)),
      ]);
      setToday(t);
      setMonthRecords(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const liveWorkedMinutes = useMemo(() => {
    if (!today?.checkInTimestamp || today.checkOutTime) return today?.workedMinutes || 0;
    const elapsed = (now.getTime() - new Date(today.checkInTimestamp).getTime()) / 60000;
    return Math.max(0, Math.round(elapsed - (today.breakMinutes || 0)));
  }, [today, now]);

  const monthStats = useMemo(() => {
    if (!schedule) return null;
    const workingDays = workingDaysSoFar(dateCodeOf(now), schedule);
    const present = monthRecords.filter((r) => r.checkInTime).length;
    const lateCount = monthRecords.filter((r) => r.lateMinutes > 0).length;
    const totalMinutes = monthRecords.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
    const absent = Math.max(0, workingDays - present);
    return {
      totalHours: formatMinutes(totalMinutes),
      lateCount,
      absent,
      percent: attendancePercent(present, workingDays),
    };
  }, [monthRecords, schedule, now]);

  if (error) {
    return <div className="card p-5 text-center text-sm text-rose-600">{error}</div>;
  }

  if (loading || !schedule) {
    return <div className="card p-5 text-center text-sm text-ink-500">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {now.toLocaleDateString("uz-UZ", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
          <div className="font-display text-3xl font-extrabold text-ink-900">
            {now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-ink-500">Kelgan vaqt</div>
            <div className="mt-1 font-bold text-ink-900">{today?.checkInTime || "-"}</div>
          </div>
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-ink-500">Bugun ishlagan</div>
            <div className="mt-1 font-bold text-ink-900">{formatMinutes(liveWorkedMinutes)}</div>
          </div>
        </div>

        {today?.lateMinutes ? (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            Bugun {today.lateMinutes} daqiqa kech qoldingiz
          </div>
        ) : null}

        <div className="mt-4">
          {!today?.checkInTime ? (
            <CheckInButton schedule={schedule} onDone={load} />
          ) : !today.checkOutTime ? (
            <CheckOutButton schedule={schedule} onDone={load} />
          ) : (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
              Bugungi ish yakunlandi — {today.checkOutTime} da chiqdingiz
            </div>
          )}
        </div>
      </div>

      {monthStats && (
        <div className="card p-5">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">Shu oy</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox icon={<Clock className="h-4 w-4" />} label="Ishlagan soat" value={monthStats.totalHours} />
            <StatBox icon={<AlarmClock className="h-4 w-4" />} label="Kechikishlar" value={`${monthStats.lateCount} marta`} />
            <StatBox icon={<CalendarX className="h-4 w-4" />} label="Kelmagan kunlar" value={`${monthStats.absent} kun`} />
            <StatBox icon={<Percent className="h-4 w-4" />} label="Davomat foizi" value={`${monthStats.percent}%`} tone={monthStats.percent >= 90 ? "emerald" : monthStats.percent >= 75 ? "amber" : "rose"} />
          </div>
        </div>
      )}

      <TelegramLinkCard />
    </div>
  );
}

// Lets an employee receive attendance reminders / late notices in Telegram
// (free) instead of SMS: the server issues a one-time t.me deep link, the
// bot stores their chat id when they press Start.
function TelegramLinkCard() {
  const { user, staff } = useAuth();
  const [linked, setLinked] = useState(Boolean(staff?.telegram_chat_id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLinked(Boolean(staff?.telegram_chat_id)), [staff]);

  const link = async () => {
    setBusy(true);
    setError(null);
    // Open the tab synchronously so popup blockers allow it, then point it at the link.
    const tab = window.open("", "_blank");
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/webhooks/hr/link", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Havola olinmadi");
      if (tab) tab.location.href = data.url;
      else window.location.href = data.url;
      // Wait for the bot to confirm (the employee presses Start in Telegram).
      const email = (user?.email || "").toLowerCase();
      for (let i = 0; i < 40; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const fresh = await getOne<Staff>("staff", email);
        if (fresh?.telegram_chat_id) {
          setLinked(true);
          break;
        }
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="font-display text-base font-bold text-ink-900">Davomat xabarlari</h2>
        <p className="text-sm text-ink-500">
          {linked
            ? "Kech qolish va eslatmalar Telegram'ingizga keladi."
            : "Telegram'ni ulasangiz, eslatmalar SMS o'rniga Telegram'ga keladi."}
        </p>
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
      {linked ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Telegram ulangan
        </span>
      ) : (
        <button className="btn-primary" onClick={link} disabled={busy}>
          <Send className="h-4 w-4" /> {busy ? "Telegram'da Start bosing…" : "Telegram'ga ulash"}
        </button>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  tone = "ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-ink-900";
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <div className="flex items-center gap-1.5 text-ink-400">{icon}</div>
      <div className={`mt-1 font-display text-lg font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] font-semibold uppercase text-ink-500">{label}</div>
    </div>
  );
}
