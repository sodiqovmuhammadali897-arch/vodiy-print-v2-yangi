import { describe, expect, it } from "vitest";
import { isOrderNumber, orderNumberQuery, textMatches } from "../src/lib/search";

describe("order number search", () => {
  it("reads an order number however it is typed", () => {
    for (const q of ["vp 126", "VP-126", "vp126", "126", " VP 0126 "]) expect(orderNumberQuery(q)).toBe("126");
    expect(orderNumberQuery("Akmal")).toBeNull();
  });
  it("matches the exact number, not a longer one", () => {
    expect(isOrderNumber("VP-126", "126")).toBe(true);
    expect(isOrderNumber("VP-0126", "126")).toBe(true);
    expect(isOrderNumber("VP-1260", "126")).toBe(false);
  });
  it("ignores spaces and dashes in text search", () => {
    expect(textMatches("90 123 45", ["+998901234567"])).toBe(true);
    expect(textMatches("akmal karimov", ["Akmal Karimov"])).toBe(true);
    expect(textMatches("nur market", ["Nur-Market"])).toBe(true);
    expect(textMatches("zzz", ["Akmal"])).toBe(false);
  });
});
