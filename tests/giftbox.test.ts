import { describe, expect, it } from "vitest";
import { giftboxCostLookup, itemsLabel, priceFor, priceTable, printableItems, roundUp, tierFor, unitCost } from "../src/lib/giftbox";

const prints = [{ name: "Ruchka", cost: 800 }, { name: "Koja bloknot", cost: 6000 }, { name: "Bakal", cost: 10000 }, { name: "Termos", cost: 8000 }];
const items = [{ name: "Ruchka", qty: 1 }, { name: "Koja bloknot", qty: 1 }, { name: "Bakal", qty: 1 }];
const tiers = [{ min: 10, markup: 30 }, { min: 1, markup: 80 }, { min: 21, markup: 25 }];

describe("gift box", () => {
  it("counts one box's cost: the market price plus the prints", () => {
    expect(unitCost(170000, items, prints)).toBe(186800); // the owner's example
    expect(unitCost(170000, [...items, { name: "termos", qty: 2 }], prints)).toBe(202800);
    expect(unitCost(170000, [{ name: "Fleshka", qty: 1 }], prints)).toBe(170000); // no print price yet
  });

  it("prices by quantity from the markup table, rounded up", () => {
    const type = { prices: priceTable(170000, prints, tiers), round: 1000 };
    expect(priceFor(type, 15, items)).toBe(243000); // 186 800 + 30% = 242 840
    expect(priceFor(type, 5, items)).toBe(337000); // + 80%
    expect(priceFor(type, 25, items)).toBe(234000); // + 25% = 233 500
    expect(priceFor({ ...type, round: 0 }, 15, items)).toBe(242840);
    expect(priceFor({ prices: [], round: 1000 }, 15, items)).toBeNull(); // markup not set
  });

  it("gives managers no cost: only sale-price parts per tier", () => {
    const t = priceTable(170000, prints, tiers);
    expect(t.map((r) => r.min)).toEqual([1, 10, 21]);
    expect(t[1].box).toBe(221000);
    expect(t[1].items.ruchka).toBe(1040);
    expect(printableItems({ prices: t })).toEqual(["ruchka", "koja bloknot", "bakal", "termos"]);
  });

  it("helpers", () => {
    expect(tierFor([{ min: 10 }, { min: 1 }], 0)).toEqual({ min: 1 });
    expect(roundUp(242840, 1000)).toBe(243000);
    expect(roundUp(243000, 1000)).toBe(243000);
    expect(itemsLabel([{ name: "ruchka", qty: 1 }, { name: "bakal", qty: 2 }, { name: "x", qty: 0 }])).toBe("ruchka, bakal ×2");
  });

  it("suggests the box cost on the Marja page", () => {
    const look = giftboxCostLookup([{ id: "t1", box_cost: 170000 }], { prints, tiers, round: 1000 });
    expect(look({ giftbox: { type_id: "t1", items } })).toEqual([{ min_qty: 1, cost_price: 186800 }]);
    expect(look({ giftbox: { type_id: "other", items } })).toBeNull();
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
