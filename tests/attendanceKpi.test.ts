import { describe, expect, it } from "vitest";
import {
  attendancePercent,
  attendanceSummary,
  dailyWorkMinutes,
  formatMinutes,
  mergeSchedule,
  workingDaysSoFar,
} from "../src/utils/attendanceCalculations";

const SUNDAY_OFF = { weeklyOffDay: 0 };

const day = (lateMinutes: number, workedMinutes: number) => ({
  checkInTime: "09:00",
  lateMinutes,
  workedMinutes,
});

describe("workingDaysSoFar", () => {
  // September 2026: the 1st is a Tuesday; Sundays fall on the 6th, 13th, 20th, 27th.
  it("counts only working days up to and including today", () => {
    expect(workingDaysSoFar("2026-09-01", SUNDAY_OFF)).toBe(1);
    expect(workingDaysSoFar("2026-09-06", SUNDAY_OFF)).toBe(5);
    expect(workingDaysSoFar("2026-09-21", SUNDAY_OFF)).toBe(18);
  });

  it("counts the whole month on its last day", () => {
    expect(workingDaysSoFar("2026-09-30", SUNDAY_OFF)).toBe(26);
  });
});

describe("attendancePercent / formatMinutes", () => {
  it("rounds attendance to one decimal and handles zero working days", () => {
    expect(attendancePercent(2, 3)).toBe(66.7);
    expect(attendancePercent(5, 0)).toBe(0);
  });

  it("formats worked time as hours and minutes", () => {
    expect(formatMinutes(451)).toBe("7 soat 31 daq");
    expect(formatMinutes(45)).toBe("45 daq");
    expect(formatMinutes(-10)).toBe("0 daq");
  });
});

describe("attendanceSummary", () => {
  const rec = (lateMinutes: number, earlyLeaveMinutes = 0) => ({ checkInTime: "09:00", lateMinutes, earlyLeaveMinutes, workedMinutes: 480 - lateMinutes - earlyLeaveMinutes });

  it("is 100% for a full month on time", () => {
    const s = attendanceSummary(Array.from({ length: 10 }, () => rec(0)), 10);
    expect([s.present, s.absent, s.lateCount, s.attendancePct, s.presencePct]).toEqual([10, 0, 0, 100, 100]);
  });

  it("takes off a missed day whole and late or early minutes", () => {
    // 5 days × 480 = 2400; one missed (−480), 30 late, 60 early → 1830.
    const s = attendanceSummary([rec(30), rec(0, 60), rec(0), rec(0)], 5);
    expect([s.present, s.absent, s.lateCount]).toEqual([4, 1, 1]);
    expect(s.presencePct).toBeCloseTo(76.3, 1);
  });

  it("ignores days with no check-in and works before the first day", () => {
    const s = attendanceSummary([{ checkInTime: null, lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0 }, rec(0)], 2);
    expect([s.present, s.absent, s.presencePct]).toEqual([1, 1, 50]);
    expect(attendanceSummary([], 0).presencePct).toBeNull();
  });
});

describe("personal schedules", () => {
  const general = {
    id: "default", workStart: "09:00", workEnd: "18:00", breakStart: "13:00", breakEnd: "14:00", breakMinutes: 60,
    weeklyOffDay: 0, officeLat: 0, officeLng: 0, officeRadiusMeters: 150, gpsCheckEnabled: false,
  };
  const own = { id: "a@x.uz", employee_email: "a@x.uz", workStart: "10:00", workEnd: "16:00", offDays: [0, 6] };

  it("keeps the general schedule for employees without their own", () => {
    expect(mergeSchedule(general, null)).toBe(general);
    expect(workingDaysSoFar("2026-09-30", general)).toBe(26);
  });

  it("uses the employee's hours and days off", () => {
    const merged = mergeSchedule(general, own);
    expect(merged.workStart).toBe("10:00");
    expect(dailyWorkMinutes(merged)).toBe(300); // 6 h minus the 1 h break
    // September 2026 has 4 Sundays and 4 Saturdays
    expect(workingDaysSoFar("2026-09-30", merged)).toBe(22);
  });

  it("an empty list of days off means working every day", () => {
    expect(workingDaysSoFar("2026-09-30", mergeSchedule(general, { ...own, offDays: [] }))).toBe(30);
  });

  it("counts a short day against the employee's own day length", () => {
    const records = [{ checkInTime: "10:00", lateMinutes: 60, earlyLeaveMinutes: 0, workedMinutes: 240 }];
    expect(attendanceSummary(records, 1, 300).presencePct).toBe(80);
  });
});

describe("withWorkedMinutes", () => {
  it("recounts a finished day: a 09:15–09:32 stay is 17 minutes, a full day 480", async () => {
    const { withWorkedMinutes } = await import("../src/utils/attendanceCalculations");
    const sched = { breakStart: "13:00", breakEnd: "14:00", breakMinutes: 60 };
    const r = (from: string, to: string) => ({ checkInTimestamp: `2026-10-01T${from}:00Z`, checkOutTimestamp: `2026-10-01T${to}:00Z`, workedMinutes: 0 });
    expect(withWorkedMinutes(r("04:15", "04:32"), sched).workedMinutes).toBe(17);
    expect(withWorkedMinutes(r("04:00", "13:00"), sched).workedMinutes).toBe(480);
    expect(withWorkedMinutes({ checkInTimestamp: "2026-10-01T04:00:00Z", checkOutTimestamp: null, workedMinutes: 5 }, sched).workedMinutes).toBe(5);
  });
});
