// New internet leads (Instagram, Facebook, the site form) go to the
// managers in turn (the owner, 2026-11-13: «navbat bilan»). Whoever checked
// in today and hasn't checked out is preferred; when nobody is at work
// (night, a day off) the turn goes on among everyone, so the lead is
// someone's first thing in the morning. LEAD_ROUND_ROBIN=off turns it off.
const ON = process.env.LEAD_ROUND_ROBIN !== "off";
const TZ = 5 * 3600e3;

// Who can take leads: the same rule as the app's seller list (linked to
// Managerlar, or allowed to edit leads), active, and not an admin account
// that isn't a seller.
function pool(staff) {
  return staff
    .filter((s) => s.active !== false && (s.report_manager_id || (s.permissions && s.permissions.leads && s.permissions.leads.edit)))
    .filter((s) => !(s.role === "admin" && !s.report_manager_id))
    .map((s) => ({ email: String(s.id || s.email || "").toLowerCase(), name: s.full_name || s.id || s.email }))
    .filter((s) => s.email);
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
