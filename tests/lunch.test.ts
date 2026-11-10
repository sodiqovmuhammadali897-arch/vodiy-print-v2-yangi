import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const L = require("../meta-webhook/lunch");

const s = (email: string, extra = {}) => ({ email, full_name: `${email.split("@")[0]} Aliyev`, telegram_chat_id: 1, ...extra });

describe("tushlik eslatmasi", () => {
  it("writes the messages with the person's first name", () => {
    expect(L.startText({ full_name: "Muhammadiyor Karimov" }, "12:00", "13:00")).toBe("🍽 Muhammadiyor, tushlik (abet) vaqti bo'ldi!\n12:00 dan 13:00 gacha.\n13:00 da ishxonada bo'lamiz 🙂");
    expect(L.endText({ full_name: "Muhammadiyor" })).toBe("⏰ Muhammadiyor, abet vaqti tugadi.\nIshga qaytdingizmi? Tugmani bosing.");
    expect(L.backText({ full_name: "Muhammadiyor" }, "12:58")).toContain("✅ 12:58 da ishxonaga qaytdingiz");
    expect(L.button("2026-11-10_a_vp.uz").inline_keyboard[0][0]).toEqual({ text: "✅ Ishxonadaman", callback_data: "ln:2026-11-10_a_vp.uz" });
    expect(L.docId("2026-11-10", "Ali+1@VP.uz")).toBe("2026-11-10_ali_1_vp.uz");
  });

  it("sends only to people at work today", () => {
    const staff = [s("a@vp.uz"), s("b@vp.uz"), s("c@vp.uz", { telegram_chat_id: null }), s("d@vp.uz", { attendance_notify: false }), s("e@vp.uz"), s("f@vp.uz"), s("g@vp.uz")];
    const attendance = [
      { employeeId: "A@vp.uz", checkInTime: "08:55" }, // at work
      { employeeId: "b@vp.uz", checkInTime: "09:00", checkOutTime: "11:30" }, // went home
      { employeeId: "c@vp.uz", checkInTime: "09:00" }, // no Telegram
      { employeeId: "d@vp.uz", checkInTime: "09:00" }, // reminders off
      { employeeId: "e@vp.uz", checkInTime: "09:00" }, // on leave
      { employeeId: "f@vp.uz", checkInTime: "09:00" }, // his day off
    ]; // g did not come
    const got = L.recipients({ staff, attendance, onLeave: new Set(["e@vp.uz"]), weekday: 2, offDaysOf: (e: string) => (e === "f@vp.uz" ? [2] : [0]) });
    expect(got.map((x: { email: string }) => x.email)).toEqual(["a@vp.uz"]);
  });

  it("tells the admins who came back", () => {
    expect(L.summaryText("2026-11-10", [])).toBeNull();
    expect(L.summaryText("2026-11-10", [{ name: "Nuriddin", back_at_hm: null }, { name: "Muhammadiyor", back_at_hm: "12:58" }, { name: "Dilmurodjon", back_at_hm: "12:55" }])).toBe(
      "🍽 Tushlikdan qaytish — 10-noyabr\n✅ Qaytdi: 2 / 3\nDilmurodjon 12:55 · Muhammadiyor 12:58\n⏳ Hali bosmagan: Nuriddin",
    );
  });
});
