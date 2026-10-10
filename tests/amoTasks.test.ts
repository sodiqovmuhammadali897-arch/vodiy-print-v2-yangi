import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const T = require("../meta-webhook/amoTasks");

// Tashkent time → ms.
const at = (s: string) => Date.parse(`${s}:00+05:00`);
const task = (id: number, due: string, done: boolean, updated: string, extra = {}) => ({
  id,
  user: 7,
  due: at(due),
  done,
  updated: at(updated),
  text: "",
  type: 1,
  entity: "leads",
  entityId: 100 + id,
  ...extra,
});

describe("amoCRM tasks", () => {
  const now = at("2026-10-10T15:00");
  const tasks = [
    task(1, "2026-10-02T18:00", true, "2026-10-02T17:00"), // on time
    task(2, "2026-10-03T18:00", true, "2026-10-04T10:00"), // done late
    task(3, "2026-10-05T18:00", false, "2026-10-01T10:00"), // still open, overdue
    task(4, "2026-10-10T23:59", false, "2026-10-09T10:00"), // due later today
    task(5, "2026-10-20T12:00", true, "2026-10-09T10:00"), // done early, due later
    task(6, "2026-10-25T12:00", false, "2026-10-09T10:00"), // not due yet: skipped
    task(7, "2026-09-28T12:00", true, "2026-09-28T10:00"), // last month
    task(8, "2026-10-12T12:00", false, "2026-10-09T10:00"), // missed on the 8th, then moved
  ];

  it("remembers tasks seen open past their deadline", () => {
    const misses = new Map([[8, { month: "2026-10", user: 7, due: at("2026-10-08T12:00") }]]);
    expect(T.newMisses(tasks, misses, now).map((m: { id: number }) => m.id)).toEqual([3]);
  });

  it("scores a month: on time ÷ came due, moved deadlines stay missed", () => {
    const misses = new Map([[8, { month: "2026-10", user: 7, due: at("2026-10-08T12:00") }]]);
    const leads = [
      { id: 101, user: 7, status: 10 },
      { id: 999, user: 7, status: 10 }, // open lead, no task
      { id: 998, user: 7, status: 142 }, // won: not counted
    ];
    const s = T.computeTasks("2026-10", { tasks, misses, leads, now }).get(7);
    expect([s.due, s.on_time, s.late]).toEqual([5, 2, 3]);
    expect(s.pct).toBe(40);
    // Only 3 is open past its deadline now (8 was moved to the 12th).
    expect(s.overdue_open).toBe(1);
    expect(s.past_open).toBe(1);
    expect([s.today_due, s.today_open]).toEqual([1, 1]);
    // Open tasks sit on leads 103, 104, 106, 108 — 101 and 999 have none.
    expect(s.no_task_leads).toBe(2);
    const sep = T.computeTasks("2026-09", { tasks, misses, now }).get(7);
    expect([sep.due, sep.on_time, sep.pct, sep.overdue_open]).toEqual([1, 1, 100, 0]);
  });

  it("writes the morning and evening messages", () => {
    const names = (t: { entityId: number }) => (t.entityId === 104 ? "Asia Tekstil" : null);
    const morning = T.morningText(tasks, at("2026-10-10T09:00"), names);
    expect(morning).toContain("☀️ Bugungi amoCRM zadachalaringiz: 1 ta");
    expect(morning).toContain("• Qo'ng'iroq — «Asia Tekstil»");
    expect(morning).toContain("⚠️ Muddati o'tgan: 1 ta");
    expect(T.eveningText(tasks, at("2026-10-10T18:00"), names)).toContain("🌆 Bugun bajarilmay qolgan zadachalar: 1 ta (1 tadan)");
    expect(T.eveningText([{ ...tasks[3], done: true }], at("2026-10-10T18:00"), names)).toBe("✅ Bugungi 1 ta zadachaning hammasi bajarildi. Rahmat!");
    expect(T.adminText([{ name: "Maryam", total: 5, open: 2, noTask: 3 }])).toBe("📊 Bugun amoCRM zadachalari\n• Maryam: 2 ta qoldi (5 tadan), zadachasiz lid: 3");
  });
  it("spots a task put off to a later day, and counts it", () => {
    const now = at("2026-10-10T15:00");
    const prev = task(20, "2026-10-10T17:00", false, "2026-10-09T10:00");
    expect(T.postponed(prev, { ...prev, due: at("2026-10-11T10:00") }, now)).toBe(true);
    expect(T.postponed(prev, { ...prev, due: at("2026-10-10T18:00") }, now)).toBe(false); // same day
    expect(T.postponed(prev, { ...prev, done: true, due: at("2026-10-11T10:00") }, now)).toBe(false); // done
    const future = task(21, "2026-10-12T10:00", false, "2026-10-09T10:00");
    expect(T.postponed(future, { ...future, due: at("2026-10-14T10:00") }, now)).toBe(false); // not due yet
    const moved = { ...prev, due: at("2026-10-11T10:00") };
    const misses = new Map([[20, { month: "2026-10", user: 7, due: prev.due, postponed: true, at: now }]]);
    const s = T.computeTasks("2026-10", { tasks: [moved, task(22, "2026-10-11T12:00", false, "2026-10-09T10:00")], misses, now }).get(7);
    expect([s.due, s.late, s.postponed_today, s.tomorrow_due]).toEqual([1, 1, 1, 2]);
    expect(T.postponeText(moved, prev.due, "Asia Tekstil", now)).toContain("⚠️ «Asia Tekstil» bo'yicha bugungi zadachani bajarmasdan 11-oktyabrga surdingiz.");
    expect(T.adminPostponeText("Nuriddin", moved, prev.due, "Asia Tekstil")).toBe("⚠️ Nuriddin: «Asia Tekstil» — 10-oktyabrdagi zadacha bajarilmasdan 11-oktyabrga surildi.");
  });
});
