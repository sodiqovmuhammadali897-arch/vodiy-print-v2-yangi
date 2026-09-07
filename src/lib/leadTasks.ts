import { insertOne, updateOne } from "./firestoreDb";
import { logLeadActivity } from "./leadActivity";
import { leadTaskTypeLabel } from "./orderConstants";
import type { LeadTask, LeadTaskType } from "./types";

export const createLeadTask = async (
  leadId: string,
  leadName: string,
  type: LeadTaskType,
  dueDate: string,
  dueTime: string,
  assignedEmail: string,
  assignedName: string,
  note: string,
  actorEmail: string,
  actorName: string,
): Promise<void> => {
  await insertOne("lead_tasks", {
    lead_id: leadId,
    lead_name: leadName,
    type,
    due_date: dueDate,
    due_time: dueTime,
    assigned_to_email: assignedEmail,
    assigned_to_name: assignedName,
    note,
    status: "open",
    completed_at: null,
  });
  await logLeadActivity(leadId, `Vazifa qo'shildi — ${leadTaskTypeLabel(type)}`, actorEmail, actorName);
};

export const completeLeadTask = async (task: LeadTask, actorEmail: string, actorName: string): Promise<void> => {
  await updateOne("lead_tasks", task.id, { status: "done", completed_at: new Date().toISOString() });
  await logLeadActivity(task.lead_id, `Vazifa bajarildi — ${leadTaskTypeLabel(task.type)}`, actorEmail, actorName);
};

// Marks a task done, then — per the "har bir lid javobsiz qolmasin"
// rule — asks whether a follow-up is needed and schedules one if so.
// Uses plain confirm/prompt rather than a modal: it's a single yes/no +
// date decision made right after clicking "Bajarildi", not worth a
// whole dialog component.
export const completeLeadTaskWithFollowUp = async (
  task: LeadTask,
  actorEmail: string,
  actorName: string,
): Promise<void> => {
  await completeLeadTask(task, actorEmail, actorName);
  if (!confirm("Keyingi aloqa kerakmi?")) return;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dueDate = prompt("Keyingi aloqa sanasi (YYYY-MM-DD):", tomorrow);
  if (!dueDate) return;
  await createLeadTask(
    task.lead_id,
    task.lead_name,
    "follow_up",
    dueDate,
    "10:00",
    task.assigned_to_email,
    task.assigned_to_name,
    "",
    actorEmail,
    actorName,
  );
};
