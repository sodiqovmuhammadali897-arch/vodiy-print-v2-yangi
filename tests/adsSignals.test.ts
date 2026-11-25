import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SG = require("../meta-webhook/adsSignals.js");

const today = "2026-11-25";
const add = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const row = (o: Record<string, unknown>) => ({ c: "c1", cn: "Giftbox", s: "s1", sn: "Vodiy", a: "a1", an: "Video 1", spend: 0, impr: 0, link: 0, leads: 0, chats: 0, erp: 0, ...o });
const day = (d: string, ads: ReturnType<typeof row>[]) => ({ day: d, ads, totals: { spend: ads.reduce((x, y) => x + (y.spend as number), 0), results: ads.reduce((x, y) => x + (y.leads as number), 0) } });

// 27 normal days: 120 000 a day, 10 leads (12 000 each), CTR 1%.
const base = Array.from({ length: 27 }, (_, i) => day(add(today, -29 + i), [row({ spend: 120000, impr: 10000, link: 100, leads: 10 })]));

describe("agent signals", () => {
  it("quiet on a normal month", () => {
    const days = [...base, ...[-2, -1, 0].map((n) => day(add(today, n), [row({ spend: 120000, impr: 10000, link: 100, leads: 10 })]))];
    expect(SG.signals({ days, today })).toEqual([]);
  });
  it("money without results today, lead price jump, CTR drop", () => {
    const bad = [-2, -1, 0].map((n) => day(add(today, n), [row({ spend: 150000, impr: 10000, link: 40, leads: n === 0 ? 0 : 1 })]));
    const out = SG.signals({ days: [...base, ...bad], today });
    const kinds = out.map((s: { kind: string }) => s.kind).sort();
    expect(kinds).toEqual(["cpl", "ctr", "nores"]);
    const cpl = out.find((s: { kind: string }) => s.kind === "cpl");
    expect(cpl.evidence).toContain("225 000"); // 450 000 / 2 leads
    expect(cpl.advice).toContain("Video 1");
  });
  it("tired audience", () => {
    const pricey = [-2, -1, 0].map((n) => day(add(today, n), [row({ spend: 120000, impr: 10000, link: 100, leads: 5 })]));
    const out = SG.signals({ days: [...base, ...pricey], today, reach: { d7: { reach: 10000, impr: 30000 } } });
    expect(out.map((s: { kind: string }) => s.kind)).toContain("freq");
  });
  it("leads without sales, and a well-selling ad set", () => {
    const days = [...base, ...[-2, -1, 0].map((n) => day(add(today, n), [row({ spend: 120000, impr: 10000, link: 100, leads: 10 })]))];
    const attr = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, day: add(today, -20), c: "c1", s: "s9", a: "a1", orders: 0, revenue: 0 })),
      { id: "g1", day: add(today, -10), c: "c1", s: "s1", a: "a1", orders: 1, revenue: 9000000 },
      { id: "g2", day: add(today, -8), c: "c1", s: "s1", a: "a1", orders: 2, revenue: 12000000 },
    ];
    const kinds = SG.signals({ days, attr, today }).map((s: { kind: string }) => s.kind).sort();
    expect(kinds).toEqual(["good", "nosales"]);
  });
  it("rejected ads, and the message", () => {
    const out = SG.signals({ days: base, today, adsStatus: [{ id: "x", name: "Video 9", effective_status: "DISAPPROVED" }, { id: "y", name: "ok", effective_status: "ACTIVE" }] });
    expect(out).toHaveLength(1);
    expect(SG.signalsText(out)).toContain("budjetga tegmadim");
    expect(SG.signalsText(out)).toContain("rad etdi");
  });
});
