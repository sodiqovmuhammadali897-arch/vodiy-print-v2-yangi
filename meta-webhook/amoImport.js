// Sotuv bo'limi, step 4 (2026-11-26; owner: «amodan to'liq 1 oy ichida
// ERPga o'tamiz»): amoCRM's OPEN deals (not won, not lost) move into the
// ERP's leads, so the managers keep working them there.
//
// Started from the app by the owner (Sotuv bo'limi → Lidlar → «amoCRM'dan
// ko'chirish»): first a preview (counts only, nothing written), then the run.
// The run writes progress to crm_meta/amo_import; it never goes through
// GitHub Actions, so no customer data reaches any log.
//
// Each deal → an ERP lead with `amo_id` (so pressing again adds only new
// deals): the contact's name and phone, the stage (mapped to the ERP's),
// the responsible user (staff.amo_user_id), the amoCRM fields (Brend,
// Viloyat, Mijoz turi/manbasi, Buyurtma hajmi, To'lov turi, Mahsulot turi,
// Tayyor bo'lish sanasi, Biznes turi — Cyrillic written in Latin), the
// deal's sum and tags. A deal whose phone already has an open ERP lead is
// linked to it (amo_id set, empty fields filled) instead of a second lead.
// The deal's open amoCRM tasks become ERP tasks. A deal in Dizayn/avans or
// Ishlab chiqarish is matched to its ERP order by phone when there is one.
// amoCRM itself is never written to.
const { pickOpenLead, normalizePhone } = require("./callLeads");

