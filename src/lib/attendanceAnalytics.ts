import type { AttendanceRecord, Holiday, KpiWeights, LeaveRequest, PersonalSchedule, WorkSchedule } from "./types";
import { computeAttendanceKpi, dailyWorkMinutes, isWeeklyOff, mergeSchedule, withWorkedMinutes } from "../utils/attendanceCalculations";

// Davomat → Tahlil: every employee × every day of a period, and what the
// charts and the report table are drawn from. Days are Tashkent calendar
// days ("YYYY-MM-DD"), like attendance dateCodes.

export type DayKind =
  | "on_time" // came on time, left on time
  | "late" // came after the grace period
  | "early" // came on time, left before the end
  | "absent" // a working day with no check-in
  | "leave" // approved vacation / sick / permission
  | "off" // weekly day off or a holiday
  | "pending"; // today, the day is not over and nobody has checked in yet

export type DayCell = {
  kind: DayKind;
  record: AttendanceRecord | null;
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  // Minutes after the employee's own start time (negative = early).
  arrivalOffset: number | null;
  arrivalMinute: number | null;
};

export type StaffLite = { email: string; full_name?: string };

export type StaffSummary = {
  email: string;
  name: string;
  schedule: WorkSchedule;
  cells: DayCell[];
  workingDays: number;
  present: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  absent: number;
  workedMinutes: number;
  normMinutes: number;
  overtimeMinutes: number;
  avgArrivalMinute: number | null;
  avgArrivalOffset: number | null;
  attendancePct: number | null;
  kpiPct: number | null;
};

export type DayTotals = { date: string; onTime: number; late: number; absent: number; avgOffset: number | null; off: boolean };

export type PeriodTotals = {
  expected: number;
  present: number;
  attendancePct: number | null;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  workedMinutes: number;
  normMinutes: number;
  overtimeMinutes: number;
  overtimePeople: number;
  avgArrivalOffset: number | null;
};

export type Analytics = { days: string[]; staff: StaffSummary[]; daily: DayTotals[]; totals: PeriodTotals };

