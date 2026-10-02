import { computeCheckInStatus, computeCheckOutStats } from "../../functions/src/lib/attendanceCalculations";
import type { AttendanceRecord, WorkSchedule } from "./types";

// An admin fills in a day the employee could not mark themselves (added to
// the system late, phone broken…). The numbers are worked out exactly as
// the check-in/check-out functions do, so reports and KPI treat the day the
// same way. Without a leave time the day stays open and the employee can
// still check out themselves.

export type ManualEntry = {
  email: string;
  name: string;
  dateCode: string; // YYYY-MM-DD
  checkIn: string; // HH:MM
  checkOut: string; // HH:MM or ""
};

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const at = (dateCode: string, hm: string) => new Date(`${dateCode}T${hm}:00+05:00`);

export const manualEntryError = (e: ManualEntry, today: string): string | null => {
  if (!e.email) return "Xodimni tanlang";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dateCode)) return "Sanani tanlang";
  if (e.dateCode > today) return "Kelajakdagi kunni belgilab bo'lmaydi";
  if (!HM.test(e.checkIn)) return "Kelgan vaqtni kiriting";
  if (e.checkOut && !HM.test(e.checkOut)) return "Ketgan vaqt noto'g'ri";
  if (e.checkOut && e.checkOut <= e.checkIn) return "Ketgan vaqt kelgan vaqtdan keyin bo'lishi kerak";
  if (e.dateCode === today && at(e.dateCode, e.checkIn).getTime() > Date.now()) return "Kelgan vaqt hali bo'lmagan";
  if (e.dateCode === today && e.checkOut && at(e.dateCode, e.checkOut).getTime() > Date.now()) return "Ketgan vaqt hali bo'lmagan";
  return null;
};

export const buildManualRecord = (
  e: ManualEntry,
  schedule: WorkSchedule,
  existing: Partial<AttendanceRecord> | null,
  nowIso: string,
): Omit<AttendanceRecord, "id"> => {
  const inAt = at(e.dateCode, e.checkIn);
  const { status, lateMinutes } = computeCheckInStatus(inAt, schedule);
  const base = {
    employeeId: e.email,
    employeeName: existing?.employeeName || e.name || e.email,
    dateCode: e.dateCode,
    checkInTime: e.checkIn,
    checkInTimestamp: inAt.toISOString(),
    breakMinutes: schedule.breakMinutes,
    lateMinutes,
    authenticationMethod: "manual" as const,
    checkInLocation: existing?.checkInLocation ?? null,
    deviceName: existing?.deviceName ?? null,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  if (!e.checkOut) {
    return { ...base, checkOutTime: null, checkOutTimestamp: null, checkOutLocation: null, workedMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, status };
  }
  const outAt = at(e.dateCode, e.checkOut);
  const out = computeCheckOutStats(inAt, outAt, schedule);
  return {
    ...base,
    checkOutTime: e.checkOut,
    checkOutTimestamp: outAt.toISOString(),
    checkOutLocation: existing?.checkOutLocation ?? null,
    ...out,
  };
};
