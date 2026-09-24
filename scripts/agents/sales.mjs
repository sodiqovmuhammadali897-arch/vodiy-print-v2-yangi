// "Sotuv nazoratchisi": leads nobody has answered, overdue follow-ups,
// missed calls never called back, lost leads and conversion per manager.
import {
  Report,
  bullets,
  countBy,
  dayCodeOf,
  dayCodeOffset,
  esc,
  getDb,
  hoursSince,
  readAll,
  todayCode,
  yEnd,
  yStart,
} from "./lib.mjs";

const r = new Report("💼 Sotuv nazoratchisi — kunlik hisobot");
const OPEN_STAGES = new Set(["new", "info_given", "telegram"]);
const inYesterday = (iso) => !!iso && iso >= yStart && iso < yEnd;
const who = (name) => esc(name || "biriktirilmagan");

if (!getDb()) {
  r.sections.push(r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan"));
  await r.send("TELEGRAM_SALES_CHAT_ID");
  process.exit(0);
}

const [leads, tasks, allCalls] = await Promise.all([readAll("leads"), readAll("lead_tasks"), readAll("calls")]);
// Phones are stored in whatever shape they were typed ("+998 97 625 13 13"
// vs "+998976251313"); the last 9 digits identify a Uzbek number.
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-9);
// A lead created from a phone call looks untouched in the pipeline
// (status "new", no first_contact_at) even when that call was answered —
// an answered or outgoing call to its number counts as contact.
const talkedTo = new Set(allCalls.filter((c) => c.answered || c.direction === "out").map((c) => phoneKey(c.phone)).filter(Boolean));
const leadName = (l) => (l.full_name && !l.full_name.startsWith("Noma'lum") ? esc(l.full_name) : esc(l.phone || l.full_name));

await r.section("📥 Kechagi lidlar", async () => {
  const fresh = leads.filter((l) => inYesterday(l.created_at));
  if (fresh.length === 0) return ["• Kecha yangi lid kelmadi"];
  const bySource = countBy(fresh, (l) => l.source || "Noma'lum")
    .slice(0, 4)
    .map(([k, n]) => `${esc(k)} ${n}`)
    .join(", ");
  const byManager = countBy(fresh, (l) => l.assigned_to_name || "biriktirilmagan")
    .map(([k, n]) => `${esc(k)} ${n}`)
    .join(", ");
  return [`• Jami: ${fresh.length} ta — ${bySource}`, `• Menejerlar: ${byManager}`];
});

