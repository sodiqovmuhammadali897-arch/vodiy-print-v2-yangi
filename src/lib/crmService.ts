// Database side of the ERP's CRM (lib/crm.ts has the rules). Every change
// to a lead also writes a line to its timeline (lead_activities).
import { getOne, insertOne, listAll, updateOne } from "./firestoreDb";
import { logLeadActivity } from "./leadActivity";
import { convertLeadToCustomer } from "./leadConversion";
import { changeOrderStatus } from "./orderStatus";
import { nextLeadNumber } from "./numbering";
import { columnLabel, taskTypeInfo, type CrmColumn } from "./crm";
import type { Lead, LeadTask } from "./types";

export type Actor = { email: string; name: string };

const now = () => new Date().toISOString();

export function blankCrmLead(actor: Actor): Omit<Lead, "id" | "lead_number" | "created_at" | "updated_at"> {
  return {
    full_name: "",
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
    assigned_to_email: actor.email,
    assigned_to_name: actor.name,
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
    customer_type: "",
    order_volume: "",
    payment_type: "",
    product_types: [],
    ready_date: null,
    address: "",
    tags: [],
  };
}

// A new lead with the next LID number and its first task («Qo'ng'iroq
// qilish» today, so no lead starts without one).
export async function createCrmLead(fields: Partial<Lead>, actor: Actor, firstTask: { date: string; time: string } | null): Promise<string> {
  const t = now();
  const lead_number = await nextLeadNumber();
  const created = await insertOne("leads", { ...blankCrmLead(actor), ...fields, lead_number, created_at: t, updated_at: t });
  await logLeadActivity(created.id, "Lid ochildi", actor.email, actor.name);
  if (firstTask) {
    await addLeadTask({ id: created.id, full_name: fields.full_name || fields.brand || lead_number, assigned_to_email: fields.assigned_to_email || actor.email, assigned_to_name: fields.assigned_to_name || actor.name }, "call", firstTask.date, firstTask.time, "", actor);
  }
  return created.id;
}

export async function updateCrmLead(id: string, patch: Partial<Lead>): Promise<void> {
  await updateOne("leads", id, { ...patch, updated_at: now() });
}

// Moves a lead to a board column. Up to «Taklif yuborildi» it is the
// lead's own stage; «Dizayn / avans» makes the customer and the order
// (lib/leadConversion); later columns move the order's status.
export async function moveToColumn(lead: Lead, col: CrmColumn, actor: Actor): Promise<{ orderId?: string }> {
  const t = now();
  if (col === "new" || col === "accepted" || col === "info_given" || col === "offer") {
    if (lead.converted_order_id) throw new Error("Bu lid buyurtmaga aylangan — bosqichi buyurtma holatidan olinadi.");
    if (lead.status === col) return {};
    await updateOne("leads", lead.id, { status: col, last_contact_at: t, first_contact_at: lead.first_contact_at || (col !== "new" ? t : null), updated_at: t });
    await logLeadActivity(lead.id, `Bosqich: ${columnLabel(lead.status === "telegram" ? "info_given" : (lead.status as CrmColumn))} → ${columnLabel(col)}`, actor.email, actor.name);
    return {};
  }
  if (!lead.converted_order_id) {
    const r = await convertLeadToCustomer(lead, actor.email, actor.name);
    if (col === "advance") return { orderId: r.orderId };
    await changeOrderStatus(r.orderId, col === "production" ? "production" : "delivered", actor);
    return { orderId: r.orderId };
  }
  if (col === "advance") return { orderId: lead.converted_order_id };
  await changeOrderStatus(lead.converted_order_id, col === "production" ? "production" : "delivered", actor);
  await logLeadActivity(lead.id, `Buyurtma holati: ${columnLabel(col)}`, actor.email, actor.name);
  return { orderId: lead.converted_order_id };
}

