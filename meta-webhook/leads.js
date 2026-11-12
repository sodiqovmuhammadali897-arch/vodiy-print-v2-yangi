// Lead helpers shared by every channel that creates leads on the VPS:
// Meta Lead Ads and Mois Zvonki calls (server.js) and Instagram Direct
// (instagram.js). The document shape mirrors src/lib/types.ts's Lead.

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Strips everything but digits so "+998 90 123 45 67", "998901234567"
// and "90 123 45 67" all compare equal — mirrors src/lib/format.ts's
// normalizePhone (this service can't import frontend TS directly).
const normalizePhone = (phone) => (phone || "").replace(/\D/g, "").slice(-9);

const nextLeadNumber = async (db) => {
  const snap = await db.collection("leads").get();
  let max = 0;
  snap.forEach((doc) => {
    const m = /^LID-(\d+)$/.exec(doc.data().lead_number || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `LID-${String(max + 1).padStart(3, "0")}`;
};

const findByPhone = async (db, collection, phone) => {
  const target = normalizePhone(phone);
  if (!target) return null;
  const snap = await db.collection(collection).get();
  let found = null;
  snap.forEach((doc) => {
    if (found) return;
    if (normalizePhone(doc.data().phone) === target) found = { id: doc.id, ...doc.data() };
  });
  return found;
};

const blankLead = (now) => ({
  full_name: "Noma'lum",
  brand: "",
  phone: "",
  telegram: "",
  interested_product_id: "",
  interested_product_name: "",
  source: "",
  campaign_name: "",
  campaign_id: "",
  ad_set_name: "",
  ad_set_id: "",
  ad_name: "",
  ad_id: "",
  form_name: "",
  form_id: "",
  assigned_to_email: "",
  assigned_to_name: "",
  status: "new",
  region: "",
  industry: "",
  estimated_amount: 0,
  next_contact_at: null,
  first_contact_at: null,
  last_contact_at: null,
  note: "",
  lost_reason: "",
  lost_comment: "",
  converted_customer_id: null,
  converted_order_id: null,
  created_at: now,
  updated_at: now,
});

// The ERP's CRM (2026-11-12): the Meta form webhook, the Instagram agent
// and the site form open ERP leads again (managers still get their
// Telegram messages as before). ERP_LEADS=off stops it.
const ERP_LEADS_ON = process.env.ERP_LEADS !== "off";

// Tashkent date and HH:MM `minutes` from now.
const dueIn = (minutes, now = Date.now()) => {
  const t = new Date(now + minutes * 60e3 + 5 * 3600e3).toISOString();
  return { due_date: t.slice(0, 10), due_time: t.slice(11, 16) };
};

// Every new lead gets its first task — a call within `minutes` — and a
// timeline line saying where it came from («har bir lid javobsiz qolmasin»).
const startLead = async (db, lead, { text, minutes = 15, type = "call", note = "Yangi lid — qo'ng'iroq qiling", actor = "Tizim" }) => {
  const now = new Date().toISOString();
  await db.collection("lead_activities").add({ lead_id: lead.id, text, actor_email: "system", actor_name: actor, created_at: now });
  const due = dueIn(minutes);
  await db.collection("lead_tasks").add({
    lead_id: lead.id,
    lead_name: lead.full_name || "",
    type,
    ...due,
    assigned_to_email: lead.assigned_to_email || "",
    assigned_to_name: lead.assigned_to_name || "",
    note,
    status: "open",
    completed_at: null,
    created_at: now,
  });
};

// Creates a lead with the next LID number and registers its source so it
// shows up in the Sotuv bo'limi filters. Returns { id, lead_number }.
const createLead = async (db, fields, sourceId = fields.source ? slugify(fields.source) : "") => {
  const now = new Date().toISOString();
  const lead_number = await nextLeadNumber(db);
  const ref = await db.collection("leads").add({ ...blankLead(now), ...fields, lead_number });
  if (sourceId) {
    await db.collection("lead_sources").doc(sourceId).set({ name: fields.source }, { merge: true });
  }
  return { id: ref.id, lead_number };
};

module.exports = { ERP_LEADS_ON, slugify, normalizePhone, nextLeadNumber, findByPhone, blankLead, createLead, startLead, dueIn };
