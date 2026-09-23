import { describe, expect, it } from "vitest";
import {
  attendancePercent,
  computeAttendanceKpi,
  formatMinutes,
  workingDaysSoFar,
} from "../src/utils/attendanceCalculations";
import { DEFAULT_KPI_WEIGHTS } from "../src/lib/types";

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

describe("computeAttendanceKpi", () => {
  it("gives the full attendance-based score for a perfect month", () => {
    const records = Array.from({ length: 10 }, () => day(0, 480));
    const kpi = computeAttendanceKpi(records, 10, DEFAULT_KPI_WEIGHTS);
    expect(kpi.attendanceScore).toBe(20);
    expect(kpi.punctualityScore).toBe(15);
    expect(kpi.hoursScore).toBe(10);
    expect(kpi.score).toBe(45);
    expect(kpi.maxScore).toBe(45);
    expect(kpi.absent).toBe(0);
  });

  it("adds the tasks component only when the employee had tasks", () => {
    const records = Array.from({ length: 10 }, () => day(0, 480));
    const kpi = computeAttendanceKpi(records, 10, DEFAULT_KPI_WEIGHTS, { total: 4, done: 2 });
    expect(kpi.tasksScore).toBe(10);
    expect(kpi.score).toBe(55);
    expect(kpi.maxScore).toBe(65);

    const noTasks = computeAttendanceKpi(records, 10, DEFAULT_KPI_WEIGHTS, { total: 0, done: 0 });
    expect(noTasks.hasTasks).toBe(false);
    expect(noTasks.maxScore).toBe(45);
  });

  it("scores a partial month with absences and a late arrival", () => {
    const records = [day(15, 240), day(0, 240), day(0, 240), day(0, 240), day(0, 240)];
    const kpi = computeAttendanceKpi(records, 10, DEFAULT_KPI_WEIGHTS);
    expect(kpi.present).toBe(5);
    expect(kpi.absent).toBe(5);
    expect(kpi.lateCount).toBe(1);
    expect(kpi.attendancePct).toBe(50);
    expect(kpi.attendanceScore).toBe(10); // 50% of 20
    expect(kpi.punctualityScore).toBe(12); // 4 of 5 on time × 15
    expect(kpi.hoursScore).toBe(2.5); // 1200 of 4800 expected minutes × 10
    expect(kpi.score).toBe(24.5);
  });

  it("caps the hours component at its weight even with lots of overtime", () => {
    const kpi = computeAttendanceKpi([day(0, 2000)], 1, DEFAULT_KPI_WEIGHTS);
    expect(kpi.hoursScore).toBe(10);
  });

  it("ignores days with no check-in", () => {
    const kpi = computeAttendanceKpi(
      [{ checkInTime: null, lateMinutes: 0, workedMinutes: 0 }, day(0, 480)],
      2,
      DEFAULT_KPI_WEIGHTS,
    );
    expect(kpi.present).toBe(1);
    expect(kpi.absent).toBe(1);
  });

  it("returns zeros instead of NaN at the very start of a month", () => {
    const kpi = computeAttendanceKpi([], 0, DEFAULT_KPI_WEIGHTS);
    expect(kpi.score).toBe(0);
    expect(Number.isNaN(kpi.punctualityScore)).toBe(false);
  });
});
