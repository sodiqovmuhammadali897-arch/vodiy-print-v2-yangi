import { describe, expect, it } from "vitest";
import { buildAnalytics, daysBetween, offsetLabel } from "../src/lib/attendanceAnalytics";
import { type AttendanceRecord, type PersonalSchedule, type WorkSchedule } from "../src/lib/types";

const general = {
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

const rec = (email: string, day: string, inHm: string, outHm: string | null, extra: Partial<AttendanceRecord> = {}): AttendanceRecord =>
  ({
    id: `${email}_${day}`,
    employeeId: email,
    employeeName: email,
    dateCode: day,
    checkInTime: inHm,
    checkOutTime: outHm,
    checkInTimestamp: new Date(`${day}T${inHm}:00+05:00`).toISOString(),
    checkOutTimestamp: outHm ? new Date(`${day}T${outHm}:00+05:00`).toISOString() : null,
    workedMinutes: 0,
    breakMinutes: 60,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    status: "",
    authenticationMethod: "selfie",
    checkInLocation: null,
    checkOutLocation: null,
    deviceName: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as AttendanceRecord;

// Thu 1 Oct – Mon 5 Oct 2026; Sunday the 4th is off.
const base = {
  from: "2026-10-01",
  to: "2026-10-05",
  today: "2026-10-05",
  nowMinute: 11 * 60,
  general,
};

describe("attendance analytics", () => {
  it("lists the days of a period", () => {
    expect(daysBetween("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("sorts every day of every employee", () => {
    const a = buildAnalytics({
      ...base,
      staff: [{ email: "Ali@x.uz", full_name: "Ali" }],
      personal: new Map(),
      records: [
        rec("ali@x.uz", "2026-10-01", "08:55", "18:10"),
        rec("ali@x.uz", "2026-10-02", "09:20", "18:00", { lateMinutes: 20 }),
        rec("ali@x.uz", "2026-10-03", "09:00", "16:00", { earlyLeaveMinutes: 120 }),
      ],
      leaves: [],
      holidays: [],
    });
    const s = a.staff[0];
    // 1 on time, 2 late, 3 early, 4 Sunday off, 5 today before the end: pending.
    expect(s.cells.map((c) => c.kind)).toEqual(["on_time", "late", "early", "off", "pending"]);
    expect(s.workingDays).toBe(3);
    expect(s.present).toBe(3);
    expect(s.lateCount).toBe(1);
    expect(s.lateMinutes).toBe(20);
    expect(s.earlyCount).toBe(1);
    // Worked minutes are recounted from the times, lunch hour taken off:
    // 9h15 − 1h, 8h40 − 1h, 7h − 1h.
    expect(s.workedMinutes).toBe(495 + 460 + 360);
    expect(s.normMinutes).toBe(3 * 480);
    expect(s.avgArrivalOffset).toBe(Math.round((-5 + 20 + 0) / 3));
    expect(s.attendancePct).toBe(100);
    expect(a.daily.map((d) => [d.onTime, d.late, d.absent])).toEqual([[1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(a.daily[3].off).toBe(true);
  });

  it("counts a missed working day, but not leave, holidays or a personal day off", () => {
    const personal = new Map<string, PersonalSchedule>([["vali@x.uz", { id: "p", employee_email: "vali@x.uz", workStart: "10:00", workEnd: "19:00", offDays: [6] }]]);
    const a = buildAnalytics({
      ...base,
      nowMinute: 20 * 60, // the day is over
      staff: [{ email: "vali@x.uz" }],
      personal,
      records: [rec("vali@x.uz", "2026-10-01", "10:05", "19:00")],
      leaves: [{ id: "l", employeeId: "vali@x.uz", employeeName: "", type: "sick", fromDate: "2026-10-02", toDate: "2026-10-02", reason: "", status: "approved", requestedAt: "" }],
      holidays: [{ id: "h", date: "2026-10-05", name: "Bayram" }],
    });
    const s = a.staff[0];
    // 1 came, 2 sick leave, 3 Saturday is his day off, 4 Sunday works for him → absent, 5 holiday.
    expect(s.cells.map((c) => c.kind)).toEqual(["on_time", "leave", "off", "absent", "off"]);
    expect(s.cells[0].arrivalOffset).toBe(5);
    expect(s.workingDays).toBe(2);
    expect(s.absent).toBe(1);
    expect(s.attendancePct).toBe(50);
    expect(a.totals.expected).toBe(2);
    expect(a.totals.attendancePct).toBe(50);
  });

  it("words arrival offsets", () => {
    expect(offsetLabel(-4)).toBe("4 daq erta");
    expect(offsetLabel(75)).toBe("1 soat 15 daq kech");
    expect(offsetLabel(0)).toBe("aynan vaqtida");
    expect(offsetLabel(null)).toBe("—");
  });
  it("counts time on the job against the schedule", () => {
    // 8-hour days. Thu on time, Fri 30 min late and 60 min early, Sat
    // missed, Mon (today, 11:00) in at 09:20 — late minutes count now.
    const a = buildAnalytics({
      ...base,
      staff: [{ email: "a@x.uz" }],
      personal: new Map(),
      records: [
        rec("a@x.uz", "2026-10-01", "09:00", "18:00"),
        rec("a@x.uz", "2026-10-02", "09:30", "17:00", { lateMinutes: 30, earlyLeaveMinutes: 60 }),
        rec("a@x.uz", "2026-10-05", "09:20", null, { lateMinutes: 20 }),
      ],
    }).staff[0];
    expect(a.presenceNormMinutes).toBe(4 * 480);
    expect(a.lostMinutes).toBe(90 + 480 + 20);
    expect(a.presencePct).toBeCloseTo(69.3, 1);
  });
});
