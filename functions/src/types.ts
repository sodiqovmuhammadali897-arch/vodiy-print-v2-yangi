export type WorkSchedule = {
  workStart: string; // "HH:MM"
  workEnd: string; // "HH:MM"
  breakStart: string;
  breakEnd: string;
  breakMinutes: number;
  weeklyOffDay: number; // 0 = Sunday
  officeLat: number;
  officeLng: number;
  officeRadiusMeters: number;
  gpsCheckEnabled: boolean;
  updatedAt?: string;
};

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
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

export type GeoPoint = { latitude: number; longitude: number };

export type AttendanceRecord = {
  employeeId: string;
  employeeName: string;
  dateCode: string; // "YYYY-MM-DD"
  checkInTime: string | null; // "HH:MM"
  checkOutTime: string | null;
  checkInTimestamp: string | null;
  checkOutTimestamp: string | null;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string;
  authenticationMethod: "selfie" | "hikvision";
  checkInLocation: GeoPoint | null;
  checkOutLocation: GeoPoint | null;
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
};
