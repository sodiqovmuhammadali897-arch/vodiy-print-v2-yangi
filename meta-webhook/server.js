// Standalone Meta (Facebook/Instagram) Lead Ads webhook receiver.
//
// Runs as its own always-on process on the VPS (see
// deploy/meta-webhook.service), independent of the static frontend and
// of Firebase Cloud Functions — it talks to Firestore directly with the
// Admin SDK, which needs a service account key but does NOT need the
// Blaze billing plan (that's only required for Cloud Functions/Storage).
//
// Flow: Meta calls GET once to verify this URL, then POST every time a
// person submits a Lead Ads form. The POST body only carries IDs
// (leadgen_id, form_id, ad_id, ...) — the actual answers are fetched
// separately from the Graph API using the Page access token.
const express = require("express");
const crypto = require("crypto");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const PORT = process.env.PORT || 8081;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./service-account.json";

if (!VERIFY_TOKEN || !APP_SECRET || !PAGE_ACCESS_TOKEN) {
  console.error(
    "META_VERIFY_TOKEN / META_APP_SECRET / META_PAGE_ACCESS_TOKEN not set — webhook cannot verify or fetch leads yet.",
  );
}

initializeApp({ credential: cert(require(SERVICE_ACCOUNT_PATH)) });
const db = getFirestore();

const app = express();
// Keep the raw body around (needed to check Meta's signature) while
// still parsing JSON for convenience.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const nextLeadNumber = async () => {
  const snap = await db.collection("leads").get();
  let max = 0;
  snap.forEach((doc) => {
    const m = /^LID-(\d+)$/.exec(doc.data().lead_number || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `LID-${String(max + 1).padStart(3, "0")}`;
};

const fieldValue = (fieldData, ...names) => {
  for (const f of fieldData || []) {
    if (names.includes((f.name || "").toLowerCase())) return (f.values || [])[0] || "";
  }
  return "";
};

// Best-effort — a failed name lookup should never block lead creation.
const graphName = async (id) => {
  if (!id) return "";
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`);
    const data = await res.json();
    return data.name || "";
  } catch {
    return "";
  }
};

const ingestLead = async (leadgenId, formId, adId, campaignId, adSetId) => {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`,
  );
  const lead = await res.json();
  if (lead.error) {
    console.error("Graph API lead fetch failed", lead.error);
    return;
  }

  const fieldData = lead.field_data || [];
  const fullName =
    fieldValue(fieldData, "full_name") ||
    [fieldValue(fieldData, "first_name"), fieldValue(fieldData, "last_name")].filter(Boolean).join(" ") ||
    "Noma'lum";
  const phone = fieldValue(fieldData, "phone_number", "phone");
  const telegram = (fieldData.find((f) => (f.name || "").toLowerCase().includes("telegram"))?.values || [])[0] || "";

  const [campaignName, adSetName, adName, formName] = await Promise.all([
    graphName(campaignId),
    graphName(adSetId),
    graphName(adId),
    graphName(formId),
  ]);

  const source = lead.platform === "ig" ? "Instagram Target" : "Facebook Lead Ads";
  const now = new Date().toISOString();
  const lead_number = await nextLeadNumber();

  await db.collection("leads").add({
    lead_number,
    full_name: fullName,
    brand: "",
    phone,
    telegram,
    interested_product_id: "",
    interested_product_name: "",
    source,
    campaign_name: campaignName,
    campaign_id: campaignId || "",
    ad_set_name: adSetName,
    ad_set_id: adSetId || "",
    ad_name: adName,
    ad_id: adId || "",
    form_name: formName,
    form_id: formId || "",
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

  if (source) await db.collection("lead_sources").doc(slugify(source)).set({ name: source }, { merge: true });
  if (campaignName) {
    await db
      .collection("lead_campaigns")
      .doc(campaignId || slugify(campaignName))
      .set({ name: campaignName, campaign_id: campaignId || "" }, { merge: true });
  }

  console.log(`Lead ingested: ${lead_number} (${fullName}, ${phone})`);
};

// Meta's one-time subscription handshake.
app.get("/webhooks/meta-leads", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

// Every actual leadgen notification.
app.post("/webhooks/meta-leads", async (req, res) => {
  const signature = req.get("x-hub-signature-256") || "";
  const expected =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.rawBody || Buffer.alloc(0)).digest("hex");
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.sendStatus(401);
  }

  // Ack immediately — Meta expects a fast 200, and retries on timeout.
  res.sendStatus(200);

  try {
    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;
        const v = change.value || {};
        await ingestLead(v.leadgen_id, v.form_id, v.ad_id, v.campaign_id, v.adgroup_id);
      }
    }
  } catch (err) {
    console.error("Failed to process leadgen webhook", err);
  }
});

app.get("/webhooks/meta-leads/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Meta leads webhook listening on :${PORT}`));
