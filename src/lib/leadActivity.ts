import { insertOne } from "./firestoreDb";

export const logLeadActivity = async (
  leadId: string,
  text: string,
  actorEmail: string,
  actorName: string,
): Promise<void> => {
  await insertOne("lead_activities", {
    lead_id: leadId,
    text,
    actor_email: actorEmail,
    actor_name: actorName || actorEmail,
  });
};