export async function addLeadTask(
  lead: Pick<Lead, "id" | "full_name" | "assigned_to_email" | "assigned_to_name">,
  type: string,
  date: string,
  time: string,
  note: string,
  actor: Actor,
): Promise<void> {
  await insertOne("lead_tasks", {
    lead_id: lead.id,
    lead_name: lead.full_name,
    type,
    due_date: date,
    due_time: time,
    assigned_to_email: lead.assigned_to_email || actor.email,
    assigned_to_name: lead.assigned_to_name || actor.name,
    note,
    status: "open",
    completed_at: null,
  });
  await logLeadActivity(lead.id, `Zadacha qo'yildi: ${taskTypeInfo(type).label} — ${date}${time ? " " + time : ""}${note ? ` (${note})` : ""}`, actor.email, actor.name);
}

// Done, with what came of it (required).
export async function completeLeadTask(task: LeadTask, result: string, actor: Actor): Promise<void> {
  const r = result.trim();
  if (!r) throw new Error("Natijani yozing");
  const t = now();
  await updateOne("lead_tasks", task.id, { status: "done", completed_at: t, result: r });
  await updateOne("leads", task.lead_id, { last_contact_at: t, updated_at: t }).catch(() => undefined);
  await logLeadActivity(task.lead_id, `Zadacha bajarildi: ${taskTypeInfo(task.type).label} — natija: ${r}`, actor.email, actor.name);
}

export async function addLeadNote(leadId: string, text: string, actor: Actor): Promise<void> {
  if (!text.trim()) return;
  await logLeadActivity(leadId, text.trim(), actor.email, actor.name);
}

export async function markCrmLost(lead: Lead, reason: string, comment: string, openTasks: LeadTask[], actor: Actor): Promise<void> {
  const t = now();
  await updateOne("leads", lead.id, { status: "lost", lost_reason: reason, lost_comment: comment, updated_at: t });
  for (const task of openTasks) await updateOne("lead_tasks", task.id, { status: "done", completed_at: t, result: "Lid yo'qotildi" });
  await logLeadActivity(lead.id, `Yo'qotildi — sabab: ${reason}${comment ? ` (${comment})` : ""}`, actor.email, actor.name);
}

// «✅ Qabul qildim»: a new unassigned lead becomes the presser's, moves to
// «Qabul qilindi», and its open unassigned tasks go with it. The same as the
// Telegram button (meta-webhook/leadClaim.js).
export async function claimLead(lead: Lead, openTasks: LeadTask[], actor: Actor): Promise<void> {
  const fresh = await getOne<Lead>("leads", lead.id);
  if (fresh?.assigned_to_email) throw new Error(`Bu lidni ${fresh.assigned_to_name || fresh.assigned_to_email} allaqachon olgan`);
  const t = now();
  await updateOne("leads", lead.id, {
    assigned_to_email: actor.email,
    assigned_to_name: actor.name,
    ...(lead.status === "new" ? { status: "accepted" } : {}),
    first_contact_at: lead.first_contact_at || t,
    updated_at: t,
  });
  for (const task of openTasks) if (!task.assigned_to_email) await updateOne("lead_tasks", task.id, { assigned_to_email: actor.email, assigned_to_name: actor.name });
  await logLeadActivity(lead.id, `✅ ${actor.name} qabul qildi`, actor.email, actor.name);
}

export async function reopenLead(lead: Lead, actor: Actor): Promise<void> {
  await updateOne("leads", lead.id, { status: "accepted", lost_reason: "", lost_comment: "", updated_at: now() });
  await logLeadActivity(lead.id, "Lid qayta ochildi", actor.email, actor.name);
}

// A phone that already has a lead (open or not) — to warn before a duplicate.
export async function leadByPhone(phone: string): Promise<Lead | null> {
  const d = String(phone || "").replace(/\D/g, "").slice(-9);
  if (d.length < 9) return null;
  const leads = await listAll<Lead>("leads");
  return leads.find((l) => String(l.phone || "").replace(/\D/g, "").slice(-9) === d) || null;
}
