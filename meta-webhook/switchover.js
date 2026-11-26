// «Ertadan managerlar ERP bo'yicha ishlaydi» (owner, 2026-11-26): one
// switchover, started by the owner from the app (preview, then run):
//   1. every OPEN amoCRM task (on a deal) moves into the ERP — onto the
//      deal's ERP lead (by amo_id, else the phone's open lead, else a new
//      lead made from the deal), assigned to the task's amoCRM user's staff;
//      a task already moved (lead_tasks.amo_task_id) is not doubled;
//   2. every other OLD open ERP lead (created before the cut-off day, no
//      order, not one that just got an amoCRM task) is closed as lost
//      «Eski lid (ERP'ga o'tish)»; its open tasks are cancelled (done +
//      cancelled, counted nowhere). They go to Mijozlar bazasi (crmBase.js).
// amoCRM is only read. Progress in crm_meta/switchover; counts only.
const { pickOpenLead, normalizePhone } = require("./callLeads");
const { toErpLead, toErpTask, fillBlanks, stageLabel } = require("./amoImport");

const CLOSE_REASON = "Eski lid (ERP'ga o'tish)";
// 25 Nov 2026 00:00 Tashkent unless the owner picks another day.
const cutoffOf = (day) => new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(day || "") ? day : "2026-11-25"}T00:00:00+05:00`).toISOString();

// What will happen, without writing. Pure.
//  leads: ERP leads; erpTasks: ERP lead_tasks; amoTasks: open amoCRM tasks;
//  deals: Map(dealId → {deal, lead (toErpLead), open: boolean}).
function planSwitch({ leads, erpTasks, amoTasks, deals, cutoff, orderStatus = {} }) {
  const moved = new Set(erpTasks.map((t) => Number(t.amo_task_id)).filter(Boolean));
  // Tasks the first amoCRM import (amoImport.js) already copied carry no
  // amo_task_id: the same lead + due day + time counts as moved.
  const sig = (leadId, due, time) => `${leadId}|${due}|${time}`;
  const copied = new Set(erpTasks.filter((t) => !t.amo_task_id && t.status === "open").map((t) => sig(t.lead_id, t.due_date, t.due_time)));
  const dueOf = (t) => {
    const d = new Date(Number(t.complete_till || 0) * 1000 + 5 * 3600e3).toISOString();
    return [d.slice(0, 10), d.slice(11, 16)];
  };
  const byAmo = new Map();
  for (const l of leads) for (const id of [l.amo_id, ...(l.amo_ids || [])].filter(Boolean)) byAmo.set(Number(id), l);
  const pool = [...leads];
  const out = { tasks: [], already: 0, onContacts: 0, closedDeal: 0, noDeal: 0, create: [], link: new Map(), reopen: new Set(), close: [], keep: new Set() };
  const created = new Map(); // deal id → pseudo lead
  for (const t of amoTasks) {
    if (t.entity_type !== "leads") {
      out.onContacts++;
      continue;
    }
    const dealId = Number(t.entity_id);
    const d = deals.get(dealId);
    if (!d) {
      out.noDeal++;
      continue;
    }
    if (!d.open) {
      out.closedDeal++;
      continue;
    }
    if (moved.has(Number(t.id))) {
      out.already++;
      const l = byAmo.get(dealId);
      if (l) out.keep.add(l.id);
      continue;
    }
    let lead = byAmo.get(dealId) || created.get(dealId);
    if (!lead && d.lead.phone) {
      const open = pickOpenLead(pool, d.lead.phone, orderStatus);
      if (open) lead = open;
    }
    if (lead && !lead.isNew && copied.has(sig(lead.id, ...dueOf(t)))) {
      out.already++;
      out.keep.add(lead.id);
      continue;
    }
    if (!lead) {
      lead = { ...d.lead, id: `new:${dealId}`, isNew: true, amo_ids: [dealId] };
      created.set(dealId, lead);
      pool.push(lead);
      out.create.push({ dealId, lead });
    } else if (!lead.isNew) {
      if (!out.link.has(lead.id)) out.link.set(lead.id, { lead, deals: new Set() });
      out.link.get(lead.id).deals.add(dealId);
      if (lead.status === "lost") out.reopen.add(lead.id);
    }
    out.keep.add(lead.id);
    out.tasks.push({ task: t, lead, dealId });
  }
  for (const l of leads) {
    if (l.status === "lost" || l.converted_order_id || out.keep.has(l.id)) continue;
    if (String(l.created_at || "") >= cutoff) continue;
    out.close.push(l);
  }
  const closeIds = new Set(out.close.map((l) => l.id));
  out.cancel = erpTasks.filter((t) => t.status === "open" && closeIds.has(t.lead_id));
  out.keepNew = leads.filter((l) => l.status !== "lost" && !l.converted_order_id && String(l.created_at || "") >= cutoff).length;
  return out;
}

const countBy = (list, key) => {
  const m = new Map();
  for (const x of list) m.set(key(x), (m.get(key(x)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));
};

const create = (db, { amo, log = console } = {}) => {
  const META = db.collection("crm_meta").doc("switchover");
  let running = false;

  const gather = async (cutoff) => {
    const io = amo.importApi();
    if (!Object.keys(io.statuses).length) await io.loadMeta();
    const amoTasks = await io.pageAll("tasks", { "filter[is_completed]": 0 }, "tasks");
    const dealIds = [...new Set(amoTasks.filter((t) => t.entity_type === "leads").map((t) => Number(t.entity_id)))];
    const rawDeals = [];
    for (let i = 0; i < dealIds.length; i += 50) rawDeals.push(...(await io.pageAll("leads", { with: "contacts", "filter[id][]": dealIds.slice(i, i + 50) }, "leads")));
    const cids = [...new Set(rawDeals.map((d) => (((d._embedded || {}).contacts || []).find((c) => c.is_main) || ((d._embedded || {}).contacts || [])[0] || {}).id).filter(Boolean))];
    const contacts = new Map();
    for (let i = 0; i < cids.length; i += 50) {
      for (const c of await io.pageAll("contacts", { "filter[id][]": cids.slice(i, i + 50) }, "contacts")) {
        const ph = ((c.custom_fields_values || []).find((f) => f.field_code === "PHONE") || { values: [] }).values[0];
        contacts.set(Number(c.id), { name: c.name || "", phone: ph ? String(ph.value || "") : "" });
      }
    }
    const staff = (await db.collection("staff").get()).docs.map((d) => ({ email: d.id.toLowerCase(), ...d.data() }));
    const staffByAmo = new Map(staff.filter((s) => s.amo_user_id).map((s) => [Number(s.amo_user_id), { email: s.email, name: s.full_name || s.email }]));
    const deals = new Map();
    for (const deal of rawDeals) {
      const cs = (deal._embedded || {}).contacts || [];
      const main = cs.find((c) => c.is_main) || cs[0];
      const stageName = (io.statuses[`${deal.pipeline_id}:${deal.status_id}`] || {}).name || "";
      const open = ![142, 143].includes(Number(deal.status_id));
      deals.set(Number(deal.id), { deal, stageName, open, lead: toErpLead(deal, { contact: main ? contacts.get(Number(main.id)) : null, stageName, staff: staffByAmo.get(Number(deal.responsible_user_id)) || null }) });
    }
    const leads = (await db.collection("leads").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const erpTasks = (await db.collection("lead_tasks").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const orders = (await db.collection("orders").get()).docs.map((d) => ({ id: d.id, status: d.data().status }));
    const orderStatus = Object.fromEntries(orders.map((o) => [o.id, o.status]));
    const plan = planSwitch({ leads, erpTasks, amoTasks, deals, cutoff, orderStatus });
    const userName = (id) => (staffByAmo.get(Number(id)) || {}).name || `${(io.users.get(Number(id)) || {}).name || "—"} (ERP'da bog'lanmagan)`;
    return { plan, deals, leads, staffByAmo, userName, amoTotal: amoTasks.length };
  };

  const summary = ({ plan, userName, amoTotal }, cutoff) => ({
    cutoff,
    amoOpenTasks: amoTotal,
    tasksToMove: plan.tasks.length,
    tasksAlready: plan.already,
    tasksOnContacts: plan.onContacts,
    tasksOnClosedDeals: plan.closedDeal + plan.noDeal,
    byUser: countBy(plan.tasks, (x) => userName(x.task.responsible_user_id)),
    leadsCreate: plan.create.length,
    leadsLink: plan.link.size,
    leadsReopen: plan.reopen.size,
    leadsClose: plan.close.length,
    closeByStatus: countBy(plan.close, (l) => l.status || "new"),
    tasksCancel: plan.cancel.length,
    leadsKeepNew: plan.keepNew,
    at: new Date().toISOString(),
  });

  const preview = async (day) => {
    const cutoff = cutoffOf(day);
    const out = summary(await gather(cutoff), cutoff);
    await META.set({ preview: out }, { merge: true });
    return out;
  };

  const run = async (who, day) => {
    if (running) throw new Error("Allaqachon ketyapti");
    running = true;
    const now = () => new Date().toISOString();
    const result = { created: 0, linked: 0, reopened: 0, tasks: 0, closed: 0, cancelled: 0 };
    try {
      const cutoff = cutoffOf(day);
      await META.set({ state: "running", started_at: now(), by: who.name, progress: { done: 0, total: 0 }, error: null }, { merge: true });
      const g = await gather(cutoff);
      const { plan, staffByAmo } = g;
      const total = plan.create.length + plan.link.size + plan.tasks.length + plan.close.length;
      let done = 0;
      const tick = async () => {
        if (++done % 50 === 0) await META.set({ progress: { done, total } }, { merge: true });
      };
      // LID numbers counted once.
      let max = 0;
      for (const l of g.leads) {
        const m = /^LID-(\d+)$/.exec(l.lead_number || "");
        if (m) max = Math.max(max, Number(m[1]));
      }
      const realId = new Map(); // pseudo id → ERP id
      for (const { dealId, lead } of plan.create) {
        const { id: _i, isNew: _n, ...fields } = lead;
        const ref = await db.collection("leads").add({
          telegram: "", interested_product_id: "", interested_product_name: "", campaign_name: "", campaign_id: "", ad_set_name: "", ad_set_id: "", ad_name: "", ad_id: "", form_name: "", form_id: "",
          next_contact_at: null, first_contact_at: null, last_contact_at: null, lost_reason: "", lost_comment: "", converted_customer_id: null, converted_order_id: null, address: "",
          ...fields,
          status: ["advance", "production"].includes(fields.status) ? "offer" : fields.status,
          amo_ids: [dealId],
          lead_number: `LID-${String(++max).padStart(3, "0")}`,
        });
        realId.set(lead.id, ref.id);
        await db.collection("lead_activities").add({ lead_id: ref.id, text: `📥 amoCRM'dan zadachasi bilan ko'chirildi (bitim #${dealId}, «${stageLabel(g.deals.get(dealId).stageName)}»)`, actor_email: who.email, actor_name: who.name, created_at: now() });
        result.created++;
        await tick();
      }
      for (const { lead, deals } of plan.link.values()) {
        let patch = {};
        for (const dealId of deals) patch = { ...patch, ...fillBlanks({ ...lead, ...patch }, g.deals.get(dealId).lead) };
        if (lead.status === "lost") {
          Object.assign(patch, { status: "accepted", lost_reason: "", lost_comment: "" });
          result.reopened++;
        }
        await db.collection("leads").doc(lead.id).update({ ...patch, updated_at: now() });
        await db.collection("lead_activities").add({ lead_id: lead.id, text: `🔗 amoCRM bitim${deals.size > 1 ? "lari" : "i"} #${[...deals].join(", #")} zadachalari bilan shu lidga bog'landi${lead.status === "lost" ? " (lid qayta ochildi)" : ""}`, actor_email: who.email, actor_name: who.name, created_at: now() });
        result.linked++;
        await tick();
      }
      for (const { task, lead } of plan.tasks) {
        const id = realId.get(lead.id) || lead.id;
        const owner = staffByAmo.get(Number(task.responsible_user_id)) || { email: lead.assigned_to_email || "", name: lead.assigned_to_name || "" };
        await db.collection("lead_tasks").add({ ...toErpTask(task, { ...lead, id, assigned_to_email: owner.email, assigned_to_name: owner.name }), amo_task_id: Number(task.id), created_at: now() });
        result.tasks++;
        await tick();
      }
      // Old leads closed; their open tasks cancelled. Batched.
      const cancelByLead = new Map();
      for (const t of plan.cancel) {
        if (!cancelByLead.has(t.lead_id)) cancelByLead.set(t.lead_id, []);
        cancelByLead.get(t.lead_id).push(t);
      }
      let batch = db.batch();
      let n = 0;
      const flush = async (force) => {
        if (n && (force || n >= 400)) {
          await batch.commit();
          batch = db.batch();
          n = 0;
        }
      };
      for (const l of plan.close) {
        const t = now();
        batch.update(db.collection("leads").doc(l.id), { status: "lost", lost_reason: CLOSE_REASON, lost_comment: `ERP'ga o'tishda yopildi (${who.name})`, lost_at: t, updated_at: t });
        batch.set(db.collection("lead_activities").doc(), { lead_id: l.id, text: `🗄 Yopildi: ${CLOSE_REASON} — Mijozlar bazasiga o'tdi`, actor_email: who.email, actor_name: who.name, created_at: t });
        n += 2;
        for (const task of cancelByLead.get(l.id) || []) {
          batch.update(db.collection("lead_tasks").doc(task.id), { status: "done", cancelled: true, completed_at: t, result: "Bekor: lid yopildi (ERP'ga o'tish)" });
          n++;
          result.cancelled++;
        }
        result.closed++;
        await flush(false);
        await tick();
      }
      await flush(true);
      await META.set({ state: "done", finished_at: now(), progress: { done: total, total }, result, preview: null }, { merge: true });
      log.log(`switchover: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      await META.set({ state: "error", error: String(err.message || err), finished_at: now(), result }, { merge: true }).catch(() => undefined);
      throw err;
    } finally {
      running = false;
    }
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
    const dayOf = (req) => String((req.body && req.body.day) || (req.query && req.query.day) || "");
    app.post("/webhooks/crm/switchover/preview", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      if (running) return res.status(409).json({ error: "Ketyapti" });
      res.json({ ok: true });
      await META.set({ previewing: true, error: null }, { merge: true }).catch(() => undefined);
      preview(dayOf(req))
        .catch((err) => META.set({ error: String(err.message || err) }, { merge: true }).catch(() => undefined))
        .finally(() => META.set({ previewing: false }, { merge: true }).catch(() => undefined));
    });
    app.post("/webhooks/crm/switchover/run", async (req, res) => {
      const who = await owner(req, res);
      if (!who) return;
      if (running) return res.status(409).json({ error: "Ketyapti" });
      res.json({ ok: true });
      run(who, dayOf(req)).catch((err) => log.error("switchover failed:", err.message));
    });
  };

  return { preview, run, register };
};

module.exports = { create, planSwitch, cutoffOf, CLOSE_REASON, normalizePhone };
