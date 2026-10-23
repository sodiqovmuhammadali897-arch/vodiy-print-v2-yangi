import { describe, expect, it } from "vitest";
import { guideFor, kindOf, toLines, whoBuys } from "../src/lib/salesGuide";

const p = (name: string, category = "Poligrafiya", extra = {}) => ({ name, category, advantages: [] as string[], ...extra });

describe("sales guide", () => {
  it("finds a product's kind by its name", () => {
    const k = (name: string) => kindOf(p(name)).key;
    expect(k("Paket A4")).toBe("paket");
    expect(k("Flayer (99x210)")).toBe("flayer");
    expect(k("Liflet A5")).toBe("flayer");
    expect(k("Futbolka (BASICO) XS-S-M")).toBe("kiyim");
    expect(k("YOZ KOMBO (AMINA FUTBOLKA+KEPKA)")).toBe("kiyim");
    expect(k("Kepka oddiy (OQ/QORA)")).toBe("kepka");
    expect(k("Beydjik LENTA (2 ta temirli)")).toBe("beydjik");
    expect(k("Premium gift box")).toBe("sovga");
    expect(k("Standart set")).toBe("sovga");
    expect(k("Koja bloknot 0020")).toBe("bloknot");
    expect(k("Softouch bakal")).toBe("idish");
    expect(k("Parus bayroq M razmeri")).toBe("bayroq");
    expect(k("Noma'lum narsa")).toBe("boshqa");
  });

  it("uses the product's own text, else the suggestion", () => {
    const g = guideFor(p("Paket A4"));
    expect(g.spinSuggested && g.uspSuggested).toBe(true);
    expect(g.spin.s.length).toBeGreaterThan(0);
    const own = guideFor(p("Paket A4", "Poligrafiya", { advantages: ["O'zimizniki"], spin: { s: ["Savol?"], p: [], i: [], n: [] } }));
    expect(own).toMatchObject({ spinSuggested: false, uspSuggested: false, usp: ["O'zimizniki"] });
    expect(own.spin).toEqual({ s: ["Savol?"], p: [], i: [], n: [] });
  });

  it("counts who buys a product", () => {
    const orders = [
      { id: "o1", customer_id: "a", order_date: "2025-12-03", created_at: "", status: "closed" },
      { id: "o2", customer_id: "a", order_date: "2026-08-10", created_at: "", status: "closed" },
      { id: "o3", customer_id: "b", order_date: "2026-08-20", created_at: "", status: "new" },
      { id: "o4", customer_id: "c", order_date: "2026-09-01", created_at: "", status: "cancelled" },
    ];
    const lines = [
      { order_id: "o1", quantity: 200, total: 2_260_000 },
      { order_id: "o2", quantity: 500, total: 4_350_000 },
      { order_id: "o3", quantity: 100, total: 1_520_000 },
      { order_id: "o4", quantity: 900, total: 9_000_000 },
    ];
    const w = whoBuys(lines, orders as never);
    expect(w).toMatchObject({ orders: 3, customers: 2, repeatCustomers: 1, typicalQty: 200, avgSum: 2_710_000 });
    expect(w.months[11]).toBe(1);
    expect(w.months[7]).toBe(2);
    expect(w.top.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("turns a text area into a list", () => {
    expect(toLines("• Birinchi\n\n- Ikkinchi \n  Uchinchi")).toEqual(["Birinchi", "Ikkinchi", "Uchinchi"]);
  });
});
