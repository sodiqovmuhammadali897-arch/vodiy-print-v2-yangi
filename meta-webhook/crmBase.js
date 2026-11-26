// Sotuv bo'limi → «Mijozlar bazasi» (owner, 2026-11-26: «yopilgan, qimmat
// degan hamma lidlar to'planadigan baza … amodagi eski hamma ma'lumotni ol,
// 3000 dan ortiq baza bor»; «managerlar ham umumiyni ko'ra olsin — yana lid
// qoldirsa, boshqa manager gaplashgan bo'lsa tarix ko'rinishi kerak»).
//
// crm_base/{last 9 digits of the phone} = one customer with every closed
// deal of that phone ever: amoCRM's closed deals (won 142 / lost 143,
// imported from the app by the owner — preview then run, progress in
// crm_meta/amo_base) and the ERP's lost leads (synced every 30 min). The
// app shows the base, reopens a customer as a new lead (`reopened`) and
// shows the same history on a lead card of that phone.
// amoCRM is only read. Nothing here goes to GitHub Actions logs.
const { latin, fieldsOf } = require("./amoImport");
const { lossOf } = require("./amocrm");
const { groupOf } = require("./amoLost");

const WON = 142;
const LOST = 143;
const digitsOf = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const iso = (sec) => (Number(sec) > 0 ? new Date(Number(sec) * 1000).toISOString() : "");
// ERP lost reasons that mean «not a customer» — kept out of the base.
const NOT_CUSTOMER = /kontakt \(lid emas\)/i;

// One amoCRM closed deal → a history entry. Pure.
function amoEntry(deal, { user = "", staffEmail = "" } = {}) {
  const f = fieldsOf(deal);
  const won = Number(deal.status_id) === WON;
  const reason = won ? "" : latin(lossOf(deal) || "").trim();
  return {
    key: `amo:${deal.id}`,
    source: "amo",
    status: won ? "won" : "lost",
    reason,
    group: won ? "won" : groupOf(reason),
    closed_at: iso(deal.closed_at || deal.updated_at),
    created_at: iso(deal.created_at),
    manager_name: latin(user),
    manager_email: staffEmail,
    product: (f.product_types || []).join(", "),
    price: Number(deal.price) || 0,
    title: latin(deal.name || "").slice(0, 120),
    amo_id: Number(deal.id),
  };
}

// One ERP lost lead → a history entry. Pure.
function erpEntry(l) {
  const reason = String(l.lost_reason || "");
  return {
    key: `erp:${l.id}`,
    source: "erp",
    status: "lost",
    reason,
    group: groupOf(reason),
    closed_at: l.lost_at || l.updated_at || "",
    created_at: l.created_at || "",
    manager_name: l.assigned_to_name || "",
    manager_email: l.assigned_to_email || "",
    product: (l.product_types || []).join(", ") || l.interested_product_name || "",
    price: Number(l.estimated_amount) || 0,
    title: l.lead_number || "",
    comment: String(l.lost_comment || "").slice(0, 300),
    lead_id: l.id,
  };
}

// The customer's doc: the existing one + new person fields (blanks only) +
// the entries (one per key, newest first). Pure.
function mergeDoc(existing, person, entries, now = new Date().toISOString()) {
  const doc = existing ? { ...existing } : { digits: person.digits, reopened: null, created_at: now };
  for (const k of ["phone", "name", "brand", "region", "industry", "address"]) if (!doc[k] && person[k]) doc[k] = person[k];
  const byKey = new Map((doc.deals || []).map((d) => [d.key, d]));
  for (const e of entries) byKey.set(e.key, { ...(byKey.get(e.key) || {}), ...e });
  doc.deals = [...byKey.values()].sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)));
  const last = doc.deals[0] || {};
  doc.last = { status: last.status || "", reason: last.reason || "", group: last.group || "", closed_at: last.closed_at || "", manager_name: last.manager_name || "", source: last.source || "" };
  doc.lost = doc.deals.filter((d) => d.status === "lost").length;
  doc.won = doc.deals.filter((d) => d.status === "won").length;
  doc.sum = Math.max(0, ...doc.deals.map((d) => d.price || 0));
  doc.updated_at = now;
  return doc;
}

