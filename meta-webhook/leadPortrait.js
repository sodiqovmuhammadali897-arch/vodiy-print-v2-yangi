// Fills the portrait (leadText.js leadFields) onto the Meta form leads that
// came in before it existed (owner, 2026-11-26: «ha, eskilarni ham
// to'ldir»). Runs once after a deploy: every meta_leads/{leadgenId} is read
// back from Meta (field_data), matched to its ERP lead (meta_leads.lead_id,
// else the phone's last 9 digits among the form leads) and only EMPTY fields
// are filled — nothing a manager typed is overwritten. The result (counts
// only) is kept in crm_meta/portrait_backfill, so it never runs twice.
const { leadFields } = require("./leadText");

const digits = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const FORM_SOURCES = new Set(["Facebook Lead Ads", "Instagram Target"]);
const blank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);

// The changes for one ERP lead: blanks only; a «Noma'lum» name counts as blank.
function fillBlanks(lead, portrait) {
  const patch = {};
  for (const [k, v] of Object.entries(portrait)) {
    if (blank(v) || k === "phone") continue;
    if (k === "full_name") {
      if (blank(lead.full_name) || lead.full_name === "Noma'lum") patch.full_name = v;
    } else if (blank(lead[k])) patch[k] = v;
  }
  return patch;
}

async function backfill(db, { fetchLead, questionsOf, productTypes = [], log = console, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const flagRef = db.collection("crm_meta").doc("portrait_backfill");
  const flag = await flagRef.get();
  if (flag.exists && flag.data().done_at) return null;

  const [metaSnap, leadSnap] = await Promise.all([db.collection("meta_leads").get(), db.collection("leads").get()]);
  const leads = leadSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const byId = new Map(leads.map((l) => [l.id, l]));
  const byPhone = new Map();
  for (const l of leads) {
    if (!FORM_SOURCES.has(l.source)) continue;
    const k = digits(l.phone);
    if (k && !byPhone.has(k)) byPhone.set(k, l);
  }

  const n = { meta: metaSnap.size, filled: 0, already: 0, unmatched: 0, unreadable: 0, nothing: 0 };
  for (const doc of metaSnap.docs) {
    let lead;
    try {
      lead = await fetchLead(doc.id);
    } catch {
      lead = null;
    }
    await wait(250);
    if (!lead || lead.error || !Array.isArray(lead.field_data)) {
      n.unreadable++;
      continue;
    }
    const portrait = leadFields(lead.field_data, await questionsOf(lead.form_id || doc.data().form_id), productTypes);
    const phone = (lead.field_data.find((f) => /phone/i.test(f.name || "")) || { values: [] }).values[0] || portrait.phone;
    const erp = byId.get(doc.data().lead_id) || byPhone.get(digits(phone));
    if (!erp) {
      n.unmatched++;
      continue;
    }
    if (!blank(erp.form_answers)) {
      n.already++;
      continue;
    }
    const patch = fillBlanks(erp, portrait);
    if (!Object.keys(patch).length) {
      n.nothing++;
      continue;
    }
    await db.collection("leads").doc(erp.id).update({ ...patch, updated_at: new Date().toISOString() });
    erp.form_answers = patch.form_answers;
    await doc.ref.set({ lead_id: erp.id }, { merge: true });
    n.filled++;
  }
  await flagRef.set({ ...n, done_at: new Date().toISOString() });
  log.log(`Lead portrait backfill: ${JSON.stringify(n)}`);
  return n;
}

module.exports = { backfill, fillBlanks };
