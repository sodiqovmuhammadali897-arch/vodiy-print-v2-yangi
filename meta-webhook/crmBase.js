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
    fields: allFields(deal),
    tags: ((deal._embedded && deal._embedded.tags) || []).map((t) => latin(t.name)).filter(Boolean),
  };
}

// Every filled amoCRM field of a deal as «label: value» (Latin). Pure.
function allFields(deal) {
  const out = [];
  for (const f of deal.custom_fields_values || []) {
    const vals = (f.values || []).map((v) => v.value).filter((v) => v !== null && v !== undefined && v !== "");
    if (!vals.length) continue;
    const label = latin(f.field_name || "").trim();
    const date = /^\d{9,10}$/.test(String(vals[0])) && /san|date|vaqt|muddat/i.test(label);
    const value = date ? new Date(Number(vals[0]) * 1000 + 5 * 3600e3).toISOString().slice(0, 10) : vals.map((v) => latin(String(v))).join(", ");
    out.push({ label, value: value.slice(0, 300) });
  }
  return out;
}

// An amoCRM call note → a call of the customer. Pure.
function amoCall(n, users = new Map()) {
  const p = n.params || {};
  return {
    id: String(p.uniq || `${n.entity_type || ""}${n.id}`),
    at: Number(n.created_at) > 0 ? new Date(Number(n.created_at) * 1000).toISOString() : "",
    dir: n.note_type === "call_in" ? "in" : "out",
    sec: Math.max(0, Number(p.duration) || 0),
    who: latin((users.get(Number(n.created_by || n.responsible_user_id)) || {}).name || ""),
    link: String(p.link || ""),
    src: "amo",
  };
}

