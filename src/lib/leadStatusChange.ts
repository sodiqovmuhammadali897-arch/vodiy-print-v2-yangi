import { updateOne } from "./firestoreDb";
import { changeOrderStatus } from "./orderStatus";
import { logLeadActivity } from "./leadActivity";
import { convertLeadToCustomer } from "./leadConversion";
import { leadStatusInfo, LEAD_STAGE_TO_ORDER_STATUS } from "./orderConstants";
import type { Lead, LeadStatus } from "./types";

export type LeadActor = { email: string; name: string };

// Moves a lead's Kanban card to `next`. Pre-conversion stages just
// update the lead; "advance" triggers full conversion (Customer +
// Order created, or an existing Customer reused by phone); the four
// production stages update the linked Order instead of the lead
// itself, since the Order is the single source of truth once a lead
// has converted. "lost" is out of scope here — it always goes through
// markLeadLost below, which requires a reason.
export const moveLead = async (lead: Lead, next: LeadStatus, actor: LeadActor): Promise<void> => {
  if (next === lead.status) return;
  if (next === "lost") {
    throw new Error("Yo'qotilgan sababini tanlash oynasi orqali kiriting.");
  }

  if (next === "advance") {
    if (!lead.converted_order_id) {
      await convertLeadToCustomer(lead, actor.email, actor.name);
    }
    return;
  }

  if (next === "design" || next === "production" || next === "ready" || next === "delivered") {
    if (!lead.converted_order_id) {
      throw new Error("Bu lid hali buyurtmaga aylantirilmagan — avval \"Avans\"ga o'tkazing.");
    }
    await changeOrderStatus(lead.converted_order_id, LEAD_STAGE_TO_ORDER_STATUS[next], actor);
    await logLeadActivity(
      lead.id,
      `Buyurtma holati "${leadStatusInfo(next).label}"ga o'zgardi`,
      actor.email,
      actor.name,
    );
    return;
  }

  // new / info_given / telegram — free manual movement
  const now = new Date().toISOString();
  await updateOne("leads", lead.id, {
    status: next,
    last_contact_at: now,
    first_contact_at: lead.first_contact_at || now,
    updated_at: now,
  });
  await logLeadActivity(
    lead.id,
    `Status "${leadStatusInfo(lead.status).label}" → "${leadStatusInfo(next).label}"`,
    actor.email,
    actor.name,
  );
};

export const markLeadLost = async (
  lead: Lead,
  reason: string,
  comment: string,
  actor: LeadActor,
): Promise<void> => {
  await updateOne("leads", lead.id, {
    status: "lost",
    lost_reason: reason,
    lost_comment: comment,
    updated_at: new Date().toISOString(),
  });
  await logLeadActivity(
    lead.id,
    `Yo'qotildi — sabab: ${reason}${comment ? ` (${comment})` : ""}`,
    actor.email,
    actor.name,
  );
};
