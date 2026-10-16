import { describe, expect, it } from "vitest";
import { lessonFor, priceText } from "../src/modules/products/ProductSheet";

describe("product sheet", () => {
  it("writes the customer price list for Telegram", () => {
    const text = priceText({ name: "Vizitka 350 g", unit: "dona", base_price: 350, price_tiers: [{ min_qty: 500, price: 250 }, { min_qty: 100, price: 350 }], min_order_qty: 100, lead_time_days: 2 });
    expect(text.split("\n")).toEqual(["Vizitka 350 g", "100+ dona — 350 so'm", "500+ dona — 250 so'm", "Minimal buyurtma: 100 dona", "Tayyor bo'lishi: 2 kun", "", "Vodiy Print · +998 77 200 88 55"]);
    expect(priceText({ name: "Banner", unit: "", base_price: 90000, price_tiers: [], min_order_qty: 0, lead_time_days: 0 })).toContain("Narx: 90 000 so'm / dona");
  });

  it("finds the Darslik lesson of a product", () => {
    expect(lessonFor({ id: "1", name: "Qog'oz paket kraft" })?.key).toBe("paket");
    expect(lessonFor({ id: "2", name: "Noma'lum narsa" })).toBeNull();
  });
});