// A manager's text note on a deal. Pure.
function amoNote(n, users = new Map()) {
  return {
    id: `amo:${n.id}`,
    at: Number(n.created_at) > 0 ? new Date(Number(n.created_at) * 1000).toISOString() : "",
    who: latin((users.get(Number(n.created_by || n.responsible_user_id)) || {}).name || ""),
    text: latin(String((n.params && n.params.text) || "")).trim().slice(0, 800),
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
const MAX_CALLS = 150;
const MAX_NOTES = 60;
const mergeById = (old, add, max) => {
  const m = new Map((old || []).map((x) => [x.id, x]));
  for (const x of add || []) m.set(x.id, { ...(m.get(x.id) || {}), ...x });
  return [...m.values()].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, max);
};

function mergeDoc(existing, person, entries, now = new Date().toISOString(), extra = {}) {
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
  if (extra.calls && extra.calls.length) doc.calls = mergeById(doc.calls, extra.calls, MAX_CALLS);
  if (extra.notes && extra.notes.length) doc.notes = mergeById(doc.notes, extra.notes.filter((n) => n.text), MAX_NOTES);
  if (doc.calls) {
    doc.calls_count = doc.calls.length;
    doc.talk_sec = doc.calls.reduce((t, c) => t + (c.sec || 0), 0);
  }
  doc.updated_at = now;
  return doc;
}

// Closed amoCRM rows ({deal, contact, user, staffEmail}) grouped by phone.
// Pure: what the import will write, and the counts for the preview.
function planAmo(rows, { callsByPhone = new Map(), notesByDeal = new Map() } = {}) {
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
    g.notes = [...(g.notes || []), ...(notesByDeal.get(Number(r.deal.id)) || [])];
  }
  let calls = 0;
  for (const [d, g] of byPhone) {
    g.calls = callsByPhone.get(d) || [];
    calls += g.calls.length;
  }
  const all = rows.length - noPhone;
  const groups = {};
  for (const g of byPhone.values()) for (const e of g.entries) groups[e.group] = (groups[e.group] || 0) + 1;
  return { byPhone, counts: { calls, recorded: [...byPhone.values()].reduce((t, g) => t + g.calls.filter((c) => c.link).length, 0), notes: [...byPhone.values()].reduce((t, g) => t + (g.notes || []).length, 0), deals: rows.length, withPhone: all, noPhone, customers: byPhone.size, won: rows.filter((r) => Number(r.deal.status_id) === WON).length, lost: rows.filter((r) => Number(r.deal.status_id) === LOST).length, groups } };
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
    // Who is who in notes: the staff name when linked, else amoCRM's user.
    const people = new Map([...io.users.entries()].map(([id, u]) => [id, { name: (staffByAmo.get(id) || {}).full_name || u.name }]));
    // Notes are read per deal / contact (50 ids a request): reading the whole
    // notes list stopped at old ones (2026-11-26: newest call 17.09).
    let failed = 0;
    const notesOf = async (entity, ids, types) => {
      const out = [];
      for (let i = 0; i < ids.length; i += 50) {
        try {
          out.push(...(await io.pageAll(`${entity}/notes`, { "filter[entity_id][]": ids.slice(i, i + 50), "filter[note_type][]": types }, "notes")));
        } catch {
          failed++;
        }
      }
      return out;
    };
    const dealIdList = deals.map((d) => Number(d.id));
    const contactIdList = [...contacts.keys()];
    // Managers' text notes on these deals.
    const notesByDeal = new Map();
    for (const n of await notesOf("leads", dealIdList, ["common"])) {
      const id = Number(n.entity_id);
      if (!notesByDeal.has(id)) notesByDeal.set(id, []);
      notesByDeal.get(id).push(amoNote(n, people));
    }
    // Every call (Mois Zvonki notes on the deals and their contacts), by phone.
    const dealPhone = new Map();
    const contactPhone = new Map([...contacts.entries()].map(([id, c]) => [id, digitsOf(c.phone)]));
    for (const d of deals) {
      const cs = (d._embedded || {}).contacts || [];
      const main = cs.find((c) => c.is_main) || cs[0];
      if (main) dealPhone.set(Number(d.id), contactPhone.get(Number(main.id)) || "");
    }
    const callsByPhone = new Map();
    const seen = new Set();
    for (const [entity, ids] of [["leads", dealIdList], ["contacts", contactIdList]]) {
      for (const n of await notesOf(entity, ids, ["call_in", "call_out"])) {
        const c = amoCall({ ...n, entity_type: entity[0] }, people);
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const ph = digitsOf(n.params && n.params.phone) || (entity === "leads" ? dealPhone.get(Number(n.entity_id)) : contactPhone.get(Number(n.entity_id))) || "";
        if (ph.length < 9) continue;
        if (!callsByPhone.has(ph)) callsByPhone.set(ph, []);
        callsByPhone.get(ph).push(c);
      }
    }
    if (failed) log.log(`crm_base: ${failed} note request(s) failed`);
    const rows = deals.map((deal) => {
      const cs = (deal._embedded || {}).contacts || [];
      const main = cs.find((c) => c.is_main) || cs[0];
      const s = staffByAmo.get(Number(deal.responsible_user_id));
      return { deal, contact: main ? contacts.get(Number(main.id)) || null : null, user: s ? s.full_name || s.email : (io.users.get(Number(deal.responsible_user_id)) || {}).name || "", staffEmail: s ? s.email : "" };
    });
    return { rows, callsByPhone, notesByDeal, failed };
  };

  const preview = async () => {
    const f = await fetchClosed();
    const { counts } = planAmo(f.rows, f);
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
      const f = await fetchClosed();
      const { byPhone, counts } = planAmo(f.rows, f);
      const existing = new Map((await COL.get()).docs.map((d) => [d.id, d.data()]));
      const total = byPhone.size;
      let done = 0;
      let batch = db.batch();
      let inBatch = 0;
      for (const [d, g] of byPhone) {
        batch.set(COL.doc(d), mergeDoc(existing.get(d), g.person, g.entries, undefined, { calls: g.calls, notes: g.notes }));
        if (++inBatch === 100) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
          await META.set({ progress: { done: done + 1, total } }, { merge: true });
        }
        done++;
      }
      if (inBatch) await batch.commit();
      const result = { customers: total, deals: counts.withPhone, noPhone: counts.noPhone, won: counts.won, lost: counts.lost, calls: counts.calls, recorded: counts.recorded, notes: counts.notes, failed: f.failed };
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
    const all = (await db.collection("leads").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const lost = all.filter((l) => l.status === "lost");
    // A phone that still has an open lead is a customer in work, not one for
    // the base (the switchover closed doubles of open amoCRM deals). Its lost
    // leads come in once it has no open lead left.
    const active = new Set(all.filter((l) => l.status !== "lost").map((l) => digitsOf(l.phone)).filter((d) => d.length >= 9));
    let n = 0;
    for (const l of lost) {
      const d = digitsOf(l.phone);
      if (d.length < 9 || NOT_CUSTOMER.test(l.lost_reason || "") || active.has(d)) continue;
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

  // A server restart (deploy) stops a run midway: the app would show it
  // «running» forever. Mark it so it can be pressed again (re-runs add only
  // what is missing).
  META.get()
    .then((d) => {
      const x = d.exists ? d.data() : {};
      if (x.state === "running" || x.previewing) return META.set({ state: x.state === "running" ? "error" : x.state || null, previewing: false, error: x.state === "running" ? "Server qayta ishga tushdi — yana bosing, qolgani qo'shiladi" : null }, { merge: true });
      return null;
    })
    .catch(() => undefined);

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
    // Reading every call note takes minutes: the preview runs in the
    // background too, the app watches crm_meta/amo_base.
    app.post("/webhooks/crm/amo-base/preview", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      if (running) return res.status(409).json({ error: "Ko'chirish ketyapti" });
      res.json({ ok: true });
      await META.set({ previewing: true, error: null }, { merge: true }).catch(() => undefined);
      preview()
        .catch((err) => META.set({ error: String(err.message || err) }, { merge: true }).catch(() => undefined))
        .finally(() => META.set({ previewing: false }, { merge: true }).catch(() => undefined));
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

module.exports = { create, amoEntry, erpEntry, mergeDoc, planAmo, digitsOf, amoCall, amoNote, allFields };
