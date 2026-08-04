import type { AttendanceRecord, LeaveRequest, WorkSchedule } from "../lib/types";

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
