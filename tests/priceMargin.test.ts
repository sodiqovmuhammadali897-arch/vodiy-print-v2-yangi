import { describe, expect, it } from "vitest";
import { marginLabel, marginOf, parseMargin, priceFromMargin } from "../src/lib/priceMargin";

describe("price from cost and margin", () => {
  it("works out the sale price, rounded up to 100", () => {
    expect(priceFromMargin(4300, 35)).toBe(6700); // 6 615
    expect(priceFromMargin(2425, 40)).toBe(4100); // 4 041,7
    expect(priceFromMargin(2000, 50)).toBe(4000); // exact stays exact
    expect(priceFromMargin(1000, 0)).toBe(1000);
  });
  it("refuses what makes no sense", () => {
    expect(priceFromMargin(0, 35)).toBeNull();
    expect(priceFromMargin(4300, 100)).toBeNull();
    expect(priceFromMargin(4300, -1)).toBeNull();
    expect(priceFromMargin(4300, NaN)).toBeNull();
  });
  it("tells the margin of a typed price", () => {
    expect(marginOf(2200, 3300)).toBe(33.3);
    expect(marginOf(4300, 6700)).toBe(35.8);
    expect(marginOf(5000, 4500)).toBe(-11.1); // selling below cost
    expect(marginOf(0, 4500)).toBeNull();
  });
  it("reads and shows the field", () => {
    expect(parseMargin("33,3")).toBe(33.3);
    expect(parseMargin(" 35 ")).toBe(35);
    expect(parseMargin("")).toBeNull();
    expect(marginLabel(33.3)).toBe("33,3");
    expect(marginLabel(null)).toBe("");
  });
});
