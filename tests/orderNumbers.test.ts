import { describe, expect, it } from "vitest";
import { orderNumberRange, rangeLabel } from "../src/lib/orderNumbers";

describe("order numbers before saving", () => {
  it("counts on from the next free number", () => {
    expect(orderNumberRange("VP-1048", 3)).toEqual(["VP-1048", "VP-1049", "VP-1050"]);
    expect(orderNumberRange("VP-998", 3)).toEqual(["VP-998", "VP-999", "VP-1000"]);
    expect(orderNumberRange("VP-007", 2)).toEqual(["VP-007", "VP-008"]);
    expect(orderNumberRange("", 2)).toEqual([]);
    expect(orderNumberRange("VP-12", 0)).toEqual([]);
  });
  it("labels a range", () => {
    expect(rangeLabel(["VP-1048", "VP-1049", "VP-1050"])).toBe("VP-1048 … VP-1050");
    expect(rangeLabel(["VP-1048"])).toBe("VP-1048");
    expect(rangeLabel([])).toBe("");
  });
});
