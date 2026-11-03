import { describe, expect, it } from "vitest";
import { guidePath, mainModel, oneLiner, SITUATIONS, tierView } from "../src/lib/guide";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FAMILIES } = require("../meta-webhook/guideFacts");

const top = [
  { key: "paket", lesson: "paket" },
  { key: "bloknot", lesson: "kanselyariya" },
  { key: "ruchka", lesson: "kanselyariya" },
];
const read = { seen: ["about", "script", "objections"] };

describe("guide path", () => {
  it("starts at day 1", () => {
    const { days, ready } = guidePath(top, undefined, {});
    expect(days.map((d) => d.state)).toEqual(["now", "next", "next", "next", "next"]);
    expect(days[2].total).toBe(2); // two distinct lessons behind three products
    expect(ready).toBe(false);
  });

  it("moves on as cards are opened, lessons read and tests passed", () => {
    const g = { seen: ["paket", "bloknot", "ruchka"], situations_at: "2026-11-03" };
    const { days } = guidePath(top, g, { paket: { ...read, quiz: 90 }, kanselyariya: { ...read, quiz: 60 } });
    expect(days.map((d) => d.state)).toEqual(["done", "done", "done", "now", "next"]);
    expect(days[3]).toMatchObject({ done: 1, total: 2 });
  });

  it("is ready after all five", () => {
    const g = { seen: ["paket", "bloknot", "ruchka"], situations_at: "x", shadow_at: "y" };
    expect(guidePath(top, g, { paket: { ...read, quiz: 80 }, kanselyariya: { ...read, quiz: 100 } }).ready).toBe(true);
  });
});

describe("guide helpers", () => {
  it("shows up to six tiers and how much cheaper the last is", () => {
    const tiers = [100, 200, 300, 500, 700, 900, 1000, 2000].map((q, i) => ({ min_qty: q, price: 16000 - i * 1200 }));
    const v = tierView(tiers);
    expect(v.rows.length).toBe(6);
    expect(v.rows[0].min_qty).toBe(100);
    expect(v.rows[5].min_qty).toBe(2000);
    expect(v.times).toBe(2.1); // 16 000 → 7 600
    expect(tierView([]).rows).toEqual([]);
  });

  it("picks the model with the most tiers", () => {
    expect(mainModel([{ id: "a", name: "A", has_image: false, min_qty: null, lead_days: null, tiers: [{ min_qty: 1, price: 1 }] }, { id: "b", name: "B", has_image: false, min_qty: null, lead_days: null, tiers: [{ min_qty: 1, price: 1 }, { min_qty: 2, price: 1 }] }])?.id).toBe("b");
  });

  it("cuts a lesson's about to one or two sentences", () => {
    expect(oneLiner("Birinchi gap. Ikkinchi gap! Uchinchi.\n\nBoshqa paragraf.")).toBe("Birinchi gap. Ikkinchi gap!");
  });

  it("uses only families the server knows", () => {
    const keys = new Set(FAMILIES.map((f: { key: string }) => f.key));
    for (const s of SITUATIONS) for (const f of s.families) expect(keys.has(f)).toBe(true);
  });
});
