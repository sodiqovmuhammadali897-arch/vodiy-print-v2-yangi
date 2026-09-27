import { describe, expect, it } from "vitest";
import { formatPhone, mapPaymentType, parseWorkbook, toDay, type Cell } from "../src/lib/excelImport";

const HEADER: Cell[] = [
  "ID", "Qayerga", "Sana", "Ism", "Familiya", "Nomer-1", "Nomer-2", "Telegram", "Viloyat", "Logistika kelishuvi", "Brend",
  "Mahsulot ", "Siryo komentariya", "Ish komentariya", "Soni", "Yaqin narxi", "Dona narxi", "Chegirma", "Jami summa", "Avans",
  "Qoldiq", "To'lov turi", "Check", "Srok", "Qolgan vaqti", "Qaysi vaqtga", "Dizayn Fayl", "Dizayn rasmi", "Dizayner",
  "Jarayon", "Kimga berildi",
];
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (over: Partial<Record<string, Cell>>): Cell[] => {
  const base: Record<string, Cell> = {
    ID: "Far001", Qayerga: "Poligrafiya", Sana: d("2025-11-24"), Ism: "Bunyod", Familiya: "Bahromov", "Nomer-1": 905700103,
    Telegram: "https://t.me/x", Viloyat: "Farg'ona", Brend: "Muxtasham BINO", "Mahsulot ": "Paket A4", Soni: 200,
    "Dona narxi": 11303.2, Chegirma: -867, "Jami summa": 2434040, Avans: 1800000, "To'lov turi": "Karta Farg'ona",
    "Dizayn Fayl": "https://t.me/c/1/2", Jarayon: "Tayyor", "Kimga berildi": "Kans print",
  };
  const merged = { ...base, ...over };
  return HEADER.map((h) => merged[String(h)] ?? null);
};

describe("excel import parser", () => {
  it("normalises phones, dates and payment types", () => {
    expect(formatPhone(998903035603)).toBe("+998 90 303 56 03");
    expect(formatPhone(910777707.0)).toBe("+998 91 077 77 07");
    expect(formatPhone(" 90 196 12 02")).toBe("+998 90 196 12 02");
    expect(formatPhone("12345")).toBe("");
    expect(formatPhone("999 91 282 23 23")).toBe("+998 91 282 23 23");
    expect(toDay(d("2025-11-21"))).toBe("2025-11-21");
    expect(toDay("05.03.2026")).toBe("2026-03-05");
    expect(toDay(45982)).toBe("2025-11-21");
    expect(mapPaymentType("Naqd Namangan")).toBe("Naqd");
    expect(mapPaymentType("Karta Farg'ona")).toBe("Karta");
    expect(mapPaymentType("YaTT Namangan")).toBe("Hisob raqam");
  });

  it("groups one customer's rows on one day into a single order", () => {
    const parsed = parseWorkbook([
      {
        sheet: "Buyurtmalar",
        data: [
          HEADER,
          row({}),
          row({ ID: "Far002", "Mahsulot ": "Ruchka standart", Soni: 200, "Jami summa": 1000000, Avans: null, Qayerga: "Tipografiya" }),
          row({ ID: "Far003", Sana: d("2025-12-01"), "Mahsulot ": "Krujka", "Jami summa": 500000, Avans: 0 }),
          row({ ID: "Far004", Sana: d("2025-12-01"), "Mahsulot ": "Kubarik A6", Soni: 20, "Jami summa": 0, Avans: 0 }),
          row({ ID: "Nam001", Ism: "Aziz", Familiya: null, "Nomer-1": null, "Mahsulot ": "Vizitka", Soni: 1000, "Jami summa": 300000, "To'lov turi": "YaTT Namangan", Brend: "Aziz LLC" }),
          [null, null, null],
          row({ ID: "Bad1", Sana: null }),
          row({ ID: "Bad2", Soni: null, "Jami summa": null }),
        ],
      },
      { sheet: "Filter ishchilar", data: [[], [], HEADER, row({ ID: "Dup" })] },
    ]);
    expect(parsed.orders_sheet).toBe("Buyurtmalar");
    expect(parsed.orders).toHaveLength(3);
    const first = parsed.orders[0];
    expect(first.refs).toEqual(["Far001", "Far002"]);
    expect(first.lines).toHaveLength(2);
    expect(first.total).toBe(3434040);
    expect(first.advance).toBe(1800000);
    expect(first.payment_type).toBe("Karta");
    expect(first.branch).toBe("Farg'ona");
    expect(first.lines[0].unit_price).toBeCloseTo(12170.2, 1);
    expect(first.lines[0].files).toEqual([{ label: "Dizayn fayl", url: "https://t.me/c/1/2" }]);
    expect(first.lines[1].category).toBe("Tipografiya");

    expect(parsed.customers).toHaveLength(2);
    const bunyod = parsed.customers.find((c) => c.first_name === "Bunyod")!;
    expect(bunyod.phone).toBe("+998 90 570 01 03");
    expect(bunyod.brands).toEqual(["Muxtasham BINO"]);
    const aziz = parsed.customers.find((c) => c.first_name === "Aziz")!;
    expect(aziz.key).toBe("name:aziz");
    expect(parsed.orders.find((o) => o.customer_key === "name:aziz")!.payment_type).toBe("Hisob raqam");

    const bonus = parsed.orders.find((o) => o.refs.includes("Far003"))!;
    expect(bonus.lines.map((l) => [l.product_name, l.total])).toEqual([["Krujka", 500000], ["Kubarik A6", 0]]);
    expect(parsed.problems).toEqual([
      { sheet: "Buyurtmalar", row: 8, reason: "Sana yo'q yoki noto'g'ri" },
      { sheet: "Buyurtmalar", row: 9, reason: "Soni ham, summasi ham yo'q" },
    ]);
    expect(parsed.date_from).toBe("2025-11-24");
    expect(parsed.date_to).toBe("2025-12-01");
  });

  it("reads the catalog blocks with price and cost tiers", () => {
    const parsed = parseWorkbook([
      {
        sheet: "Maxsulotlar",
        data: [
          ["kubarik", "Umumiy tan narx", null, "Sotish narxi", null, null, null, null, null],
          [null, "Donaga", "Jami", "Donaga", "Jami", null, "Maxsulotlar", null, "Katigorya"],
          ["Bayroq 1x1,5", null, null, null, null, null, null, null, "Bayroq 1x1,5"],
          [1, 190000, 190000, 320000, 320000, null, "Bayroq 1x1,5", null, "Beydjik"],
          [10, 145000, 1450000, 202200, 2022000, null, "Bayroq 1x1,5", null, "Buklet A4"],
          [null, null, null, null, null, null, null, null, "Znachok"],
          ["Krujka oddiy", null, null, null, null, null, null, null, "Kalendar"],
          [5, 20000, 100000, 30000, 150000, null, "Krujka oddiy", null, null],
        ],
      },
    ]);
    expect(parsed.catalog_sheet).toBe("Maxsulotlar");
    expect(parsed.products).toEqual([
      { name: "Bayroq 1x1,5", category: "", tiers: [{ min_qty: 1, price: 320000, cost: 190000 }, { min_qty: 10, price: 202200, cost: 145000 }] },
      { name: "Krujka oddiy", category: "", tiers: [{ min_qty: 5, price: 30000, cost: 20000 }] },
    ]);
  });
});
