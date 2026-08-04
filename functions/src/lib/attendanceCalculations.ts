import type { WorkSchedule } from "../types";

// Cloud Functions run in UTC regardless of region, so every wall-clock
// comparison against work hours must go through the office timezone —
// comparing raw UTC minutes against "09:00" would silently misfire.
const TZ = "Asia/Tashkent";

const partsOf = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
  };
};

export const dateCodeOf = (date: Date): string => {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}`;
};

export const hmOf = (date: Date): string => {
  const p = partsOf(date);
  return `${p.hour}:${p.minute}`;
};

const minutesOfDay = (date: Date): number => {
  const p = partsOf(date);
  return Number(p.hour) * 60 + Number(p.minute);
};

const parseHM = (hm: string): number => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const clampNonNegative = (n: number): number =>
  Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

export const computeCheckInStatus = (
  now: Date,
  schedule: WorkSchedule,
): { status: string; lateMinutes: number } => {
  const lateMinutes = clampNonNegative(minutesOfDay(now) - parseHM(schedule.workStart));
  return {
    status: lateMinutes > 0 ? "Kechikdi" : "Vaqtida keldi",
    lateMinutes,
  };
};

export const computeCheckOutStats = (
  checkIn: Date,
  checkOut: Date,
  schedule: WorkSchedule,
): {
  workedMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string;
} => {
  const endMin = parseHM(schedule.workEnd);
  const startMin = parseHM(schedule.workStart);
  const earlyLeaveMinutes = clampNonNegative(endMin - minutesOfDay(checkOut));

  const rawWorkedMinutes = clampNonNegative(
    (checkOut.getTime() - checkIn.getTime()) / 60000,
  );
  const workedMinutes = clampNonNegative(rawWorkedMinutes - schedule.breakMinutes);
  const requiredMinutes = clampNonNegative(endMin - startMin - schedule.breakMinutes);
  const overtimeMinutes = clampNonNegative(workedMinutes - requiredMinutes);

  const status =
    earlyLeaveMinutes > 0
      ? "Erta ketdi"
      : overtimeMinutes > 0
      ? "Qo'shimcha ishladi"
      : "Ishni tugatdi";

  return { workedMinutes, earlyLeaveMinutes, overtimeMinutes, status };
};
