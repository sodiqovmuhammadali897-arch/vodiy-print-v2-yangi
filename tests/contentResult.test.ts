import { describe, expect, it } from "vitest";
import { normalizeContentResult } from "../src/lib/contentResult";

describe("video analysis result", () => {
  it("accepts lists and numbers sent as text", () => {
    const r = normalizeContentResult({
      umumiy_baho: "7,5",
      baholar: JSON.stringify({ boshlanish: { ball: "5", izoh: "sust" } }),
      tavsiyalar: "1. Boshini qisqartiring\n2. Narx yozing",
      matnlar: JSON.stringify([{ uslub: "oddiy", matn: "Matn", heshteglar: "#a" }]),
      reklamaga_mos: "true",
    })!;
    expect(r.umumiy_baho).toBe(7.5);
    expect(r.baholar.boshlanish).toEqual({ ball: 5, izoh: "sust" });
    expect(r.tavsiyalar).toEqual(["Boshini qisqartiring", "Narx yozing"]);
    expect(r.matnlar[0].matn).toBe("Matn");
    expect(r.reklamaga_mos).toBe(true);
  });
  it("never throws on a cut-off or empty answer", () => {
    expect(normalizeContentResult(undefined)).toBeNull();
    const r = normalizeContentResult({ umumiy_baho: 5 })!;
    expect(r.tavsiyalar).toEqual([]);
    expect(r.matnlar).toEqual([]);
  });
});
