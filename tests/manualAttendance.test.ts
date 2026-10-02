import { describe, expect, it } from "vitest";
import { buildManualRecord, manualEntryError } from "../src/lib/manualAttendance";
import type { WorkSchedule } from "../src/lib/types";

const schedule = {
  id: "default",
  workStart: "09:00",
  workEnd: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  breakMinutes: 60,
  weeklyOffDay: 0,
  graceMinutes: 5,
  officeLat: 0,
  officeLng: 0,
  officeRadiusMeters: 100,
  gpsCheckEnabled: false,
} as WorkSchedule;
const now = "2026-10-02T07:00:00.000Z";
const entry = { email: "maryam@x.uz", name: "Maryam", dateCode: "2026-10-01", checkIn: "09:20", checkOut: "18:30" };

describe("manual attendance", () => {
  it("works out a full past day like check-in/out do", () => {
    const r = buildManualRecord(entry, schedule, null, now);
    expect(r).toMatchObject({
      employeeId: "maryam@x.uz",
      employeeName: "Maryam",
      dateCode: "2026-10-01",
      checkInTime: "09:20",
      checkInTimestamp: "2026-10-01T04:20:00.000Z",
      checkOutTime: "18:30",
      checkOutTimestamp: "2026-10-01T13:30:00.000Z",
      lateMinutes: 20,
      workedMinutes: 490,
      earlyLeaveMinutes: 0,
      // 490 worked against 480 required — same rule as the check-out function.
      overtimeMinutes: 10,
      status: "Qo'shimcha ishladi",
      authenticationMethod: "manual",
      createdAt: now,
    });
  });

  it("leaves the day open without a leave time", () => {
    const r = buildManualRecord({ ...entry, dateCode: "2026-10-02", checkIn: "09:03", checkOut: "" }, schedule, null, now);
    expect(r).toMatchObject({ checkOutTime: null, checkOutTimestamp: null, workedMinutes: 0, lateMinutes: 0, status: "Vaqtida keldi" });
  });

  it("keeps the first save date and the name already on the record", () => {
    const r = buildManualRecord(entry, schedule, { employeeName: "Maryam Aliyeva", createdAt: "2026-10-01T04:00:00.000Z" }, now);
    expect(r.employeeName).toBe("Maryam Aliyeva");
    expect(r.createdAt).toBe("2026-10-01T04:00:00.000Z");
  });

  it("refuses bad input", () => {
    expect(manualEntryError({ ...entry, email: "" }, "2026-10-02")).toBe("Xodimni tanlang");
    expect(manualEntryError({ ...entry, dateCode: "2026-10-03" }, "2026-10-02")).toMatch(/Kelajak/);
    expect(manualEntryError({ ...entry, checkOut: "09:00" }, "2026-10-02")).toMatch(/keyin/);
    expect(manualEntryError({ ...entry, checkIn: "" }, "2026-10-02")).toBe("Kelgan vaqtni kiriting");
    expect(manualEntryError(entry, "2026-10-02")).toBeNull();
  });
});
