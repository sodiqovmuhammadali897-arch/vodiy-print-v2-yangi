import { useEffect, useMemo, useState } from "react";
import { MapPin, Users } from "lucide-react";
import { listAll, subscribeWhere } from "../../lib/firestoreDb";
import type { AttendanceRecord, WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule } from "../../services/attendanceService";
import { deriveDisplayStatus, dateCodeOf, formatMinutes } from "../../utils/attendanceCalculations";
import AsyncState from "../../components/ui/AsyncState";

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
  const [loading, setLoading] = useState(true);
  const dateCode = dateCodeOf(new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [staffData, sched] = await Promise.all([
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
        getWorkSchedule(),
      ]);
      if (cancelled) return;
      setStaff(staffData);
      setSchedule(sched);
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
      const record = byEmail.get(s.email) || null;
      return {
        staff: s,
        record,
        status: deriveDisplayStatus(record, schedule, null, dateCode),
      };
    });
  }, [staff, today, schedule, dateCode]);

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
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(({ staff: s, record, status }) => (
                  <tr key={s.email} className="hover:bg-ink-50/50">
                    <td className="table-td font-medium text-ink-800">{s.full_name || s.email}</td>
                    <td className="table-td">{record?.checkInTime || "-"}</td>
                    <td className="table-td">{record?.checkOutTime || "-"}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>
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
