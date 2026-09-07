import { upsertOne } from "./firestoreDb";

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Keeps lead_sources / lead_campaigns populated as real Firestore
// documents (ready for a future Meta Lead Ads webhook to write into
// directly) without needing a dedicated management screen yet.
export const ensureLeadSource = async (name: string): Promise<void> => {
  const trimmed = name.trim();
  const id = slugify(trimmed);
  if (!id) return;
  await upsertOne("lead_sources", id, { name: trimmed });
};

export const ensureLeadCampaign = async (name: string, campaignId: string): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const id = campaignId.trim() || slugify(trimmed);
  if (!id) return;
  await upsertOne("lead_campaigns", id, { name: trimmed, campaign_id: campaignId.trim() });
};
