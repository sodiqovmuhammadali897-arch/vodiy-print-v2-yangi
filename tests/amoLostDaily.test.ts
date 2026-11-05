import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const L = require("../meta-webhook/amoLost");

const at = (s: string) => Date.parse(`${s}+05:00`);
const lead = (id: number, closed: string, loss: string | null, extra = {}) => ({ id, name: `Bitim ${id}`, status: 143, closed: at(closed), user: 7, price: 1_000_000, loss, ...extra });
const statuses = { "1:10": { name: "Қабул Қилинди", sort: 10 }, "1:20": { name: "маълумот берилди", sort: 20 }, "1:30": { name: "Таклиф Юборилди", sort: 30 }, "1:143": { name: "Муваффақиятсиз", sort: 1000 } };

describe("Yutqazilganlar (server)", () => {
  it("groups the reasons the managers pick", () => {
    expect(["Нарх қиммат", "Рақобатчи танланди", "Алоқа йўқ", "Хато рақам", "Ишхона рақами", "Буюртма бекор бўлди", "Тахи", "", null].map(L.groupOf)).toEqual([
      "price", "competitor", "no_answer", "wrong_number", "wrong_number", "cancelled", "other", "none", "none",
    ]);
  });

  it("keeps lost deals by day with the stage they reached", () => {
    const leads = [
      lead(1, "2026-11-05T11:00:00", "Нарх қиммат", { price: 2_400_000 }),
      lead(2, "2026-11-05T12:00:00", "Алоқа йўқ", { price: 0 }),
      lead(3, "2026-11-04T09:00:00", "Рақобатчи танланди"),
      lead(4, "2026-11-05T10:00:00", null, { status: 142 }), // won
      lead(5, "2026-06-30T10:00:00", "Нарх қиммат"), // before the start
    ];
    const history = new Map([[1, new Set(["1:10", "1:30", "1:143"])]]);
    const items = L.lostItems(leads, { fromMs: at("2026-07-01T00:00:00"), history, statuses, nameOf: () => "Nuriddin" });
    expect(items.map((x: { id: number }) => x.id)).toEqual([2, 1, 3]);
    expect(items.find((x: { id: number }) => x.id === 1)).toMatchObject({ stage: "Таклиф Юборилди", group: "price", manager: "Nuriddin", day: "2026-11-05" });
    const docs = L.dayDocs(items);
    expect(docs.get("2026-11-05")).toMatchObject({ total: 2, sum: 2_400_000, counts: { price: 1, no_answer: 1 } });
    expect(docs.get("2026-11-05").items[0].id).toBe(1); // biggest sum first
  });

  it("writes the 19:00 message", () => {
    const items = L.lostItems(
      [
        lead(1, "2026-11-05T11:00:00", "Нарх қиммат", { price: 2_400_000, name: "Futbolka 300" }),
        lead(2, "2026-11-05T12:00:00", "Рақобатчи танланди", { price: 900_000, user: 8 }),
        lead(3, "2026-11-05T13:00:00", "Алоқа йўқ", { price: 0 }),
        lead(4, "2026-11-05T14:00:00", null, { price: 0 }),
      ],
      { nameOf: (u: number) => (u === 8 ? "Maryam" : "Nuriddin") },
    );
    const text = L.dailyText("2026-11-05", items, items);
    expect(text).toContain("📉 Bugun yutqazilganlar — 5-noyabr");
    expect(text).toContain("Jami: 4 ta bitim · 3,3 mln so'm");
    expect(text).toContain("💸 Нарх қиммат — 1  (2,4 mln)");
    expect(text).toContain("🏁 Рақобатчи танланди — 1  (0,9 mln)");
    expect(text).toContain("❓ Sabab tanlanmagan — 1");
    expect(text).toContain("Nuriddin — 3 (qimmat 1)");
    expect(text).toContain("Maryam — 1 (raqobatchi 1)");
    expect(text).toContain("1. Futbolka 300 — 2,4 mln · Nuriddin · 💸");
    expect(text).toContain("Oy boshidan: 4 ta · qimmat 25% · raqobatchi 25%");
    expect(L.dailyText("2026-11-05", [], items)).toBeNull();
  });
});