const hmToMin = (hm: string | null | undefined): number => {
  const [h, m] = String(hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const addDay = (code: string, n: number): string => new Date(Date.parse(`${code}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// Every day from `from` to `to`, both included (at most a year).
export const daysBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDay(d, 1)) out.push(d);
  return out;
};

const avg = (xs: number[]): number | null => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export const buildAnalytics = (input: {
  from: string;
  to: string;
  today: string;
  nowMinute: number; // minutes since Tashkent midnight
  staff: StaffLite[];
  general: WorkSchedule;
  personal: Map<string, PersonalSchedule>;
  records: AttendanceRecord[];
  leaves?: LeaveRequest[];
  holidays?: Holiday[];
  weights: Pick<KpiWeights, "attendance" | "punctuality" | "hoursWorked" | "tasksCompleted">;
}): Analytics => {
  const { today, nowMinute, general, weights } = input;
  // A period reaching into the future stops at today.
  const days = daysBetween(input.from, input.to < today ? input.to : today);
  const holidays = new Set((input.holidays || []).map((h) => h.date));
  const byKey = new Map(input.records.map((r) => [`${String(r.employeeId).toLowerCase()}_${r.dateCode}`, r]));
  const leaves = (input.leaves || []).filter((l) => l.status === "approved");

  const staff: StaffSummary[] = input.staff.map((s) => {
    const email = s.email.toLowerCase();
    const schedule = mergeSchedule(general, input.personal.get(email));
    const start = hmToMin(schedule.workStart);
    const end = hmToMin(schedule.workEnd);
    const daily = dailyWorkMinutes(schedule);
    const onLeave = (day: string) => leaves.some((l) => String(l.employeeId).toLowerCase() === email && l.fromDate <= day && day <= l.toDate);

    const cells: DayCell[] = days.map((day) => {
      const saved = byKey.get(`${email}_${day}`) || null;
      const record = saved && withWorkedMinutes(saved, schedule);
      const empty = { record, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0, overtimeMinutes: 0, arrivalOffset: null, arrivalMinute: null };
      if (record?.checkInTime) {
        const arrivalMinute = hmToMin(record.checkInTime);
        const lateMinutes = Math.max(0, record.lateMinutes || 0);
        const earlyMinutes = record.checkOutTime ? Math.max(0, record.earlyLeaveMinutes || 0) : 0;
        return {
          kind: lateMinutes > 0 ? "late" : earlyMinutes > 0 ? "early" : "on_time",
          record,
          lateMinutes,
          earlyMinutes,
          workedMinutes: record.workedMinutes || 0,
          overtimeMinutes: record.overtimeMinutes || 0,
          arrivalOffset: arrivalMinute - start,
          arrivalMinute,
        };
      }
      if (holidays.has(day) || isWeeklyOff(new Date(`${day}T12:00:00+05:00`), schedule)) return { kind: "off", ...empty };
      if (onLeave(day)) return { kind: "leave", ...empty };
      if (day === today && nowMinute <= end) return { kind: "pending", ...empty };
      return { kind: "absent", ...empty };
    });

    const counted = cells.filter((c) => c.kind !== "off" && c.kind !== "leave" && c.kind !== "pending");
    const present = counted.filter((c) => c.record?.checkInTime);
    // Hours and their norm only for finished days: today, before checking
    // out, would add a full day of norm against nothing worked yet.
    const finished = cells.filter((c, i) => c.kind !== "off" && c.kind !== "leave" && c.kind !== "pending" && (days[i] < today || !!c.record?.checkOutTime));
    const late = present.filter((c) => c.lateMinutes > 0);
    const kpi = computeAttendanceKpi(
      present.map((c) => ({ checkInTime: c.record!.checkInTime, lateMinutes: c.lateMinutes, workedMinutes: finished.includes(c) ? c.workedMinutes : 0 })),
      counted.length,
      weights,
      undefined,
      daily,
    );
    return {
      email,
      name: s.full_name || s.email,
      schedule,
      cells,
      workingDays: counted.length,
      present: present.length,
      lateCount: late.length,
      lateMinutes: late.reduce((sum, c) => sum + c.lateMinutes, 0),
      earlyCount: present.filter((c) => c.earlyMinutes > 0).length,
      absent: counted.filter((c) => c.kind === "absent").length,
      workedMinutes: finished.reduce((sum, c) => sum + c.workedMinutes, 0),
      normMinutes: finished.length * daily,
      overtimeMinutes: present.reduce((sum, c) => sum + c.overtimeMinutes, 0),
      avgArrivalMinute: avg(present.map((c) => c.arrivalMinute!)),
      avgArrivalOffset: avg(present.map((c) => c.arrivalOffset!)),
      attendancePct: counted.length ? Math.round((present.length / counted.length) * 100) : null,
      kpiPct: counted.length && kpi.maxScore ? Math.round((kpi.score / kpi.maxScore) * 100) : null,
    };
  });

  const daily: DayTotals[] = days.map((date, i) => {
    const cells = staff.map((s) => s.cells[i]);
    const offsets = cells.filter((c) => c.arrivalOffset !== null).map((c) => c.arrivalOffset!);
    return {
      date,
      onTime: cells.filter((c) => c.kind === "on_time" || c.kind === "early").length,
      late: cells.filter((c) => c.kind === "late").length,
      absent: cells.filter((c) => c.kind === "absent").length,
      avgOffset: avg(offsets),
      off: cells.every((c) => c.kind === "off" || c.kind === "leave"),
    };
  });

  const sum = (f: (s: StaffSummary) => number) => staff.reduce((t, s) => t + f(s), 0);
  const expected = sum((s) => s.workingDays);
  const present = sum((s) => s.present);
  const allOffsets = staff.flatMap((s) => s.cells.filter((c) => c.arrivalOffset !== null).map((c) => c.arrivalOffset!));
  return {
    days,
    staff,
    daily,
    totals: {
      expected,
      present,
      attendancePct: expected ? Math.round((present / expected) * 100) : null,
      lateCount: sum((s) => s.lateCount),
      lateMinutes: sum((s) => s.lateMinutes),
      earlyCount: sum((s) => s.earlyCount),
      workedMinutes: sum((s) => s.workedMinutes),
      normMinutes: sum((s) => s.normMinutes),
      overtimeMinutes: sum((s) => s.overtimeMinutes),
      overtimePeople: staff.filter((s) => s.overtimeMinutes > 0).length,
      avgArrivalOffset: avg(allOffsets),
    },
  };
};

// "4 daq erta" / "7 daq kech" / "vaqtida".
export const offsetLabel = (m: number | null): string => {
  if (m === null) return "—";
  if (m === 0) return "aynan vaqtida";
  const a = Math.abs(m);
  const t = a >= 60 ? `${Math.floor(a / 60)} soat ${a % 60} daq` : `${a} daq`;
  return m < 0 ? `${t} erta` : `${t} kech`;
};

export const hm = (m: number | null): string =>
  m === null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;

export const hoursLabel = (minutes: number): string => {
  const h = Math.round(minutes / 60);
  return `${h} soat`;
};