// Closed amoCRM rows ({deal, contact, user, staffEmail}) grouped by phone.
// Pure: what the import will write, and the counts for the preview.
function planAmo(rows) {
  const byPhone = new Map();
  let noPhone = 0;
  for (const r of rows) {
    const d = digitsOf(r.contact && r.contact.phone);
    if (d.length < 9) {
      noPhone++;
      continue;
    }
    const f = fieldsOf(r.deal);
    if (!byPhone.has(d)) byPhone.set(d, { person: { digits: d, phone: r.contact.phone, name: latin(r.contact.name || "").trim(), brand: f.brand || "", region: f.region || "", industry: f.industry || "" }, entries: [] });
    const g = byPhone.get(d);
    for (const k of ["name", "brand", "region", "industry"]) if (!g.person[k]) g.person[k] = k === "name" ? latin(r.contact.name || "").trim() : f[k] || "";
    g.entries.push(amoEntry(r.deal, r));
  }
  const all = rows.length - noPhone;
  const groups = {};
  for (const g of byPhone.values()) for (const e of g.entries) groups[e.group] = (groups[e.group] || 0) + 1;
  return { byPhone, counts: { deals: rows.length, withPhone: all, noPhone, customers: byPhone.size, won: rows.filter((r) => Number(r.deal.status_id) === WON).length, lost: rows.filter((r) => Number(r.deal.status_id) === LOST).length, groups } };
}

