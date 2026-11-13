import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const T = require("../meta-webhook/targetolog");

describe("Reklama hisoboti", () => {
  it("counts a form lead once, chats on top", () => {
    const a = [
      { action_type: "lead", value: "4" },
      { action_type: "leadgen_grouped", value: "4" },
      { action_type: "onsite_conversion.lead_grouped", value: "4" },
      { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" },
      { action_type: "link_click", value: "90" },
    ];
    expect(T.resultsOf(a)).toEqual({ leads: 4, chats: 2, results: 6 });
    expect(T.resultsOf([])).toEqual({ leads: 0, chats: 0, results: 0 });
  });
  it("adds up each ad and puts the best first", () => {
    const rows = [
      { ad_id: "1", ad_name: "Paket video", spend: "5.00", actions: [{ action_type: "lead", value: "5" }] },
      { ad_id: "2", ad_name: "Futbolka rasm", spend: "3.00", actions: [] },
      { ad_id: "3", ad_name: "Bloknot video", spend: "2.00", actions: [{ action_type: "lead", value: "1" }] },
      { ad_id: "4", ad_name: "To'xtagan", spend: "0", actions: [] },
      { ad_id: "5", ad_name: "Paket video ", spend: "1.00", actions: [{ action_type: "lead", value: "1" }] },
    ];
    const s = T.adStats(rows, 12800, new Set(["1", "3"]));
    expect(s.map((a: { name: string }) => a.name)).toEqual(["Paket video", "Bloknot video", "Futbolka rasm"]);
    expect(s[0]).toMatchObject({ spend: 76800, usd: 6, leads: 6, cpl: 12800, video: true }); // two ads, one video
    expect(s[2]).toMatchObject({ leads: 0, cpl: null, video: false });
  });
  it("writes the 10:00 message", () => {
    const adsY = T.adStats([{ ad_id: "1", ad_name: "Paket video", spend: "5", actions: [{ action_type: "lead", value: "5" }] }], 12800, new Set(["1"]));
    const text = T.reportText({ summary: { yesterday: { spend: 64000 }, month: { spend: 640000 } }, adsY, adsM: adsY, yDay: "2026-11-12", erp: 4 });
    expect(text).toContain("📊 Reklama hisoboti — 12.11");
    expect(text).toContain("5 lid · bitta lid 12 800 so'm");
    expect(text).toContain("($5.00)");
    expect(text).toContain("🎬 Paket video — 5 lid · 12 800 so'mdan · 64 000 so'm");
    expect(text).toContain("ERP'ga tushgan Facebook lidlari: 4");
    expect(text).not.toContain("\n\n\n");
    const idle = T.reportText({ summary: { yesterday: { spend: 1000 }, month: { spend: 1000 } }, adsY: T.adStats([{ ad_id: "9", ad_name: "X", spend: "0.1", actions: [] }], 10000), adsM: [], yDay: "2026-11-12" });
    expect(idle).toContain("⚪ Lidsiz: 1 ta reklama · 1 000 so'm");
  });
});
