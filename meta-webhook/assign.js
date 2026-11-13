// New internet leads (Instagram, Facebook, the site form) go to the
// managers in turn (the owner, 2026-11-13: «navbat bilan»). Whoever checked
// in today and hasn't checked out is preferred; when nobody is at work
// (night, a day off) the turn goes on among everyone, so the lead is
// someone's first thing in the morning. LEAD_ROUND_ROBIN=off turns it off.
const ON = process.env.LEAD_ROUND_ROBIN !== "off";
const TZ = 5 * 3600e3;

// Who takes leads: the names in LEAD_MANAGERS (a GitHub Variable, else
// RECALL_MANAGERS, else Muhammadiyor, Maryam, Nuriddin), matched to active
// staff by first name — «Muhammadiyor» and «Muhammaddiyor» are the same.
// (A rule by permissions took in a test account and the production
// manager, 2026-11-13.)
const DEFAULT_NAMES = "Muhammadiyor,Maryam,Nuriddin";
const normName = (s) => String(s || "").toLowerCase().replace(/[^a-zа-яё]/g, "").replace(/(.)\1+/g, "$1");
const firstName = (s) => normName(String(s || "").trim().split(/\s+/)[0]);
function pool(staff, names = process.env.LEAD_MANAGERS || process.env.RECALL_MANAGERS || DEFAULT_NAMES) {
  const out = [];
  for (const want of String(names).split(",").map(firstName).filter(Boolean)) {
    const hits = staff.filter((s) => s.active !== false && s.is_active !== false && firstName(s.full_name) === want);
    const s = hits.find((x) => x.report_manager_id) || hits[0];
    if (!s) continue;
    const email = String(s.id || s.email || "").toLowerCase();
    if (email && !out.some((o) => o.email === email)) out.push({ email, name: s.full_name || email });
  }
  return out;
}

// The next seller after `last`, in a fixed order (by e-mail).
function pickNext(sellers, last, atWork = new Set()) {
  if (!sellers.length) return null;
  const sorted = [...sellers].sort((a, b) => a.email.localeCompare(b.email));
  const present = sorted.filter((s) => atWork.has(s.email));
  const list = present.length ? present : sorted;
  return list.find((s) => s.email > String(last || "")) || list[0];
}

// Picks the next seller and moves the turn on. Returns {email, name} or null.
async function assignNext(db, now = Date.now()) {
  if (!ON) return null;
  const staff = (await db.collection("staff").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const sellers = pool(staff);
  if (!sellers.length) return null;
  const today = new Date(now + TZ).toISOString().slice(0, 10);
  const att = (await db.collection("attendance").where("dateCode", "==", today).get()).docs.map((d) => d.data());
  const atWork = new Set(att.filter((r) => r.checkInTime && !r.checkOutTime).map((r) => String(r.employeeId || "").toLowerCase()));
  const ref = db.collection("crm_meta").doc("assign");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = pickNext(sellers, snap.exists ? snap.data().last_email : "", atWork);
    if (next) tx.set(ref, { last_email: next.email, last_name: next.name, updated_at: new Date(now).toISOString() }, { merge: true });
    return next;
  });
}

module.exports = { ON, pool, pickNext, assignNext };
