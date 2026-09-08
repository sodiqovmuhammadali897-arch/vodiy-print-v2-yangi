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

// Mois Zvonki (telephony/call-recording) integration — see the
// "Mois Zvonki" section further down. Independent of the Meta config
// above; simply skips itself until all four are set.
const MOIZVONKI_DOMAIN = process.env.MOIZVONKI_DOMAIN || "";
const MOIZVONKI_USER_EMAIL = process.env.MOIZVONKI_USER_EMAIL || "";
const MOIZVONKI_API_KEY = process.env.MOIZVONKI_API_KEY || "";
const MOIZVONKI_WEBHOOK_TOKEN = process.env.MOIZVONKI_WEBHOOK_TOKEN || "";
const MOIZVONKI_CALLBACK_BASE = process.env.MOIZVONKI_CALLBACK_BASE || "https://printvodiy.uz";
const MOIZVONKI_CONFIGURED = Boolean(
  MOIZVONKI_DOMAIN && MOIZVONKI_USER_EMAIL && MOIZVONKI_API_KEY && MOIZVONKI_WEBHOOK_TOKEN,
);
if (!MOIZVONKI_CONFIGURED) {
  console.log("MOIZVONKI_* env not fully set — call webhook not subscribed yet.");
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

// ── Mois Zvonki (call recording / telephony) ─────────────────────────
// Opposite shape from the Meta integration above: Mois Zvonki exposes its
// own REST API (https://www.moizvonki.ru/guide/api/) that we call both to
// register a webhook subscription (once, on boot) and — unlike Meta — it
// then pushes every call.start/answer/finish event to us as plain POST
// JSON with no signature, so the subscribed URL carries a shared-secret
// query token instead.

// Strips everything but digits so "+998 90 123 45 67", "998901234567"
// and "90 123 45 67" all compare equal — mirrors src/lib/format.ts's
// normalizePhone (this service can't import frontend TS directly).
const normalizePhone = (phone) => (phone || "").replace(/\D/g, "").slice(-9);

const moizvonkiCall = async (action, params = {}) => {
  const res = await fetch(`https://${MOIZVONKI_DOMAIN}/api/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: MOIZVONKI_USER_EMAIL, api_key: MOIZVONKI_API_KEY, action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mois Zvonki API xatosi (${action}): ${JSON.stringify(data)}`);
  return data;
};

const findByPhone = async (collection, phone) => {
  const target = normalizePhone(phone);
  if (!target) return null;
  const snap = await db.collection(collection).get();
  let found = null;
  snap.forEach((doc) => {
    if (found) return;
    if (normalizePhone(doc.data().phone) === target) found = { id: doc.id, ...doc.data() };
  });
  return found;
};

const formatCallDuration = (seconds) => {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} daq ${r} son` : `${r} soniya`;
};

const handleCallFinish = async (event) => {
  const {
    direction,
    client_number: clientNumber,
    client_name: clientName,
    start_time: startTime,
    answer_time: answerTime,
    end_time: endTime,
    duration,
    answered,
    recording,
  } = event || {};

  const now = new Date().toISOString();
  const isIncoming = direction !== 1;
  const directionLabel = isIncoming ? "Kiruvchi" : "Chiquvchi";
  const answeredLabel = answered ? "javob berildi" : "javob berilmadi";
  const durationLabel = formatCallDuration(duration);

  let lead = await findByPhone("leads", clientNumber);
  const customer = lead ? null : await findByPhone("customers", clientNumber);

  // No existing lead/customer on an incoming call — this is a fresh
  // enquiry over the phone, so it becomes a lead like any other channel
  // (a call should never go untracked, same rule as the Meta leads).
  if (!lead && !customer && isIncoming) {
    const lead_number = await nextLeadNumber();
    const ref = await db.collection("leads").add({
      lead_number,
      full_name: clientName || "Noma'lum (qo'ng'iroq)",
      brand: "",
      phone: clientNumber || "",
      telegram: "",
      interested_product_id: "",
      interested_product_name: "",
      source: "Telefon qo'ng'irog'i",
      campaign_name: "",
      campaign_id: "",
      ad_set_name: "",
      ad_set_id: "",
      ad_name: "",
      ad_id: "",
      form_name: "",
      form_id: "",
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
    lead = { id: ref.id, lead_number };
    await db.collection("lead_sources").doc("telefon-qongirogi").set({ name: "Telefon qo'ng'irog'i" }, { merge: true });
    console.log(`Call created new lead: ${lead_number} (${clientNumber})`);
  }

  await db.collection("calls").add({
    lead_id: lead ? lead.id : null,
    customer_id: customer ? customer.id : null,
    phone: clientNumber || "",
    client_name: clientName || "",
    direction: isIncoming ? "in" : "out",
    answered: Boolean(answered),
    duration_seconds: Number(duration) || 0,
    recording_url: recording || "",
    start_time: startTime ? new Date(startTime * 1000).toISOString() : null,
    answer_time: answerTime ? new Date(answerTime * 1000).toISOString() : null,
    end_time: endTime ? new Date(endTime * 1000).toISOString() : null,
    created_at: now,
  });

  if (lead) {
    await db.collection("lead_activities").add({
      lead_id: lead.id,
      text: `📞 ${directionLabel} qo'ng'iroq — ${durationLabel}, ${answeredLabel}`,
      actor_email: "system",
      actor_name: "Mois Zvonki",
      created_at: now,
      kind: "call",
      call_direction: isIncoming ? "in" : "out",
      call_answered: Boolean(answered),
      call_duration_seconds: Number(duration) || 0,
      call_recording_url: recording || "",
    });
    await db.collection("leads").doc(lead.id).update({ last_contact_at: now, updated_at: now });
  }

  console.log(
    `Call logged: ${clientNumber} (${directionLabel}, ${durationLabel})` +
      (lead ? ` -> lead ${lead.lead_number || lead.id}` : customer ? ` -> customer ${customer.id}` : " (no match)"),
  );
};

app.post("/webhooks/moizvonki-calls", async (req, res) => {
  if (!MOIZVONKI_WEBHOOK_TOKEN || req.query.token !== MOIZVONKI_WEBHOOK_TOKEN) {
    return res.sendStatus(401);
  }

  // Ack immediately, same as the Meta handler — process after responding.
  res.sendStatus(200);

  try {
    const action = req.body && req.body.webhook && req.body.webhook.action;
    const event = req.body && req.body.event;
    if (action === "call.finish" && event) {
      await handleCallFinish(event);
    }
  } catch (err) {
    console.error("Failed to process Mois Zvonki webhook", err);
  }
});

app.get("/webhooks/moizvonki-calls/health", (_req, res) => res.json({ ok: true }));

// One-time (safe to repeat on every restart — re-subscribing just
// replaces the handler URL for the same events) registration of the
// call-finish webhook with Mois Zvonki, from the account Administrator.
const subscribeMoizvonkiWebhook = async () => {
  if (!MOIZVONKI_CONFIGURED) return;
  const url = `${MOIZVONKI_CALLBACK_BASE}/webhooks/moizvonki-calls?token=${MOIZVONKI_WEBHOOK_TOKEN}`;
  try {
    await moizvonkiCall("webhook.subscribe", {
      hooks: { "call.finish": url },
    });
    console.log("Mois Zvonki call.finish webhook subscribed:", url);
  } catch (err) {
    console.error("Mois Zvonki webhook subscribe failed", err);
  }
};

app.listen(PORT, () => {
  console.log(`Meta leads webhook listening on :${PORT}`);
  void subscribeMoizvonkiWebhook();
});
