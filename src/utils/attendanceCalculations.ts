import type { AttendanceRecord, KpiWeights, LeaveRequest, WorkSchedule } from "../lib/types";

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

export const isWeeklyOff = (date: Date, schedule: Pick<WorkSchedule, "weeklyOffDay">): boolean => {
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  return DAY_INDEX[dayName] === schedule.weeklyOffDay;
};

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
  schedule: Pick<WorkSchedule, "weeklyOffDay">,
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
) => {
  const present = records.filter((r) => r.checkInTime).length;
  const onTime = records.filter((r) => r.checkInTime && !(r.lateMinutes > 0)).length;
  const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
  const expectedMinutes = workingDays * 8 * 60;

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
