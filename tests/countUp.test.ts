import { describe, expect, it } from "vitest";
import { formatTemplate, parseNumberTemplate, sameShape } from "../src/lib/countUp";
import { formatMoney, formatMoneyShort } from "../src/lib/format";

const run = (v: unknown, at: number) => formatTemplate(parseNumberTemplate(v)!, at);

describe("count-up number templates", () => {
  it("keeps the unit while the number runs", () => {
    expect(run(formatMoneyShort(52_300_000), 0)).toBe("0.0 mln");
    expect(run(formatMoneyShort(52_300_000), 26.15)).toBe("26.1 mln");
    expect(run(formatMoneyShort(-4_000), 2)).toBe("−2.0 ming");
    expect(run(17, 8.6)).toBe("9");
  });

  it("keeps thousands separators and decimals", () => {
    const money = formatMoney(1234567);
    expect(parseNumberTemplate(money)!.value).toBe(1234567);
    expect(run(money, 1234567)).toBe(money);
    expect(run("1 234,50 so'm", 1000.5)).toBe("1 000,50 so'm");
    expect(run("1,234,567", 1000)).toBe("1,000");
    expect(run("33.9%", 10)).toBe("10.0%");
  });

  it("leaves dates, times and fractions alone", () => {
    for (const v of ["05.10.2026", "09:05", "3/5", "2026-10-21", "—", "", null]) expect(parseNumberTemplate(v)).toBeNull();
  });

  it("restarts from zero when the unit changes", () => {
    expect(sameShape(parseNumberTemplate("52.3 mln"), parseNumberTemplate("48.1 mln"))).toBe(true);
    expect(sameShape(parseNumberTemplate("52.3 mln"), parseNumberTemplate("980.0 ming"))).toBe(false);
    expect(sameShape(parseNumberTemplate("0"), parseNumberTemplate("52.3 mln"))).toBe(false);
  });
});
