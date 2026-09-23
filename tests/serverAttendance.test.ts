import { describe, expect, it } from "vitest";
import {
  computeCheckInStatus,
  computeCheckOutStats,
  dateCodeOf,
  hmOf,
} from "../functions/src/lib/attendanceCalculations";
import { DEFAULT_WORK_SCHEDULE } from "../functions/src/types";

// The office is in Tashkent (UTC+5, no DST): 09:00 local is 04:00Z.
const at = (utc: string) => new Date(`2026-09-21T${utc}:00Z`);
const schedule = DEFAULT_WORK_SCHEDULE; // 09:00–18:00, 60 min break

describe("Tashkent time helpers (server)", () => {
  it("formats wall-clock time in Tashkent, not UTC", () => {
    expect(hmOf(at("04:00"))).toBe("09:00");
    expect(hmOf(at("13:30"))).toBe("18:30");
  });

  it("rolls the date over at Tashkent midnight, not UTC midnight", () => {
    expect(dateCodeOf(at("18:59"))).toBe("2026-09-21");
    expect(dateCodeOf(at("19:00"))).toBe("2026-09-22");
  });
});

describe("computeCheckInStatus", () => {
  it("is on time at exactly the start of the workday", () => {
    expect(computeCheckInStatus(at("04:00"), schedule)).toEqual({ status: "Vaqtida keldi", lateMinutes: 0 });
  });

  it("is on time when arriving early", () => {
    expect(computeCheckInStatus(at("03:40"), schedule).lateMinutes).toBe(0);
  });

  it("counts late minutes past the start of the workday", () => {
    expect(computeCheckInStatus(at("04:15"), schedule)).toEqual({ status: "Kechikdi", lateMinutes: 15 });
    expect(computeCheckInStatus(at("06:01"), schedule).lateMinutes).toBe(121);
  });
});

describe("computeCheckOutStats", () => {
  const checkIn = at("04:00"); // 09:00 local

  it("a full normal day: 8h worked after the break, no overtime or early leave", () => {
    expect(computeCheckOutStats(checkIn, at("13:00"), schedule)).toEqual({
      workedMinutes: 480,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      status: "Ishni tugatdi",
    });
  });

  it("leaving an hour early", () => {
    const stats = computeCheckOutStats(checkIn, at("12:00"), schedule);
    expect(stats.workedMinutes).toBe(420);
    expect(stats.earlyLeaveMinutes).toBe(60);
    expect(stats.status).toBe("Erta ketdi");
  });

  it("staying late counts as overtime", () => {
    const stats = computeCheckOutStats(checkIn, at("14:30"), schedule);
    expect(stats.workedMinutes).toBe(570);
    expect(stats.overtimeMinutes).toBe(90);
    expect(stats.status).toBe("Qo'shimcha ishladi");
  });

  it("never reports negative worked time for a very short stay", () => {
    const stats = computeCheckOutStats(checkIn, at("04:30"), schedule);
    expect(stats.workedMinutes).toBe(0);
  });
});
