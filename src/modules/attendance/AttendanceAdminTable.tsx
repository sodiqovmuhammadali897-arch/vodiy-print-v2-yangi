import { useEffect, useMemo, useState } from "react";
import { MapPin, PencilLine, Undo2, Users } from "lucide-react";
import { insertOne, listAll, subscribeWhere, updateOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import type { AttendanceRecord, PersonalSchedule, WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule, listPersonalSchedules } from "../../services/attendanceService";
import { deriveDisplayStatus, dateCodeOf, formatMinutes, mergeSchedule, withWorkedMinutes } from "../../utils/attendanceCalculations";
import AsyncState from "../../components/ui/AsyncState";
import ManualAttendanceModal from "./ManualAttendanceModal";

const STATUS_TONE: Record<string, string> = {
  "Kechikdi": "bg-amber-100 text-amber-800",
  "Sababsiz yo'q": "bg-rose-100 text-rose-700",
  "Erta ketdi": "bg-amber-100 text-amber-800",
  "Ishda": "bg-sky-100 text-sky-700",
  "Tanaffusda": "bg-slate-100 text-slate-700",
  "Ishni tugatdi": "bg-emerald-100 text-emerald-700",
  "Qo'shimcha ishladi": "bg-emerald-100 text-emerald-700",
  "Vaqtida keldi": "bg-emerald-100 text-emerald-700",
  "Kelmagan": "bg-ink-100 text-ink-600",
};

export default function AttendanceAdminTable() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [today, setToday] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [personal, setPersonal] = useState<Map<string, PersonalSchedule>>(new Map());
  const [loading, setLoading] = useState(true);
  const dateCode = dateCodeOf(new Date());
  const { user } = useAuth();
  const [undoing, setUndoing] = useState<string | null>(null);
  // Email of the person whose day is being filled in by hand ("" = pick one).
  const [manualFor, setManualFor] = useState<string | null>(null);

  // A check-out pressed by mistake (e.g. on someone else's phone): reopen
  // the day so the employee can work on and check out again. Logged.
  const undoCheckOut = async (s: Staff, record: AttendanceRecord) => {
    if (!window.confirm(`${s.full_name || s.email}: ${record.checkOutTime} dagi "ishni tugatish" bekor qilinsinmi? Kun qayta ochiladi.`)) return;
    setUndoing(record.id);
    try {
      await updateOne("attendance", record.id, {
        checkOutTime: null,
        checkOutTimestamp: null,
        checkOutLocation: null,
        workedMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status: (record.lateMinutes || 0) > 0 ? "Kechikdi" : "Vaqtida keldi",
        updatedAt: new Date().toISOString(),
      });
      await insertOne("attendance_audit", {
        attendance_id: record.id,
        employee_email: record.employeeId,
        action: "undo_check_out",
        before: { checkOutTime: record.checkOutTime, checkOutTimestamp: record.checkOutTimestamp, status: record.status },
        by_email: (user?.email || "").toLowerCase(),
        at: new Date().toISOString(),
      }).catch(() => undefined);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Bekor qilib bo'lmadi");
    } finally {
      setUndoing(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [staffData, sched, own] = await Promise.all([
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
        getWorkSchedule(),
        listPersonalSchedules().catch(() => new Map<string, PersonalSchedule>()),
      ]);
      if (cancelled) return;
      setStaff(staffData);
      setSchedule(sched);
      setPersonal(own);
    })();

    const unsub = subscribeWhere<AttendanceRecord>("attendance", "dateCode", dateCode, (rows) => {
      setToday(rows);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateCode]);

  const rows = useMemo(() => {
    if (!schedule) return [];
    const byEmail = new Map(today.map((r) => [r.employeeId, r]));
    return staff.map((s) => {
      const saved = byEmail.get(s.email) || null;
      const record = saved && withWorkedMinutes(saved, schedule);
      const own = mergeSchedule(schedule, personal.get(s.email.toLowerCase()));
      return {
        staff: s,
        record,
        hours: `${own.workStart}–${own.workEnd}`,
        personal: personal.has(s.email.toLowerCase()),
        status: deriveDisplayStatus(record, own, null, dateCode),
      };
    });
  }, [staff, today, schedule, personal, dateCode]);

  const summary = useMemo(() => {
    const present = rows.filter((r) => r.record?.checkInTime).length;
    const absent = rows.filter((r) => r.status === "Kelmagan" || r.status === "Sababsiz yo'q").length;
    const late = rows.filter((r) => (r.record?.lateMinutes || 0) > 0).length;
    const working = rows.filter((r) => r.status === "Ishda" || r.status === "Tanaffusda").length;
    return { present, absent, late, working };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Bugun kelganlar" value={summary.present} tone="emerald" />
        <SummaryCard label="Hozir ishda" value={summary.working} tone="sky" />
        <SummaryCard label="Kech qolganlar" value={summary.late} tone="amber" />
        <SummaryCard label="Kelmaganlar" value={summary.absent} tone="rose" />
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-secondary" disabled={!schedule} onClick={() => setManualFor("")}>
          <PencilLine className="h-4 w-4" /> Qo'lda belgilash
        </button>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={rows.length === 0}
          emptyLabel="Xodimlar topilmadi"
          emptyIcon={<Users className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Xodim</th>
                  <th className="table-th">Kelgan vaqt</th>
                  <th className="table-th">Ketgan vaqt</th>
                  <th className="table-th">Ishlagan soat</th>
                  <th className="table-th">Kechikish</th>
                  <th className="table-th">Erta ketish</th>
                  <th className="table-th">Qo'shimcha</th>
                  <th className="table-th">Holat</th>
                  <th className="table-th">Joylashuv</th>
                  <th className="table-th" aria-label="Amallar" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(({ staff: s, record, status, hours, personal: own }) => (
                  <tr key={s.email} className="hover:bg-ink-50/50">
                    <td className="table-td">
                      <div className="font-medium text-ink-800">{s.full_name || s.email}</div>
                      <div className={`text-[11px] ${own ? "font-semibold text-brand-600" : "text-ink-400"}`}>{hours}</div>
                    </td>
                    <td className="table-td">{record?.checkInTime || "-"}</td>
                    <td className="table-td">
                      {record?.checkOutTime ? (
                        <div className="flex items-center gap-1.5">
                          <span>{record.checkOutTime}</span>
                          {record.dateCode === dateCode && (
                            <button
                              type="button"
                              title="Chiqishni bekor qilish"
                              aria-label="Chiqishni bekor qilish"
                              disabled={undoing === record.id}
                              onClick={() => void undoCheckOut(s, record)}
                              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                            >
                              <Undo2 className="h-3 w-3" /> Bekor
                            </button>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-td">
                      {record?.workedMinutes ? formatMinutes(record.workedMinutes) : "-"}
                    </td>
                    <td className="table-td">
                      {record?.lateMinutes ? `${record.lateMinutes} daq` : "-"}
                    </td>
                    <td className="table-td">
                      {record?.earlyLeaveMinutes ? `${record.earlyLeaveMinutes} daq` : "-"}
                    </td>
                    <td className="table-td">
                      {record?.overtimeMinutes ? `${record.overtimeMinutes} daq` : "-"}
                    </td>
                    <td className="table-td">
                      <span className={`chip ${STATUS_TONE[status] || "bg-ink-100 text-ink-700"}`}>
                        {status}
                      </span>
                    </td>
                    <td className="table-td">
                      {record?.checkInLocation ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                          <MapPin className="h-3 w-3" /> bor
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td">
                      <button
                        type="button"
                        title="Qo'lda belgilash"
                        aria-label={`${s.full_name || s.email}: qo'lda belgilash`}
                        onClick={() => setManualFor(s.email.toLowerCase())}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      {schedule && (
        <ManualAttendanceModal
          open={manualFor !== null}
          onClose={() => setManualFor(null)}
          staff={staff}
          initialEmail={manualFor || ""}
          today={dateCode}
          scheduleFor={(email) => mergeSchedule(schedule, personal.get(email))}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "amber" | "rose";
}) {
  const cls = {
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
