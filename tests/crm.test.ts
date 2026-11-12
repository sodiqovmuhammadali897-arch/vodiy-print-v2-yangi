import { describe, expect, it } from "vitest";
import { boardStats, columnOf, dueLabel, matchesLead, needsTask, nextTask, taskState } from "../src/lib/crm";

// 2026-11-12 10:00 Tashkent
const NOW = Date.parse("2026-11-12T10:00:00+05:00");

describe("crm board", () => {
  it("puts a lead in its column; after the order the order decides", () => {
    const orders = { o1: { status: "production" as const }, o2: { status: "closed" as const }, o3: { status: "cancelled" as const }, o4: { status: "awaiting_advance" as const } };
    expect(columnOf({ status: "new", converted_order_id: null }, orders)).toBe("new");
    expect(columnOf({ status: "offer", converted_order_id: null }, orders)).toBe("offer");
    expect(columnOf({ status: "telegram", converted_order_id: null }, orders)).toBe("info_given");
    expect(columnOf({ status: "lost", converted_order_id: null }, orders)).toBeNull();
    expect(columnOf({ status: "advance", converted_order_id: "o1" }, orders)).toBe("production");
    expect(columnOf({ status: "advance", converted_order_id: "o2" }, orders)).toBe("delivered");
    expect(columnOf({ status: "advance", converted_order_id: "o3" }, orders)).toBeNull();
    expect(columnOf({ status: "advance", converted_order_id: "o4" }, orders)).toBe("advance");
    expect(columnOf({ status: "advance", converted_order_id: "gone" }, orders)).toBe("advance");
  });

  it("knows late, today and later tasks", () => {
    expect(taskState({ due_date: "2026-11-12", due_time: "09:00" }, NOW)).toBe("late");
    expect(taskState({ due_date: "2026-11-12", due_time: "15:00" }, NOW)).toBe("today");
    expect(taskState({ due_date: "2026-11-12", due_time: "" }, NOW)).toBe("today");
    expect(taskState({ due_date: "2026-11-11", due_time: "" }, NOW)).toBe("late");
    expect(taskState({ due_date: "2026-11-13", due_time: "10:00" }, NOW)).toBe("later");
  });

  it("labels the due time", () => {
    expect(dueLabel({ due_date: "2026-11-12", due_time: "15:00" }, NOW)).toBe("bugun 15:00");
    expect(dueLabel({ due_date: "2026-11-13", due_time: "10:00" }, NOW)).toBe("ertaga 10:00");
    expect(dueLabel({ due_date: "2026-11-11", due_time: "16:00" }, NOW)).toBe("kecha 16:00");
    expect(dueLabel({ due_date: "2026-11-09", due_time: "" }, NOW)).toBe("3 kun o'tdi");
    expect(dueLabel({ due_date: "2026-11-20", due_time: "" }, NOW)).toBe("20-noy");
  });

  it("finds the next open task and the leads without one", () => {
    const tasks = [
      { lead_id: "a", status: "open" as const, due_date: "2026-11-14", due_time: "10:00" },
      { lead_id: "a", status: "open" as const, due_date: "2026-11-12", due_time: "09:00" },
      { lead_id: "a", status: "done" as const, due_date: "2026-11-10", due_time: "" },
      { lead_id: "b", status: "open" as const, due_date: "2026-11-12", due_time: "12:00" },
    ];
    expect(nextTask(tasks, "a")?.due_date).toBe("2026-11-12");
    expect(nextTask(tasks, "c")).toBeNull();
    const leads = [
      { id: "a", status: "accepted" as const, converted_order_id: null, created_at: "2026-11-12T03:00:00Z" },
      { id: "b", status: "new" as const, converted_order_id: null, created_at: "2026-11-10T03:00:00Z" },
      { id: "c", status: "info_given" as const, converted_order_id: null, created_at: "2026-11-12T04:00:00Z" },
      { id: "d", status: "advance" as const, converted_order_id: "o", created_at: "2026-11-01T04:00:00Z" },
      { id: "e", status: "lost" as const, converted_order_id: null, created_at: "2026-11-12T04:00:00Z" },
    ];
    expect(boardStats(leads, tasks, { o: { status: "production" } }, NOW)).toEqual({ newToday: 3, tasksToday: 2, late: 1, noTask: 1 });
    expect(needsTask("offer")).toBe(true);
    expect(needsTask("production")).toBe(false);
    expect(needsTask(null)).toBe(false);
  });

  it("searches by name, brand, LID and phone digits", () => {
    const l = { full_name: "Alisher", brand: "Agro Invest", phone: "+998 90 123 45 67", lead_number: "LID-2481" };
    expect(matchesLead(l, "agro")).toBe(true);
    expect(matchesLead(l, "lid-2481")).toBe(true);
    expect(matchesLead(l, "4567")).toBe(true);
    expect(matchesLead(l, "90 123")).toBe(true);
    expect(matchesLead(l, "zilola")).toBe(false);
    expect(matchesLead(l, "")).toBe(true);
  });
});
