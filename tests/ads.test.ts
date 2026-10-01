import { describe, expect, it } from "vitest";
import { cplTone, movesFor } from "../src/lib/ads";

describe("Reklama approval moves", () => {
  it("marketolog passes a proposal on, only the admin approves it", () => {
    expect(movesFor("review", { admin: false, marketer: true }).map((m) => m.to)).toEqual(["approve", "rejected"]);
    expect(movesFor("approve", { admin: false, marketer: true })).toEqual([]);
    expect(movesFor("approve", { admin: true, marketer: false }).map((m) => m.to)).toEqual(["approved", "rejected"]);
    expect(movesFor("review", { admin: false, marketer: false })).toEqual([]);
  });
  it("on a warning anyone may stop, only the admin keeps it running", () => {
    expect(movesFor("warning", { admin: false, marketer: true }).map((m) => m.to)).toEqual(["approved"]);
    expect(movesFor("warning", { admin: true, marketer: false }).map((m) => m.to)).toEqual(["approved", "kept"]);
  });
  it("colours a lead price against the average", () => {
    expect(cplTone(8000, 10000)).toBe("good");
    expect(cplTone(25000, 10000)).toBe("ok");
    expect(cplTone(31000, 10000)).toBe("bad");
    expect(cplTone(null, 10000)).toBe("none");
  });
});
