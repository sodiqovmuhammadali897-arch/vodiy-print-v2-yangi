// Facebook/Instagram form leads by reading the forms (2026-11-13). Meta did
// not deliver the leadgen webhook (nginx saw no POST while the forms got
// leads; the app is likely in Development mode), but the Page key can read
// each form's leads. Every 3 minutes: the Page's ACTIVE forms (list kept
// 30 minutes), then each form's leads created after the last check, each
// handed to server.js's ingestLead (meta_leads/{id} makes it once even if
// the webhook starts working). It starts from the moment it first runs —
// older leads are not brought in. LEAD_POLL=off turns it off.
const POLL_MS = 3 * 60 * 1000;
const FORMS_TTL_MS = 30 * 60 * 1000;
const OVERLAP_S = 120; // read a little back; duplicates are refused anyway
const FIELDS = "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic";

// Unix seconds of a Graph time ("2026-11-13T18:21:38+0000").
const unix = (t) => Math.floor(Date.parse(String(t).replace(/\+0000$/, "Z")) / 1000);

// Where to start next time: the newest lead seen, a little back.
function nextSince(leads, since) {
  const newest = Math.max(since, ...leads.map((l) => unix(l.created_time)).filter(Number.isFinite));
  return Math.max(since, newest - OVERLAP_S);
}

const leadsPath = (formId, since) =>
  `${formId}/leads?fields=${FIELDS}&limit=100&filtering=${encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]))}`;

const create = (db, { token, graphVersion = "v19.0", ingest, log = console, fetchImpl = fetch }) => {
  const on = Boolean(token) && process.env.LEAD_POLL !== "off";
  const state = db.collection("crm_meta").doc("meta_poll");
  let forms = null;
  let formsAt = 0;
  let running = false;
  let timer = null;

  const graph = async (path) => {
    const r = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error(j.error.message || "Graph xatosi");
    return j;
  };

  const activeForms = async () => {
    if (forms && Date.now() - formsAt < FORMS_TTL_MS) return forms;
    const j = await graph("me/leadgen_forms?fields=id,name,status&limit=100");
    forms = (j.data || []).filter((f) => f.status === "ACTIVE");
    formsAt = Date.now();
    return forms;
  };

  const tick = async () => {
    if (!on || running) return;
    running = true;
    try {
      const snap = await state.get();
      const now = Math.floor(Date.now() / 1000);
      if (!snap.exists) {
        await state.set({ since: now, started_at: new Date().toISOString() });
        log.log("Lead poll: started — form leads from now on");
        return;
      }
      const since = Number(snap.data().since) || now;
      let next = since;
      let taken = 0;
      for (const f of await activeForms()) {
        const j = await graph(leadsPath(f.id, since));
        const leads = j.data || [];
        for (const l of leads.sort((a, b) => unix(a.created_time) - unix(b.created_time))) {
          await ingest(l.id, f.id, l.ad_id, l.campaign_id, l.adset_id, { ...l, form_name: f.name }, "poll");
          taken++;
        }
        next = Math.max(next, nextSince(leads, since));
      }
      await state.set({ since: next, last_run: new Date().toISOString(), last_count: taken }, { merge: true });
      if (taken) log.log(`Lead poll: ${taken} form lead(s) checked`);
    } catch (err) {
      log.error("Lead poll failed:", err.message);
      await state.set({ last_error: String(err.message).slice(0, 200), last_error_at: new Date().toISOString() }, { merge: true }).catch(() => {});
    } finally {
      running = false;
    }
  };

  const start = () => {
    if (!on) return log.log("Lead poll: off");
    void tick();
    timer = setInterval(() => void tick(), POLL_MS);
  };
  const stop = () => clearInterval(timer);
  return { start, stop, tick };
};

module.exports = { create, nextSince, leadsPath, unix };
