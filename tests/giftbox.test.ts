import { describe, expect, it } from "vitest";
import { giftboxCostLookup, itemsLabel, priceFor, publicPrices, roundUp, tierFor, unitCost } from "../src/lib/giftbox";

const prints = [{ name: "Ruchka", cost: 800 }, { name: "Koja bloknot", cost: 6000 }, { name: "Bakal", cost: 10000 }, { name: "Termos", cost: 8000 }];
const items = [{ name: "Ruchka", qty: 1 }, { name: "Koja bloknot", qty: 1 }, { name: "Bakal", qty: 1 }];
const tiers = [{ min: 10, markup: 30 }, { min: 1, markup: 80 }, { min: 31, markup: 25 }];

describe("gift box", () => {
  it("counts one box's cost: the market price plus the prints", () => {
    expect(unitCost(170000, items, prints)).toBe(186800); // the owner's example
    expect(unitCost(170000, [...items, { name: "termos", qty: 2 }], prints)).toBe(202800);
    expect(unitCost(170000, [{ name: "Fleshka", qty: 1 }], prints)).toBe(170000); // no print price yet
  });

  it("prices the manager's box by quantity, rounded up", () => {
    const table = publicPrices(prints, tiers, 1000);
    expect(priceFor(table, 15, 170000, items)).toBe(243000); // 186 800 + 30% = 242 840
    expect(priceFor(table, 5, 170000, items)).toBe(337000); // + 80%
    expect(priceFor(table, 40, 170000, items)).toBe(234000); // + 25% = 233 500
    expect(priceFor(table, 15, 200000, items)).toBe(282000); // another box: 216 800 + 30%
    expect(priceFor({ ...table, round: 0 }, 15, 170000, items)).toBe(242840);
    expect(priceFor(publicPrices(prints, [], 1000), 15, 170000, items)).toBeNull(); // markup not set
    expect(priceFor(null, 15, 170000, items)).toBeNull();
  });

  it("the managers' table has no print price written out", () => {
    const t = publicPrices(prints, tiers, 1000);
    expect(t.rows.map((r) => r.min)).toEqual([1, 10, 31]);
    expect(t.rows[1].k).toBe(1.3);
    expect(t.rows[1].items.ruchka).toBe(1040);
    expect(t.names).toEqual(["Ruchka", "Koja bloknot", "Bakal", "Termos"]);
    expect(JSON.stringify(t)).not.toContain('"cost"');
  });

  it("helpers", () => {
    expect(tierFor([{ min: 10 }, { min: 1 }], 0)).toEqual({ min: 1 });
    expect(roundUp(242840, 1000)).toBe(243000);
    expect(roundUp(243000, 1000)).toBe(243000);
    expect(itemsLabel([{ name: "ruchka", qty: 1 }, { name: "bakal", qty: 2 }, { name: "x", qty: 0 }])).toBe("ruchka, bakal ×2");
  });

  it("suggests the box cost on the Marja page from the typed market price", () => {
    const look = giftboxCostLookup({ prints, tiers, round: 1000 });
    expect(look({ giftbox: { name: "Qora", box_cost: 170000, items } })).toEqual([{ min_qty: 1, cost_price: 186800 }]);
    expect(look({ giftbox: { name: "Qora", items } })).toBeNull(); // old line, no market price
    expect(look({})).toBeNull();
  });
});

import { canGiftbox } from "../src/lib/rolePermissions";
describe("canGiftbox", () => {
  const p = (view: boolean, edit: boolean) => ({ permissions: { giftbox: { view, edit } } });
  it("owner yes; manager account never; staff by the tick", () => {
    expect(canGiftbox({ isAdmin: true, isManagerAccount: false, staff: null }, "edit")).toBe(true);
    expect(canGiftbox({ isAdmin: true, isManagerAccount: true, staff: p(true, true) }, "view")).toBe(false);
    expect(canGiftbox({ isAdmin: false, isManagerAccount: true, staff: p(true, true) }, "view")).toBe(false);
    expect(canGiftbox({ isAdmin: false, isManagerAccount: false, staff: p(true, false) }, "view")).toBe(true);
    expect(canGiftbox({ isAdmin: false, isManagerAccount: false, staff: p(true, false) }, "edit")).toBe(false);
    expect(canGiftbox({ isAdmin: false, isManagerAccount: false, staff: { permissions: {} } }, "view")).toBe(false);
  });
});

import { offerNote } from "../src/lib/giftbox";
describe("offerNote", () => {
  it("UV line and the items", () => {
    expect(offerNote([{ name: "Koja bloknot", qty: 1 }, { name: "Ruchka", qty: 2 }])).toBe(
      "Gift box ichidagi barcha narsalarga logotipingiz UV printer orqali tushiriladi — o'chib ketmaydi.\nTo'plam: Koja bloknot, Ruchka ×2.",
    );
    expect(offerNote([])).not.toContain("To'plam");
  });
});
