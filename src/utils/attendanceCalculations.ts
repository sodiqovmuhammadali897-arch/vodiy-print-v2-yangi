import type { AttendanceRecord, KpiWeights, LeaveRequest, PersonalSchedule, WorkSchedule } from "../lib/types";

export const formatMinutes = (total: number): string => {
  const m = Math.max(0, Math.round(total || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} daq`;
  return `${h} soat ${rem} daq`;
};

const TZ = "Asia/Tashkent";

export const dateCodeOf = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// 0 = Sunday, as Date.getDay().
export const WEEKDAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

type OffDays = Pick<WorkSchedule, "weeklyOffDay" | "offDays">;

export const offDaysOf = (schedule: OffDays): number[] =>
  Array.isArray(schedule.offDays) ? schedule.offDays : [schedule.weeklyOffDay];

export const isWeeklyOff = (date: Date, schedule: OffDays): boolean => {
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  return offDaysOf(schedule).includes(DAY_INDEX[dayName]);
};

// The general schedule with an employee's own hours and days off on top.
export const mergeSchedule = (general: WorkSchedule, own?: PersonalSchedule | null): WorkSchedule =>
  own
    ? {
        ...general,
        workStart: own.workStart || general.workStart,
        workEnd: own.workEnd || general.workEnd,
        offDays: Array.isArray(own.offDays) ? own.offDays : general.offDays,
      }
    : general;

const hmToMin = (hm: string): number => {
  const [h, m] = String(hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesOfDay = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
  return h * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
};

// Worked minutes between check-in and `until`: the lunch break only comes
// off for the part of it the stay covered (same rule as the server).
export const workedMinutesBetween = (
  checkIn: Date,
  until: Date,
  schedule: Pick<WorkSchedule, "breakStart" | "breakEnd" | "breakMinutes">,
): number => {
  const raw = Math.max(0, (until.getTime() - checkIn.getTime()) / 60000);
  const breakMinutes = schedule.breakMinutes || 0;
  let overlap = breakMinutes;
  if (schedule.breakStart && schedule.breakEnd) {
    const outMin = dateCodeOf(until) === dateCodeOf(checkIn) ? minutesOfDay(until) : 24 * 60;
    overlap = Math.min(breakMinutes, Math.max(0, Math.min(outMin, hmToMin(schedule.breakEnd)) - Math.max(minutesOfDay(checkIn), hmToMin(schedule.breakStart))));
  }
  return Math.max(0, Math.round(raw - overlap));
};

// Records saved before the break rule was fixed took the whole break off
// any stay; recount finished days from their check-in/out times.
export const withWorkedMinutes = <T extends Pick<AttendanceRecord, "checkInTimestamp" | "checkOutTimestamp" | "workedMinutes">>(
  record: T,
  schedule: Pick<WorkSchedule, "breakStart" | "breakEnd" | "breakMinutes">,
): T =>
  record.checkInTimestamp && record.checkOutTimestamp
    ? { ...record, workedMinutes: workedMinutesBetween(new Date(record.checkInTimestamp), new Date(record.checkOutTimestamp), schedule) }
    : record;

// Minutes a normal day of this schedule asks for (end − start − break).
export const dailyWorkMinutes = (schedule: Pick<WorkSchedule, "workStart" | "workEnd" | "breakMinutes">): number =>
  Math.max(0, hmToMin(schedule.workEnd) - hmToMin(schedule.workStart) - (schedule.breakMinutes || 0));

// Live "what would the admin table show right now" status for a
// employee+date pair that may not have an attendance doc yet (not
// checked in), may be mid-shift, or may be covered by an approved leave.
export const deriveDisplayStatus = (
  record: AttendanceRecord | null,
  schedule: WorkSchedule,
  approvedLeave: LeaveRequest | null,
  dateCode: string,
  now: Date = new Date(),
): string => {
  if (approvedLeave) {
    if (approvedLeave.type === "vacation") return "Ta'tilda";
    if (approvedLeave.type === "sick") return "Kasallik";
    return "Ruxsat bilan yo'q";
  }

  const today = dateCodeOf(now);
  if (isWeeklyOff(new Date(`${dateCode}T00:00:00`), schedule)) return "-";

  if (!record || !record.checkInTime) {
    if (dateCode > today) return "-";
    if (dateCode === today) {
      const [h, m] = schedule.workEnd.split(":").map(Number);
      const endMinutes = (h || 0) * 60 + (m || 0);
      const nowLocal = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const nh = Number(nowLocal.find((p) => p.type === "hour")?.value || 0);
      const nm = Number(nowLocal.find((p) => p.type === "minute")?.value || 0);
      return nh * 60 + nm > endMinutes ? "Sababsiz yo'q" : "Kelmagan";
    }
    return "Sababsiz yo'q";
  }

  if (record.checkOutTime) return record.status;

  const [bs1, bs2] = schedule.breakStart.split(":").map(Number);
  const [be1, be2] = schedule.breakEnd.split(":").map(Number);
  const breakStartMin = (bs1 || 0) * 60 + (bs2 || 0);
  const breakEndMin = (be1 || 0) * 60 + (be2 || 0);
  const nowLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const nh = Number(nowLocal.find((p) => p.type === "hour")?.value || 0);
  const nm = Number(nowLocal.find((p) => p.type === "minute")?.value || 0);
  const nowMin = nh * 60 + nm;
  if (nowMin >= breakStartMin && nowMin < breakEndMin) return "Tanaffusda";
  return "Ishda";
};

export const attendancePercent = (
  presentDays: number,
  totalWorkingDays: number,
): number => (totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 1000) / 10 : 0);

// Working days in `todayCode`'s month from the 1st up to and including
// today, skipping the weekly day off. Future days of the month don't count
// yet — an employee can't have been absent on a day that hasn't happened.
export const workingDaysSoFar = (
  todayCode: string,
  schedule: OffDays,
): number => {
  const [year, month] = todayCode.split("-").map(Number);
  let count = 0;
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
    const dateCode = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateCode > todayCode) break;
    if (!isWeeklyOff(new Date(`${dateCode}T00:00:00`), schedule)) count++;
  }
  return count;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

// The weighted monthly KPI score from attendance (and optionally tasks) —
// the single formula behind both an employee's own "Shaxsiy KPI" panel and
// the company-wide ranking in Hisobot, so the two can never disagree.
export const computeAttendanceKpi = (
  records: Pick<AttendanceRecord, "checkInTime" | "lateMinutes" | "workedMinutes">[],
  workingDays: number,
  weights: Pick<KpiWeights, "attendance" | "punctuality" | "hoursWorked" | "tasksCompleted">,
  tasks?: { total: number; done: number },
  dailyMinutes = 8 * 60,
) => {
  const present = records.filter((r) => r.checkInTime).length;
  const onTime = records.filter((r) => r.checkInTime && !(r.lateMinutes > 0)).length;
  const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
  const expectedMinutes = workingDays * dailyMinutes;

  const attendanceScore = (attendancePercent(present, workingDays) / 100) * weights.attendance;
  const punctualityScore = present > 0 ? (onTime / present) * weights.punctuality : 0;
  const hoursScore =
    expectedMinutes > 0 ? Math.min(1, totalWorkedMinutes / expectedMinutes) * weights.hoursWorked : 0;
  const hasTasks = !!tasks && tasks.total > 0;
  const tasksScore = hasTasks ? (tasks.done / tasks.total) * weights.tasksCompleted : 0;

  return {
    present,
    onTime,
    lateCount: present - onTime,
    absent: Math.max(0, workingDays - present),
    totalWorkedMinutes,
    attendancePct: attendancePercent(present, workingDays),
    attendanceScore: round1(attendanceScore),
    punctualityScore: round1(punctualityScore),
    hoursScore: round1(hoursScore),
    tasksScore: round1(tasksScore),
    hasTasks,
    maxScore:
      weights.attendance + weights.punctuality + weights.hoursWorked + (hasTasks ? weights.tasksCompleted : 0),
    score: round1(attendanceScore + punctualityScore + hoursScore + tasksScore),
  };
};