const create = (db, { amo, log = console } = {}) => {
  const COL = db.collection("crm_base");
  const META = db.collection("crm_meta").doc("amo_base");
  let running = false;
  const synced = new Map(); // `erp:{leadId}` → reason, what the base already has

  const fetchClosed = async () => {
    const io = amo.importApi();
    if (!Object.keys(io.statuses).length) await io.loadMeta();
    const closed = Object.keys(io.statuses).filter((k) => /:(142|143)$/.test(k));
    const params = { with: "contacts,loss_reason" };
    closed.forEach((k, i) => {
      const [p, s] = k.split(":");
      params[`filter[statuses][${i}][pipeline_id]`] = p;
      params[`filter[statuses][${i}][status_id]`] = s;
    });
    const deals = await io.pageAll("leads", params, "leads");
    const ids = [...new Set(deals.map((d) => (((d._embedded || {}).contacts || []).find((c) => c.is_main) || ((d._embedded || {}).contacts || [])[0] || {}).id).filter(Boolean))];
    const contacts = new Map();
    for (let i = 0; i < ids.length; i += 50) {
      const rows = await io.pageAll("contacts", { "filter[id][]": ids.slice(i, i + 50) }, "contacts");
      for (const c of rows) {
        const ph = ((c.custom_fields_values || []).find((f) => f.field_code === "PHONE") || { values: [] }).values[0];
        contacts.set(Number(c.id), { name: c.name || "", phone: ph ? String(ph.value || "") : "" });
      }
    }
    const staff = (await db.collection("staff").get()).docs.map((d) => ({ email: d.id.toLowerCase(), ...d.data() }));
    const staffByAmo = new Map(staff.filter((s) => s.amo_user_id).map((s) => [Number(s.amo_user_id), s]));
    return deals.map((deal) => {
      const cs = (deal._embedded || {}).contacts || [];
      const main = cs.find((c) => c.is_main) || cs[0];
      const s = staffByAmo.get(Number(deal.responsible_user_id));
      return { deal, contact: main ? contacts.get(Number(main.id)) || null : null, user: s ? s.full_name || s.email : (io.users.get(Number(deal.responsible_user_id)) || {}).name || "", staffEmail: s ? s.email : "" };
    });
  };

  const preview = async () => {
    const { counts } = planAmo(await fetchClosed());
    const have = (await COL.count().get()).data().count;
    const out = { ...counts, inBase: have, at: new Date().toISOString() };
    await META.set({ preview: out }, { merge: true });
    return out;
  };

  const run = async (who) => {
    if (running) throw new Error("Ko'chirish allaqachon ketyapti");
    running = true;
    try {
      await META.set({ state: "running", started_at: new Date().toISOString(), by: who.name, progress: { done: 0, total: 0 }, error: null }, { merge: true });
      const { byPhone, counts } = planAmo(await fetchClosed());
      const existing = new Map((await COL.get()).docs.map((d) => [d.id, d.data()]));
      const total = byPhone.size;
      let done = 0;
      let batch = db.batch();
      let inBatch = 0;
      for (const [d, g] of byPhone) {
        batch.set(COL.doc(d), mergeDoc(existing.get(d), g.person, g.entries));
        if (++inBatch === 400) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
          await META.set({ progress: { done: done + 1, total } }, { merge: true });
        }
        done++;
      }
      if (inBatch) await batch.commit();
      const result = { customers: total, deals: counts.withPhone, noPhone: counts.noPhone, won: counts.won, lost: counts.lost };
      await META.set({ state: "done", finished_at: new Date().toISOString(), progress: { done, total }, result, preview: null }, { merge: true });
      log.log(`crm_base amo import: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      await META.set({ state: "error", error: String(err.message || err), finished_at: new Date().toISOString() }, { merge: true }).catch(() => undefined);
      throw err;
    } finally {
      running = false;
    }
  };

  // The ERP's lost leads into the base (new or changed reason only).
  const syncErp = async () => {
    if (!synced.size) {
      for (const doc of (await COL.get()).docs) for (const e of doc.data().deals || []) if (e.source === "erp") synced.set(e.key, e.reason);
      synced.set("_loaded", "");
    }
    const lost = (await db.collection("leads").where("status", "==", "lost").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    let n = 0;
    for (const l of lost) {
      const d = digitsOf(l.phone);
      if (d.length < 9 || NOT_CUSTOMER.test(l.lost_reason || "")) continue;
      const e = erpEntry(l);
      if (synced.get(e.key) === e.reason) continue;
      const ref = COL.doc(d);
      const cur = await ref.get();
      await ref.set(mergeDoc(cur.exists ? cur.data() : null, { digits: d, phone: l.phone, name: l.full_name && !/^Noma'lum/.test(l.full_name) ? l.full_name : "", brand: l.brand || "", region: l.region || "", industry: l.industry || "", address: l.address || "" }, [e]));
      synced.set(e.key, e.reason);
      n++;
    }
    if (n) log.log(`crm_base: ${n} ERP lost lead(s) added`);
    return n;
  };

  const start = () => {
    const tick = () => syncErp().catch((e) => log.error("crm_base sync failed:", e.message));
    setTimeout(tick, 2 * 60 * 1000);
    setInterval(tick, 30 * 60 * 1000);
  };

  const register = (app) => {
    const { staffFromRequest } = require("./auth");
    const owner = async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin" || (who.staff && who.staff.report_manager_id)) {
        res.status(403).json({ error: "Faqat rahbar" });
        return null;
      }
      return who;
    };
    app.post("/webhooks/crm/amo-base/preview", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      try {
        res.json(await preview());
      } catch (err) {
        res.status(500).json({ error: String(err.message || err) });
      }
    });
    app.post("/webhooks/crm/amo-base/run", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      if (running) return res.status(409).json({ error: "Ko'chirish allaqachon ketyapti" });
      res.json({ ok: true });
      run(who).catch((err) => log.error("crm_base amo import failed:", err.message));
    });
  };

  return { preview, run, syncErp, start, register };
};

module.exports = { create, amoEntry, erpEntry, mergeDoc, planAmo, digitsOf };
