import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { botTasksOf } from "../src/lib/botTasks";
const require = createRequire(import.meta.url);
const BT = require("../meta-webhook/botTasks.js");
const R = require("../meta-webhook/recall.js");

describe("bot tasks (server)", () => {
  const nur = { full_name: "Nuriddin", report_manager_id: "m2" };
  it("before anything is ticked: RECALL_MANAGERS decides recall and debts", () => {
    expect(BT.wants(nur, "recall", { managerName: "Nuriddin", names: ["muhammadiyor", "nuriddin"] })).toBe(true);
    expect(BT.wants({ full_name: "Jamila", report_manager_id: "m3" }, "recall", { managerName: "Jamila", names: ["muhammadiyor", "nuriddin"] })).toBe(false);
    expect(BT.wants({ full_name: "Dilmurodjon" }, "debts", { names: [] })).toBe(false);
    expect(BT.wants({ full_name: "X" }, "leads")).toBe(true);
    expect(BT.wants({ full_name: "X" }, "amo")).toBe(true);
    expect(BT.wants({ full_name: "X" }, "tasks")).toBe(false); // task reminders: only when ticked
    expect(BT.wants({ full_name: "X", bot_tasks: { tasks: true } }, "tasks")).toBe(true);
  });
  it("a tick wins", () => {
    expect(BT.wants({ ...nur, bot_tasks: { recall: false, leads: false } }, "recall", { managerName: "Nuriddin", names: ["nuriddin"] })).toBe(false);
    expect(BT.wants({ ...nur, bot_tasks: { leads: false } }, "leads")).toBe(false);
    expect(BT.wants({ full_name: "Jamila", report_manager_id: "m3", bot_tasks: { recall: true } }, "recall", { names: ["nuriddin"] })).toBe(true);
  });
  it("per-day limit", () => {
    expect(BT.perDay({ bot_tasks: { recall_per_day: 10 } }, 20)).toBe(10);
    expect(BT.perDay({}, 20)).toBe(20);
    expect(BT.perDay({ bot_tasks: { recall_per_day: 0 } }, 20)).toBe(20);
  });
  it("initial() writes today's behaviour", () => {
    expect(BT.initial(nur, "Nuriddin", 20, ["nuriddin"])).toEqual({ recall: true, debts: true, leads: true, amo: true, tasks: false, recall_per_day: 20 });
  });
  it("whoNeedsNext uses each person's own limit", () => {
    const team = [{ manager_id: "a", cap: 2 }, { manager_id: "b", cap: 5 }];
    const todays = [{ manager_id: "a", status: "done" }, { manager_id: "a", status: "done" }, { manager_id: "b", status: "done" }, { manager_id: "b", status: "done" }];
    expect(R.whoNeedsNext(team, todays).map((m: { manager_id: string }) => m.manager_id)).toEqual(["b"]);
  });
});

describe("bot tasks (form)", () => {
  it("defaults match the server for an unticked person", () => {
    expect(botTasksOf(null)).toEqual({ recall: false, recall_per_day: 20, debts: false, leads: true, amo: true, tasks: false });
    expect(botTasksOf({ bot_tasks: { recall: true, recall_per_day: 15, leads: false } })).toMatchObject({ recall: true, recall_per_day: 15, leads: false });
  });
});
