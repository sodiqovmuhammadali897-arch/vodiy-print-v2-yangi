import { describe, expect, it } from "vitest";
import { callSummary, dayBounds, filterCalls, unreturned } from "../src/lib/callsLog";

const c = (id: string, t: string, o: Record<string, unknown>) => ({ id, created_at: t, start_time: t, phone: "+998901112233", ...o });
describe("calls log", () => {
  const calls = [
    c("1", "2026-11-25T04:00:00Z", { direction: "in", answered: false }),
    c("2", "2026-11-25T04:30:00Z", { direction: "out", answered: true, answer_time: "2026-11-25T04:30:05Z", end_time: "2026-11-25T04:31:05Z", staff_email: "m@x" }),
    c("3", "2026-11-25T06:00:00Z", { direction: "in", answered: false, phone: "+998935556677" }),
    c("4", "2026-11-25T07:00:00Z", { direction: "in", answered: true, duration_seconds: 20, staff_email: "n@x" }),
  ];
  it("summary and unreturned missed calls", () => {
    expect(callSummary(calls)).toEqual({ total: 4, inbound: 3, outbound: 1, talked: 1, missed: 2, unreturned: 1, talk: 80 });
    expect(unreturned(calls).map((x) => x.id)).toEqual(["3"]);
  });
  it("filters, newest first", () => {
    expect(filterCalls(calls, "missed", "").map((x) => x.id)).toEqual(["3", "1"]);
    expect(filterCalls(calls, "all", "m@x").map((x) => x.id)).toEqual(["2"]);
  });
  it("Tashkent day bounds", () => {
    expect(dayBounds("2026-11-25")).toEqual({ from: "2026-11-24T19:00:00.000Z", to: "2026-11-25T18:59:59.999Z" });
  });
});