// Uzbek Cyrillic → Latin (amoCRM's field values are Cyrillic, the ERP's Latin).
const CYR = { а: "a", б: "b", в: "v", г: "g", ғ: "g'", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", ў: "o'", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "'", ь: "", ы: "i", э: "e", ю: "yu", я: "ya" };
function latin(s) {
  return String(s || "").replace(/[Ѐ-ӿ]/g, (ch, i, str) => {
    const low = ch.toLowerCase();
    let out = CYR[low];
    if (out === undefined) return ch;
    // «е» at the start of a word reads «ye».
    if (low === "е" && (i === 0 || /[\s\-(«"']/.test(str[i - 1]))) out = "ye";
    return ch === low ? out : out.charAt(0).toUpperCase() + out.slice(1);
  });
}

// amoCRM stage name → ERP status.
const STAGES = [
  [/неразобран|nerazobran/i, "new"],
  [/[қк]абул|qabul/i, "accepted"],
  [/маълумот|малумот|ma'lumot/i, "info_given"],
  [/таклиф|taklif/i, "offer"],
  [/дизайн|аванс|dizayn|avans/i, "advance"],
  [/ишлаб|ishlab/i, "production"],
];
const stageStatus = (name) => (STAGES.find(([re]) => re.test(String(name || ""))) || [null, "accepted"])[1];
const STAGE_LABEL = { new: "Yangi", accepted: "Qabul qilindi", info_given: "Ma'lumot berildi", offer: "Taklif yuborildi", advance: "Dizayn / avans", production: "Ishlab chiqarish" };
const stageLabel = (name) => STAGE_LABEL[stageStatus(name)];

// amoCRM field (by its name) → ERP lead field.
const FIELDS = [
  ["brand", /brend|бренд/i],
  ["region", /вилоят|viloyat/i],
  ["customer_type", /мижоз\s*тури|mijoz\s*turi/i],
  ["source", /манба|manba/i],
  ["order_volume", /[ҳх]ажм|hajm/i],
  ["payment_type", /т[ўу]лов|to'lov/i],
  ["product_types", /ма[ҳх]сулот|mahsulot/i],
  ["ready_date", /тайёр|tayyor/i],
  ["industry", /бизнес|biznes/i],
];
const TZ = 5 * 3600e3;
const dayOf = (sec) => new Date(Number(sec) * 1000 + TZ).toISOString().slice(0, 10);

function fieldsOf(deal) {
  const out = {};
  for (const f of deal.custom_fields_values || []) {
    const hit = FIELDS.find(([, re]) => re.test(String(f.field_name || "")));
    if (!hit || out[hit[0]] !== undefined) continue;
    const vals = (f.values || []).map((v) => v.value).filter((v) => v !== null && v !== undefined && v !== "");
    if (!vals.length) continue;
    const key = hit[0];
    if (key === "product_types") out[key] = vals.map((v) => latin(v).trim());
    else if (key === "ready_date") out[key] = /^\d+$/.test(String(vals[0])) ? dayOf(vals[0]) : String(vals[0]).slice(0, 10);
    else out[key] = latin(vals[0]).trim();
  }
  return out;
}

// One deal (with its main contact) → the ERP lead's fields. Pure.
function toErpLead(deal, { contact = null, stageName = "", staff = null, sourceName = "" } = {}) {
  const f = fieldsOf(deal);
  const tags = ((deal._embedded && deal._embedded.tags) || []).map((t) => latin(t.name)).filter(Boolean);
  const name = latin((contact && contact.name) || "").trim();
  return {
    full_name: name || latin(deal.name || "").trim() || "Noma'lum (amoCRM)",
    brand: f.brand || "",
    phone: (contact && contact.phone) || "",
    source: f.source || latin(sourceName) || "amoCRM",
    status: stageStatus(stageName),
    region: f.region || "",
    industry: f.industry || "",
    customer_type: f.customer_type || "",
    order_volume: f.order_volume || "",
    payment_type: f.payment_type || "",
    product_types: f.product_types || [],
    ready_date: f.ready_date || null,
    tags,
    estimated_amount: Number(deal.price) || 0,
    assigned_to_email: staff ? staff.email : "",
    assigned_to_name: staff ? staff.name : "",
    note: `amoCRM'dan ko'chirildi (bitim #${deal.id}${deal.name ? `, «${latin(deal.name)}»` : ""})`,
    amo_id: Number(deal.id),
    created_at: new Date(Number(deal.created_at || 0) * 1000).toISOString(),
    updated_at: new Date(Number(deal.updated_at || deal.created_at || 0) * 1000).toISOString(),
  };
}

// An open amoCRM task → an ERP task. Pure.
function toErpTask(task, lead) {
  const due = new Date(Number(task.complete_till || 0) * 1000 + TZ).toISOString();
  return {
    lead_id: lead.id,
    lead_name: lead.full_name || "",
    type: Number(task.task_type_id) === 2 ? "other" : "call",
    due_date: due.slice(0, 10),
    due_time: due.slice(11, 16),
    assigned_to_email: lead.assigned_to_email || "",
    assigned_to_name: lead.assigned_to_name || "",
    note: latin(task.text || "").slice(0, 300),
    status: "open",
    completed_at: null,
  };
}

// What the run will do, without writing: pure, for the preview and tests.
// erpLeads: current ERP leads; deals: [{deal, lead (toErpLead)}].
function plan(erpLeads, deals, orderStatus = {}) {
  // Every amoCRM deal already in the ERP: a lead's own amo_id and the other
  // deals of the same phone linked to it (amo_ids).
  const byAmo = new Set(erpLeads.flatMap((l) => [l.amo_id, ...(l.amo_ids || [])]).filter(Boolean).map(Number));
  const pool = [...erpLeads];
  const out = { create: [], link: [], already: 0 };
  for (const d of deals) {
    if (byAmo.has(Number(d.deal.id))) {
      out.already++;
      continue;
    }
    const open = d.lead.phone ? pickOpenLead(pool, d.lead.phone, orderStatus) : null;
    // Same phone as a deal created in this run: joins that new lead.
    if (open && open.newOf) out.link.push({ ...d, erp: open, newOf: open.newOf });
    else if (open) out.link.push({ ...d, erp: open });
    else {
      out.create.push(d);
      pool.push({ ...d.lead, id: `new:${d.deal.id}`, newOf: Number(d.deal.id) });
    }
    byAmo.add(Number(d.deal.id));
  }
  return out;
}

// Blank fields of an existing lead filled from the deal.
function fillBlanks(erp, lead) {
  const patch = { amo_ids: [...new Set([...(erp.amo_ids || []), Number(lead.amo_id)])] };
  if (!erp.amo_id) patch.amo_id = lead.amo_id;
  for (const k of ["brand", "region", "industry", "customer_type", "order_volume", "payment_type", "ready_date"]) if (!erp[k] && lead[k]) patch[k] = lead[k];
  if ((!erp.product_types || !erp.product_types.length) && lead.product_types.length) patch.product_types = lead.product_types;
  if (!erp.estimated_amount && lead.estimated_amount) patch.estimated_amount = lead.estimated_amount;
  if (!erp.assigned_to_email && lead.assigned_to_email) Object.assign(patch, { assigned_to_email: lead.assigned_to_email, assigned_to_name: lead.assigned_to_name });
  if ((!erp.full_name || /^Noma'lum/.test(erp.full_name)) && lead.full_name) patch.full_name = lead.full_name;
  return patch;
}

const count = (list, key) => {
  const m = new Map();
  for (const x of list) m.set(key(x), (m.get(key(x)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));
};

const create = (db, { amo }) => {
  const DOC = db.collection("crm_meta").doc("amo_import");
  let running = false;

  // Everything the import needs from amoCRM, read only.
  const fetchDeals = async () => {
    const io = amo.importApi();
    if (!Object.keys(io.statuses).length) await io.loadMeta();
    const open = Object.entries(io.statuses).filter(([k]) => !/:(142|143)$/.test(k));
    const params = { with: "contacts,source_id" };
    open.forEach(([k], i) => {
      const [p, s] = k.split(":");
      params[`filter[statuses][${i}][pipeline_id]`] = p;
      params[`filter[statuses][${i}][status_id]`] = s;
    });
    const deals = await io.pageAll("leads", params, "leads");
    // Main contacts: name and phone.
    const ids = [...new Set(deals.map((d) => (((d._embedded || {}).contacts || []).find((c) => c.is_main) || ((d._embedded || {}).contacts || [])[0] || {}).id).filter(Boolean))];
    const contacts = new Map();
    for (let i = 0; i < ids.length; i += 50) {
      const rows = await io.pageAll("contacts", { "filter[id][]": ids.slice(i, i + 50) }, "contacts");
      for (const c of rows) {
        const ph = ((c.custom_fields_values || []).find((f) => f.field_code === "PHONE") || { values: [] }).values[0];
        contacts.set(Number(c.id), { name: c.name || "", phone: ph ? String(ph.value || "") : "" });
      }
    }
    // Open tasks on deals.
    const tasks = await io.pageAll("tasks", { "filter[is_completed]": 0, "filter[entity_type]": "leads" }, "tasks").catch(() => []);
    const staff = (await db.collection("staff").get()).docs.map((d) => ({ email: d.id.toLowerCase(), ...d.data() }));
    const staffByAmo = new Map(staff.filter((s) => s.amo_user_id).map((s) => [Number(s.amo_user_id), { email: s.email, name: s.full_name || s.email }]));
    const rows = deals.map((deal) => {
      const cs = (deal._embedded || {}).contacts || [];
      const main = cs.find((c) => c.is_main) || cs[0];
      const stageName = (io.statuses[`${deal.pipeline_id}:${deal.status_id}`] || {}).name || "";
      const lead = toErpLead(deal, { contact: main ? contacts.get(Number(main.id)) : null, stageName, staff: staffByAmo.get(Number(deal.responsible_user_id)) || null, sourceName: io.sources ? io.sources.get(Number(deal.source_id)) : "" });
      return { deal, lead, stageName, user: (io.users.get(Number(deal.responsible_user_id)) || {}).name || "—" };
    });
    const tasksByDeal = new Map();
    for (const t of tasks) {
      if (t.entity_type !== "leads") continue;
      const id = Number(t.entity_id);
      if (!tasksByDeal.has(id)) tasksByDeal.set(id, []);
      tasksByDeal.get(id).push(t);
    }
    return { rows, tasksByDeal };
  };

  const erpState = async () => {
    const leads = (await db.collection("leads").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const orders = (await db.collection("orders").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const orderStatus = Object.fromEntries(orders.map((o) => [o.id, o.status]));
    return { leads, orders, orderStatus };
  };

  // Counts only — nothing is written to the ERP's leads.
  const preview = async () => {
    const { rows, tasksByDeal } = await fetchDeals();
    const { leads, orderStatus } = await erpState();
    const p = plan(leads, rows, orderStatus);
    const todo = [...p.create, ...p.link];
    const out = {
      total: rows.length,
      create: p.create.length,
      link: p.link.length,
      already: p.already,
      noPhone: todo.filter((d) => normalizePhone(d.lead.phone).length < 9).length,
      unassigned: todo.filter((d) => !d.lead.assigned_to_email).length,
      tasks: todo.reduce((s, d) => s + (tasksByDeal.get(Number(d.deal.id)) || []).length, 0),
      byStage: count(todo, (d) => stageLabel(d.stageName)),
      byUser: count(todo, (d) => d.lead.assigned_to_name || `${d.user} (ERP'da bog'lanmagan)`),
      at: new Date().toISOString(),
    };
    await DOC.set({ preview: out }, { merge: true });
    return out;
  };

  // Orders by customer phone, for deals already in production.
  const ordersByPhone = async (orders) => {
    const customers = (await db.collection("customers").get()).docs.map((d) => ({ id: d.id, phone: d.data().phone }));
    const byCustomer = new Map();
    for (const o of orders) {
      if (!o.customer_id || o.status === "cancelled" || o.is_draft) continue;
      if (!byCustomer.has(o.customer_id)) byCustomer.set(o.customer_id, []);
      byCustomer.get(o.customer_id).push({ id: o.id, created_at: o.created_at || "" });
    }
    const out = new Map();
    for (const c of customers) {
      const k = normalizePhone(c.phone);
      if (k.length === 9 && byCustomer.has(c.id)) out.set(k, { customer: c.id, orders: byCustomer.get(c.id) });
    }
    return out;
  };

  const run = async (who) => {
    if (running) throw new Error("Ko'chirish allaqachon ketyapti");
    running = true;
    const started = new Date().toISOString();
    const result = { created: 0, linked: 0, already: 0, tasks: 0, orders: 0 };
    try {
      await DOC.set({ state: "running", started_at: started, by: who.name, progress: { done: 0, total: 0 }, error: null }, { merge: true });
      const { rows, tasksByDeal } = await fetchDeals();
      const { leads, orders, orderStatus } = await erpState();
      const p = plan(leads, rows, orderStatus);
      result.already = p.already;
      const total = p.create.length + p.link.length;
      const byPhone = await ordersByPhone(orders);
      // LID numbers counted once, not re-read per lead.
      let max = 0;
      for (const l of leads) {
        const m = /^LID-(\d+)$/.exec(l.lead_number || "");
        if (m) max = Math.max(max, Number(m[1]));
      }
      let done = 0;
      const createdId = new Map(); // amo deal id → the new ERP lead {id, ...fields}
      const now = () => new Date().toISOString();
      const addTasks = async (lead, dealId) => {
        for (const t of tasksByDeal.get(Number(dealId)) || []) {
          await db.collection("lead_tasks").add({ ...toErpTask(t, lead), created_at: now() });
          result.tasks++;
        }
      };
      for (const d of p.create) {
        const fields = { ...d.lead };
        // Already in production: the ERP order of that phone, if any.
        if (fields.status === "advance" || fields.status === "production") {
          const hit = byPhone.get(normalizePhone(fields.phone));
          const order = hit && hit.orders.filter((o) => o.created_at >= fields.created_at.slice(0, 10)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
          if (order) {
            Object.assign(fields, { converted_order_id: order.id, converted_customer_id: hit.customer });
            result.orders++;
          }
          fields.status = "advance";
        }
        const ref = await db.collection("leads").add({
          telegram: "", interested_product_id: "", interested_product_name: "", campaign_name: "", campaign_id: "", ad_set_name: "", ad_set_id: "", ad_name: "", ad_id: "", form_name: "", form_id: "",
          next_contact_at: null, first_contact_at: null, last_contact_at: null, lost_reason: "", lost_comment: "", converted_customer_id: null, converted_order_id: null, address: "",
          ...fields,
          amo_ids: [Number(d.deal.id)],
          lead_number: `LID-${String(++max).padStart(3, "0")}`,
        });
        await db.collection("lead_activities").add({ lead_id: ref.id, text: `📥 amoCRM'dan ko'chirildi: «${stageLabel(d.stageName)}» bosqichi${d.lead.assigned_to_name ? `, mas'ul ${d.lead.assigned_to_name}` : ""} (bitim #${d.deal.id})`, actor_email: who.email, actor_name: who.name, created_at: now() });
        await addTasks({ ...fields, id: ref.id }, d.deal.id);
        createdId.set(Number(d.deal.id), { ...fields, id: ref.id, amo_ids: [Number(d.deal.id)] });
        result.created++;
        if (++done % 25 === 0) await DOC.set({ progress: { done, total } }, { merge: true });
      }
      for (const d of p.link) {
        if (d.newOf) {
          // A second deal of the same phone: noted on the lead made above, its tasks added.
          const made = createdId.get(d.newOf);
          if (!made) continue;
          const id = made.id;
          const patch = fillBlanks(made, d.lead);
          Object.assign(made, patch);
          await db.collection("leads").doc(id).update({ ...patch, updated_at: now() });
          // It got its owner from this deal: its unassigned tasks go with it.
          if (patch.assigned_to_email)
            for (const t of (await db.collection("lead_tasks").where("lead_id", "==", id).get()).docs)
              if (!t.data().assigned_to_email) await t.ref.update({ assigned_to_email: patch.assigned_to_email, assigned_to_name: patch.assigned_to_name });
          await db.collection("lead_activities").add({ lead_id: id, text: `🔗 amoCRM'dagi yana bir bitim #${d.deal.id} (shu telefon) — «${stageLabel(d.stageName)}» bosqichi`, actor_email: who.email, actor_name: who.name, created_at: now() });
          await addTasks(made, d.deal.id);
          result.linked++;
          if (++done % 25 === 0) await DOC.set({ progress: { done, total } }, { merge: true });
          continue;
        }
        await db.collection("leads").doc(d.erp.id).update({ ...fillBlanks(d.erp, d.lead), updated_at: now() });
        await db.collection("lead_activities").add({ lead_id: d.erp.id, text: `🔗 amoCRM'dagi bitim #${d.deal.id} shu lidga bog'landi («${stageLabel(d.stageName)}» bosqichi)`, actor_email: who.email, actor_name: who.name, created_at: now() });
        const openTasks = (await db.collection("lead_tasks").where("lead_id", "==", d.erp.id).get()).docs.some((x) => x.data().status === "open");
        if (!openTasks) await addTasks({ ...d.erp, assigned_to_email: d.erp.assigned_to_email || d.lead.assigned_to_email, assigned_to_name: d.erp.assigned_to_name || d.lead.assigned_to_name }, d.deal.id);
        result.linked++;
        if (++done % 25 === 0) await DOC.set({ progress: { done, total } }, { merge: true });
      }
      await DOC.set({ state: "done", finished_at: now(), progress: { done, total }, result, preview: null }, { merge: true });
      console.log(`amoCRM import: ${result.created} created, ${result.linked} linked, ${result.tasks} tasks, ${result.orders} orders`);
      return result;
    } catch (err) {
      await DOC.set({ state: "error", error: String(err.message || err), finished_at: new Date().toISOString(), result }, { merge: true }).catch(() => undefined);
      throw err;
    } finally {
      running = false;
    }
  };

  // A server restart (deploy) stops a run midway: the app would show it
  // «running» forever. Mark it so it can be pressed again (re-runs add only
  // what is missing).
  DOC.get()
    .then((d) => {
      const x = d.exists ? d.data() : {};
      if (x.state === "running" || x.previewing) return DOC.set({ state: x.state === "running" ? "error" : x.state || null, previewing: false, error: x.state === "running" ? "Server qayta ishga tushdi — yana bosing, qolgani qo'shiladi" : null }, { merge: true });
      return null;
    })
    .catch(() => undefined);

  const register = (app) => {
    const { staffFromRequest } = require("./auth");
    const owner = async (req, res) => {
      const who = await staffFromRequest(db, req);
      // The owner only: an admin, not a manager's account.
      if (!who || who.role !== "admin" || (who.staff && who.staff.report_manager_id)) {
        res.status(403).json({ error: "Faqat rahbar" });
        return null;
      }
      return who;
    };
    app.post("/webhooks/crm/amo-import/preview", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      try {
        res.json(await preview());
      } catch (err) {
        res.status(500).json({ error: String(err.message || err) });
      }
    });
    app.post("/webhooks/crm/amo-import/run", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      if (running) return res.status(409).json({ error: "Ko'chirish allaqachon ketyapti" });
      res.json({ ok: true });
      run(who).catch((err) => console.error("amoCRM import failed:", err.message));
    });
  };

  return { preview, run, register };
};

module.exports = { create, latin, stageStatus, stageLabel, fieldsOf, toErpLead, toErpTask, plan, fillBlanks };
