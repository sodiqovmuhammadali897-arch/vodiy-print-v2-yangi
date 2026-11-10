// Tushlik (abet) eslatmasi — the owner's request, 2026-11-10. Run by the
// HR agent (hr.js) on working days at the lunch break of the general
// schedule (work_schedules/default breakStart / breakEnd, set on the
// Davomat page):
//   • at the start — "Ism, tushlik (abet) vaqti bo'ldi! 12:00 dan 13:00
//     gacha. 13:00 da ishxonada bo'lamiz";
//   • at the end — "abet vaqti tugadi" with a «✅ Ishxonadaman» button; the
//     press is kept in lunch_breaks/{day}_{email} and the message turns
//     into "12:58 da ishxonaga qaytdingiz";
//   • 15 minutes later — the admins get who came back and who hasn't
//     pressed yet.
// Only people who checked in today and haven't checked out get it, and
// only on Telegram (no SMS for this).

const firstName = (s) => String(s.full_name || s.email || "").trim().split(/\s+/)[0];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const SUMMARY_AFTER_MIN = 15;

const startText = (s, from, to) => `🍽 ${firstName(s)}, tushlik (abet) vaqti bo'ldi!\n${from} dan ${to} gacha.\n${to} da ishxonada bo'lamiz 🙂`;
const endText = (s) => `⏰ ${firstName(s)}, abet vaqti tugadi.\nIshga qaytdingizmi? Tugmani bosing.`;
const backText = (s, hm) => `⏰ ${firstName(s)}, abet vaqti tugadi.\n✅ ${hm} da ishxonaga qaytdingiz. Rahmat!`;
const button = (id) => ({ inline_keyboard: [[{ text: "✅ Ishxonadaman", callback_data: `ln:${id}` }]] });
// Firestore doc id: the day and the email, made safe.
const docId = (day, email) => `${day}_${String(email).toLowerCase().replace(/[^a-z0-9._-]/g, "_")}`.slice(0, 200);

// Who gets the reminder: staff with Telegram, reminders not switched off,
// not on their day off or on leave, checked in today and not checked out.
function recipients({ staff, attendance, onLeave, weekday, offDaysOf }) {
  const open = new Set(attendance.filter((r) => r.checkInTime && !r.checkOutTime).map((r) => String(r.employeeId || "").toLowerCase()));
  return staff.filter((s) => {
    const email = String(s.email || "").toLowerCase();
    return s.telegram_chat_id && s.attendance_notify !== false && s.active !== false && open.has(email) && !onLeave.has(email) && !offDaysOf(email).includes(weekday);
  });
}

// The admins' note: who pressed «Ishxonadaman», who hasn't yet.
function summaryText(day, rows) {
  if (!rows.length) return null;
  const back = rows.filter((r) => r.back_at_hm).sort((a, b) => a.back_at_hm.localeCompare(b.back_at_hm));
  const waiting = rows.filter((r) => !r.back_at_hm);
  const lines = [`🍽 Tushlikdan qaytish — ${dayLabel(day)}`, `✅ Qaytdi: ${back.length} / ${rows.length}`];
  if (back.length) lines.push(back.map((r) => `${r.name} ${r.back_at_hm}`).join(" · "));
  if (waiting.length) lines.push(`⏳ Hali bosmagan: ${waiting.map((r) => r.name).join(", ")}`);
  return lines.join("\n");
}

module.exports = { startText, endText, backText, button, docId, recipients, summaryText, firstName, SUMMARY_AFTER_MIN };
