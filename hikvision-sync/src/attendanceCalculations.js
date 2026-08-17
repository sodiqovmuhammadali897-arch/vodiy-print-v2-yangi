// Ported from functions/src/lib/attendanceCalculations.ts — kept in exact
// sync with the WebAuthn check-in/check-out math so "keldi/ketdi" status,
// kechikish, and ishlagan vaqt hisob-kitobi ikkala manba uchun bir xil bo'ladi.
const TZ = "Asia/Tashkent";

function partsOf(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
  };
}

export function dateCodeOf(date) {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function hmOf(date) {
  const p = partsOf(date);
  return `${p.hour}:${p.minute}`;
}

function minutesOfDay(date) {
  const p = partsOf(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

function parseHM(hm) {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function clampNonNegative(n) {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function computeCheckInStatus(now, schedule) {
  const lateMinutes = clampNonNegative(minutesOfDay(now) - parseHM(schedule.workStart));
  return {
    status: lateMinutes > 0 ? "Kechikdi" : "Vaqtida keldi",
    lateMinutes,
  };
}

export function computeCheckOutStats(checkIn, checkOut, schedule) {
  const endMin = parseHM(schedule.workEnd);
  const startMin = parseHM(schedule.workStart);
  const earlyLeaveMinutes = clampNonNegative(endMin - minutesOfDay(checkOut));

  const rawWorkedMinutes = clampNonNegative((checkOut.getTime() - checkIn.getTime()) / 60000);
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
}
