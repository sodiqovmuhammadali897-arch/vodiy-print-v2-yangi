import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/modules/darslik/lessonsData";
import { fillScript, isRead, lessonFacts, lessonState, productsOf, score } from "../src/modules/darslik/lessonFacts";
import { PRODUCT_CATEGORIES } from "../src/lib/orderConstants";

describe("Darslik lessons", () => {
  it("are complete and their tests are answerable", () => {
    const keys = new Set<string>();
    for (const l of LESSONS) {
      expect(keys.has(l.key), l.key).toBe(false);
      keys.add(l.key);
      expect(PRODUCT_CATEGORIES as readonly string[]).toContain(l.category);
      expect(l.match.length, l.key).toBeGreaterThan(0);
      expect(l.steps.length, l.key).toBeGreaterThanOrEqual(5);
      expect(l.objections.length, l.key).toBeGreaterThanOrEqual(4);
      expect(l.faq.length, l.key).toBeGreaterThanOrEqual(3);
      expect(l.quiz.length, l.key).toBe(5);
      for (const q of l.quiz) {
        expect(q.correct, q.q).toBeGreaterThanOrEqual(0);
        expect(q.correct, q.q).toBeLessThan(q.options.length);
        expect(q.why.length, q.q).toBeGreaterThan(5);
      }
      // only the three known placeholders
      for (const s of l.steps) expect(s.say.replace(/\{(narx|tiraj|muddat)\}/g, "")).not.toMatch(/[{}]/);
    }
  });
});

describe("lesson facts", () => {
  const products = [
    { id: "a", name: "Qog'oz paket kraft", base_price: 4500, price_tiers: [{ min_qty: 1000, price: 2900 }], min_order_qty: 500, lead_time_days: 7 },
    { id: "b", name: "Paket oq laminatsiya", base_price: 6500, price_tiers: [], min_order_qty: 1000, lead_time_days: 10 },
    { id: "c", name: "Paket eski", base_price: 100, archived_at: "2026-01-01" },
    { id: "d", name: "Vizitka", base_price: 300 },
  ];
  const paket = LESSONS.find((l) => l.key === "paket")!;

  it("takes the matching live products", () => {
    expect(productsOf(paket, products).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sums up price, smallest run and lead time", () => {
    const f = lessonFacts(paket, products);
    expect(f.narx).toBe("2 900 – 6 500 so'm");
    expect(f.tiraj).toBe("500");
    expect(f.muddat).toBe("7–10 kun");
    expect(lessonFacts(paket, []).narx).toBeNull();
  });

  it("fills the script and marks missing numbers", () => {
    const pieces = fillScript("{tiraj} donadan, {muddat}.", { narx: null, tiraj: "500", muddat: null });
    expect(pieces).toEqual([
      { text: "500", fact: "tiraj" },
      { text: " donadan, " },
      { text: "muddat", fact: "muddat", missing: true },
      { text: "." },
    ]);
  });

  it("counts a lesson read after its core tabs and scores tests", () => {
    expect(lessonState(undefined)).toBe("new");
    expect(lessonState({ seen: ["about"] })).toBe("started");
    expect(isRead({ seen: ["about", "script", "objections"] })).toBe(true);
    expect(score([1, 0, 2, null, 1], [1, 1, 2, 0, 1])).toBe(60);
  });
});
