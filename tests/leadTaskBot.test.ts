import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const B = require("../meta-webhook/leadTaskBot.js");
const C = require("../meta-webhook/callLeads.js");

// Tashkent wall time → epoch.
const at = (s: string) => Date.parse(`${s}:00+05:00`);
const task = (o: Record<string, unknown> = {}) => ({ id: "t1", lead_id: "L1", type: "call", due_date: "2026-11-26", due_time: "14:00", assigned_to_email: "nur@vp.uz", status: "open", ...o });

describe("task reminders", () => {
  it("due at its time, late 30 min on, once each", () => {
    expect(B.reminderNow(task(), at("2026-11-26T13:59"))).toBeNull();
    expect(B.reminderNow(task(), at("2026-11-26T14:00"))).toBe("due");
    expect(B.reminderNow(task({ reminded: { due: new Date(at("2026-11-26T14:00")).toISOString() } }), at("2026-11-26T14:10"))).toBeNull();
    expect(B.reminderNow(task({ reminded: { due: new Date(at("2026-11-26T14:00")).toISOString() } }), at("2026-11-26T14:30"))).toBe("late");
    expect(B.reminderNow(task({ reminded: { due: "x", late: "y" } }), at("2026-11-26T15:00"))).toBeNull();
  });
  it("a task first seen late gets one «late» message", () => {
    expect(B.reminderNow(task(), at("2026-11-26T15:00"))).toBe("late");
    // …but not right after a «due» one
    expect(B.reminderNow(task({ reminded: { due: new Date(at("2026-11-26T14:50")).toISOString() } }), at("2026-11-26T15:00"))).toBeNull();
  });
  it("quiet at night, old ones left to the page, needs an owner", () => {
    expect(B.reminderNow(task({ due_time: "21:00" }), at("2026-11-26T21:05"))).toBeNull();
    expect(B.reminderNow(task({ due_date: "2026-11-25", due_time: "10:00" }), at("2026-11-26T09:00"))).toBeNull(); // 23 h old
    expect(B.reminderNow(task({ due_date: "2026-11-25", due_time: "22:00" }), at("2026-11-26T08:00"))).toBe("late");
    expect(B.reminderNow(task({ assigned_to_email: "" }), at("2026-11-26T14:00"))).toBeNull();
    expect(B.reminderNow(task({ status: "done" }), at("2026-11-26T14:00"))).toBeNull();
  });
  it("a task without a time: at 09:00, no late nudge", () => {
    expect(B.reminderNow(task({ due_time: "" }), at("2026-11-26T08:59"))).toBeNull();
    expect(B.reminderNow(task({ due_time: "" }), at("2026-11-26T11:00"))).toBe("due");
    expect(B.reminderNow(task({ due_time: "", reminded: { due: "x" } }), at("2026-11-26T15:00"))).toBeNull();
  });
  it("buttons: done with a follow-up only when nothing else is open", () => {
    const now = at("2026-11-26T14:05");
    expect(B.plan("talk", false, now).follow).toMatchObject({ type: "follow_up", due_date: "2026-11-27", due_time: "10:00" });
    expect(B.plan("talk", true, now).follow).toBeNull();
    expect(B.plan("noans", false, now).follow).toMatchObject({ type: "call", due_date: "2026-11-26", due_time: "16:05" });
    expect(B.plan("noans", false, at("2026-11-26T17:30")).follow).toMatchObject({ due_date: "2026-11-27", due_time: "10:00" });
    expect(B.plan("h1", false, now).move).toEqual({ due_date: "2026-11-26", due_time: "15:05" });
    expect(B.plan("tom", false, now).move).toEqual({ due_date: "2026-11-27", due_time: "10:00" });
    expect(B.plan("zzz", false, now)).toBeNull();
  });
  it("message and buttons", () => {
    const text = B.reminderText("late", task({ note: "narx so'radi" }), { full_name: "Ali", brand: "Oq Non", phone: "998901234567", lead_number: "LID-201" }, at("2026-11-26T14:45"));
    expect(text).toContain("🔴 Zadacha muddati o'tdi · 14:00 (45 daqiqa)");
    expect(text).toContain("👤 Ali · Oq Non (LID-201)");
    expect(text).toContain("☎️ +998 90 123 45 67");
    expect(text).toContain("📝 narx so'radi");
    const kb = B.buttons("abcdefghijklmnopqrst").inline_keyboard.flat();
    expect(kb.map((b: { callback_data: string }) => b.callback_data)).toEqual(["lt:abcdefghijklmnopqrst:talk", "lt:abcdefghijklmnopqrst:noans", "lt:abcdefghijklmnopqrst:h1", "lt:abcdefghijklmnopqrst:tom"]);
    for (const b of kb) expect(Buffer.byteLength(b.callback_data)).toBeLessThanOrEqual(64);
  });
});

describe("a real call does the call task", () => {
  const now = at("2026-11-26T15:00");
  const tasks = [
    { id: "a", type: "call", due_date: "2026-11-26", status: "open" },
    { id: "b", type: "follow_up", due_date: "2026-11-25", status: "open" },
    { id: "c", type: "call", due_date: "2026-11-27", status: "open" },
    { id: "d", type: "send_price", due_date: "2026-11-26", status: "open" },
    { id: "e", type: "call", due_date: "2026-11-26", status: "done" },
  ];
  it("30 s or more closes call tasks due by today", () => {
    expect(C.tasksDoneByTalk(tasks, 45, now).map((t: { id: string }) => t.id)).toEqual(["a", "b"]);
    expect(C.tasksDoneByTalk(tasks, 20, now)).toEqual([]);
  });
  it("talk time from answer to end", () => {
    expect(C.talkedSeconds({ answered: true, answer_time: 1000, end_time: 1095, duration: 120 })).toBe(95);
    expect(C.talkedSeconds({ answered: true, duration: 40 })).toBe(40);
    expect(C.talkedSeconds({ answered: false, duration: 40 })).toBe(0);
    expect(C.talkLabel(95)).toBe("1 daq 35 s");
  });
});