await r.section("⏰ Javobsiz lidlar", async () => {
  // Still "new" and never contacted, older than 24h — "har bir lid
  // javobsiz qolmasin".
  const stale = leads
    .filter((l) => l.status === "new" && !l.first_contact_at && hoursSince(l.created_at) >= 24 && !talkedTo.has(phoneKey(l.phone)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const stuckInNew = leads.filter(
    (l) => l.status === "new" && !l.first_contact_at && hoursSince(l.created_at) >= 24 && talkedTo.has(phoneKey(l.phone)),
  );
  const unassigned = leads.filter((l) => OPEN_STAGES.has(l.status) && !l.assigned_to_email);
  const lines = [];
  if (stale.length === 0) lines.push(r.ok("24 soatdan ortiq javobsiz qolgan lid yo'q"));
  else {
    lines.push(r.fail(`${stale.length} ta lid bilan 24 soatdan beri hech kim bog'lanmagan:`));
    lines.push(
      ...bullets(stale, 6, (l) => `${esc(l.lead_number || "")} ${leadName(l)} — ${who(l.assigned_to_name)}, ${Math.floor(hoursSince(l.created_at) / 24)} kun`),
    );
  }
  if (stuckInNew.length > 0) {
    lines.push(r.warn(`${stuckInNew.length} ta lid bilan telefonda gaplashilgan, lekin hali "Yangi lid" ustunida turibdi`));
  }
  if (unassigned.length > 0) lines.push(r.warn(`${unassigned.length} ta faol lid hech kimga biriktirilmagan`));
  return lines;
});

await r.section("📋 Vazifalar", async () => {
  const open = tasks.filter((t) => t.status === "open");
  const overdue = open.filter((t) => t.due_date && t.due_date < todayCode);
  const dueToday = open.filter((t) => t.due_date === todayCode);
  const lines = [];
  if (overdue.length === 0) lines.push(r.ok("Muddati o'tgan vazifa yo'q"));
  else {
    const perManager = countBy(overdue, (t) => t.assigned_to_name || "biriktirilmagan")
      .map(([k, n]) => `${esc(k)} ${n}`)
      .join(", ");
    lines.push(r.warn(`Muddati o'tgan vazifalar: ${overdue.length} ta (${perManager})`));
  }
  // Leads whose promised call-back date has passed with no newer contact.
  const missedFollowUp = leads.filter(
    (l) =>
      OPEN_STAGES.has(l.status) &&
      l.next_contact_at &&
      dayCodeOf(l.next_contact_at) < todayCode &&
      (!l.last_contact_at || l.last_contact_at < l.next_contact_at),
  );
  if (missedFollowUp.length > 0) lines.push(r.warn(`Qayta bog'lanish sanasi o'tib ketgan lidlar: ${missedFollowUp.length} ta`));
  if (dueToday.length > 0) {
    const perManager = countBy(dueToday, (t) => t.assigned_to_name || "biriktirilmagan")
      .map(([k, n]) => `${esc(k)} ${n}`)
      .join(", ");
    lines.push(`• Bugungi vazifalar: ${dueToday.length} ta (${perManager})`);
  }
  return lines;
});

await r.section("📞 Javobsiz qo'ng'iroqlar", async () => {
  // Incoming calls nobody picked up yesterday, and whether anyone has
  // called or been called by that number since.
  const calls = allCalls.filter((c) => c.created_at >= yStart);
  const missed = calls.filter((c) => c.direction === "in" && !c.answered && inYesterday(c.created_at) && c.phone);
  const missedPhones = new Map();
  for (const c of missed) if (!missedPhones.has(c.phone) || c.created_at > missedPhones.get(c.phone).created_at) missedPhones.set(c.phone, c);
  const notCalledBack = [...missedPhones.values()].filter(
    (m) => !calls.some((c) => c.phone === m.phone && c.created_at > m.created_at && (c.direction === "out" || c.answered)),
  );
  if (missed.length === 0) return [r.ok("Kecha javobsiz kiruvchi qo'ng'iroq bo'lmagan")];
  const lines = [`• Kecha javobsiz kiruvchi: ${missed.length} ta (${missedPhones.size} ta raqam)`];
  if (notCalledBack.length === 0) lines.push(r.ok("Hammasiga qayta qo'ng'iroq qilingan"));
  else {
    lines.push(r.fail(`${notCalledBack.length} ta raqamga hali qayta qo'ng'iroq qilinmagan:`));
    lines.push(...bullets(notCalledBack, 6, (c) => `${esc(c.phone)}${c.client_name ? ` (${esc(c.client_name)})` : ""}`));
  }
  return lines;
});

await r.section("❌ Yo'qotilgan lidlar (kecha)", async () => {
  const lost = leads.filter((l) => l.status === "lost" && inYesterday(l.updated_at));
  if (lost.length === 0) return ["• Kecha yo'qotilgan lid yo'q"];
  const reasons = countBy(lost, (l) => l.lost_reason || "Sabab ko'rsatilmagan")
    .map(([k, n]) => `${esc(k)} ${n}`)
    .join(", ");
  return [`• ${lost.length} ta: ${reasons}`];
});

await r.section("🎯 Konversiya (oxirgi 30 kun)", async () => {
  const since = dayCodeOffset(-30);
  const recent = leads.filter((l) => dayCodeOf(l.created_at) >= since);
  if (recent.length === 0) return ["• Oxirgi 30 kunda lid yo'q"];
  const rows = countBy(recent, (l) => l.assigned_to_name || "biriktirilmagan").map(([name, total]) => {
    const mine = recent.filter((l) => (l.assigned_to_name || "biriktirilmagan") === name);
    const won = mine.filter((l) => l.converted_order_id).length;
    const lost = mine.filter((l) => l.status === "lost").length;
    return `   – ${esc(name)}: ${total} lid → ${won} buyurtma (${Math.round((won / total) * 100)}%), ${lost} yo'qotilgan`;
  });
  const won = recent.filter((l) => l.converted_order_id).length;
  return [`• Jami: ${recent.length} lid → ${won} buyurtma (${Math.round((won / recent.length) * 100)}%)`, ...rows];
});

await r.send("TELEGRAM_SALES_CHAT_ID");
