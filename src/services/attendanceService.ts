import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { getOne, listWhere } from "../lib/firestoreDb";
import type { AttendanceRecord, WorkSchedule } from "../lib/types";
import { getCurrentPosition, GeolocationDeniedError } from "../utils/locationUtils";
import { dateCodeOf } from "../utils/attendanceCalculations";

const DEFAULT_SCHEDULE: WorkSchedule = {
  id: "default",
  workStart: "09:00",
  workEnd: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  breakMinutes: 60,
  weeklyOffDay: 0,
  officeLat: 0,
  officeLng: 0,
  officeRadiusMeters: 150,
  gpsCheckEnabled: false,
};

export const getWorkSchedule = async (): Promise<WorkSchedule> => {
  const doc = await getOne<WorkSchedule>("work_schedules", "default");
  return doc ? { ...DEFAULT_SCHEDULE, ...doc, id: "default" } : DEFAULT_SCHEDULE;
};

export const getTodayAttendance = async (email: string): Promise<AttendanceRecord | null> => {
  const dateCode = dateCodeOf(new Date());
  return getOne<AttendanceRecord>("attendance", `${email}_${dateCode}`);
};

export const listMonthAttendance = (email: string, monthPrefix: string) =>
  // dateCode is "YYYY-MM-DD"; range-filtering by prefix isn't a Firestore
  // equality op, so we fetch the employee's full history client-side and
  // filter — small per-employee volume makes this fine at this scale.
  listWhere<AttendanceRecord>("attendance", "employeeId", email, {
    orderBy: ["dateCode", "desc"],
  }).then((rows) => rows.filter((r) => r.dateCode.startsWith(monthPrefix)));

type CheckResult = { ok: boolean; status?: string };

const withLocation = async (
  schedule: WorkSchedule,
): Promise<{ latitude?: number; longitude?: number }> => {
  if (!schedule.gpsCheckEnabled) return {};
  try {
    const pos = await getCurrentPosition();
    return { latitude: pos.latitude, longitude: pos.longitude };
  } catch (err) {
    if (err instanceof GeolocationDeniedError) throw err;
    throw new GeolocationDeniedError("Joylashuvni aniqlab bo'lmadi");
  }
};

export const checkIn = async (
  schedule: WorkSchedule,
  photoDataUrl: string,
  deviceName?: string,
): Promise<CheckResult> => {
  const location = await withLocation(schedule);
  const fn = httpsCallable<
    { latitude?: number; longitude?: number; deviceName?: string; photoDataUrl: string },
    CheckResult
  >(functions, "attendanceCheckIn");
  const { data } = await fn({ ...location, deviceName, photoDataUrl });
  return data;
};

export const checkOut = async (schedule: WorkSchedule, photoDataUrl: string): Promise<CheckResult> => {
  const location = await withLocation(schedule);
  const fn = httpsCallable<
    { latitude?: number; longitude?: number; photoDataUrl: string },
    CheckResult
  >(functions, "attendanceCheckOut");
  const { data } = await fn({ ...location, photoDataUrl });
  return data;
};
