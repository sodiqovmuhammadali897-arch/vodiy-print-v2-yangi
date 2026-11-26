const BT = require("./botTasks");
// «✅ Qabul qildim» (the owner, 2026-11-13: «lid managerga biriktirilishi
// shartmas, yangi lidga tushsin, manager o'ziga olsin qabul qildim qilib»).
// A new internet lead (Facebook form, Instagram, the site form) comes in
// unassigned, in «Yangi»; its Telegram message carries the button, and the
// first employee who presses it takes the lead: it becomes theirs, moves
// to «Qabul qilindi», and its open tasks go to them. The ERP's lead page
// has the same button (src/lib/crmService.ts claimLead).
const { telegram } = require("./telegram");

const button = (leadId) => ({ inline_keyboard: [[{ text: "✅ Qabul qildim", callback_data: `lc:${leadId}` }]] });
const hm = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16);
const takenLine = (name, iso) => `✅ Qabul qildi: ${name} · ${hm(iso)}`;

// What a claim does to the lead, or why it can't: pure, for tests.
function claimPatch(lead, who, now) {
  if (!lead) return { error: "Lid topilmadi" };
  if (lead.status === "lost") return { error: "Bu lid yopilgan" };
  if (lead.assigned_to_email) return { taken: lead.assigned_to_name || lead.assigned_to_email };
  return {
    patch: {
      assigned_to_email: who.email,
      assigned_to_name: who.name,
      ...(lead.status === "new" ? { status: "accepted" } : {}),
      first_contact_at: lead.first_contact_at || now,
      updated_at: now,
    },
  };
}

const create = (db, { route = null, salesTargets = null, managersTarget = null } = {}) => {
  // Every message that carries a lead's button, so taking it in one group
  // updates the others (lead_posts/{leadId}.posts: chat, message, text).
  const record = async (leadId, posts) => {
    if (!leadId || !posts.length) return;
    const ref = db.collection("lead_posts").doc(String(leadId));
    const prev = ((await ref.get()).data() || {}).posts || [];
    await ref.set({ posts: [...prev, ...posts], updated_at: new Date().toISOString() });
  };
  const sendTo = async (leadId, text, targets) => {
    const posts = [];
    for (const t of targets) {
      try {
        const r = await telegram("sendMessage", { ...t, text, reply_markup: button(leadId), link_preview_options: { is_disabled: true } });
        if (r && r.ok && r.result) posts.push({ chat_id: t.chat_id, message_id: r.result.message_id, text });
      } catch (err) {
        console.error("Lead announce failed", err.message);
      }
    }
    await record(leadId, posts).catch(() => undefined);
    return posts;
  };
  // A new lead with the button: the work group's Sotuv topic and the
  // managers' group (groups.js salesTargets).
  const announce = async (leadId, text) => {
    const targets = salesTargets ? await salesTargets() : route ? [await route("sales")] : [];
    return sendTo(leadId, text, targets);
  };
  // Only the managers' group (for leads whose main message went elsewhere —
  // Instagram's own topic, the site form with its file).
  const toManagers = async (leadId, text) => {
    const t = managersTarget ? await managersTarget() : null;
    return t ? sendTo(leadId, text, [t]) : [];
  };

  // Takes the lead for `who` ({email, name}); safe when two press at once.
  const claim = async (leadId, who) => {
    const ref = db.collection("leads").doc(String(leadId));
    const now = new Date().toISOString();
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const r = claimPatch(snap.exists ? snap.data() : null, who, now);
      if (r.patch) tx.update(ref, r.patch);
      return r;
    });
    if (!out.patch) return out;
    const tasks = await db.collection("lead_tasks").where("lead_id", "==", String(leadId)).get();
    for (const d of tasks.docs) {
      const t = d.data();
      if (t.status === "open" && !t.assigned_to_email) await d.ref.update({ assigned_to_email: who.email, assigned_to_name: who.name });
    }
    await db.collection("lead_activities").add({ lead_id: String(leadId), text: `✅ ${who.name} qabul qildi`, actor_email: who.email, actor_name: who.name, created_at: now });
    return { ok: true, at: now };
  };

  // Telegram button: the presser is found by their linked Telegram chat.
  const handleCallback = async (cq) => {
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text, show_alert: true } : {}) });
    const m = String(cq.data || "").match(/^lc:([\w-]+)$/);
    if (!m) return answer();
    const userId = cq.from && cq.from.id;
    const staff = (await db.collection("staff").where("telegram_chat_id", "in", [Number(userId), String(userId)]).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const s = staff.find((x) => x.active !== false && x.is_active !== false);
    if (!s) return answer("Telegram'ingiz ERP'dagi xodimga ulanmagan — rahbarga ayting");
    if (s.role !== "admin" && !BT.wants(s, "leads")) return answer("Sizga lid olish belgilanmagan — rahbarga ayting (Xodimlar → «Bot unga nima bersin»)");
    const who = { email: String(s.id).toLowerCase(), name: s.full_name || s.id };
    const r = await claim(m[1], who);
    const msg = cq.message;
    // The pressed message and every other copy of this lead (other group).
    const edit = async (line) => {
      const posts = ((await db.collection("lead_posts").doc(m[1]).get().catch(() => null))?.data?.() || {}).posts || [];
      const all = [...posts];
      if (msg && !all.some((p) => String(p.chat_id) === String(msg.chat.id) && p.message_id === msg.message_id)) all.push({ chat_id: msg.chat.id, message_id: msg.message_id, text: msg.text || msg.caption || "", caption: !msg.text && Boolean(msg.caption) });
      for (const p of all)
        if (p.caption) await telegram("editMessageCaption", { chat_id: p.chat_id, message_id: p.message_id, caption: `${p.text || ""}\n\n${line}`.slice(0, 1024) }).catch(() => {});
        else await telegram("editMessageText", { chat_id: p.chat_id, message_id: p.message_id, text: `${p.text || ""}\n\n${line}`, link_preview_options: { is_disabled: true } }).catch(() => {});
    };
    if (r.ok) {
      await answer();
      await edit(takenLine(who.name, r.at));
      return;
    }
    if (r.taken) {
      await answer(`Bu lidni ${r.taken} allaqachon olgan`);
      await edit(`✅ Qabul qilgan: ${r.taken}`);
      return;
    }
    await answer(r.error || "Bo'lmadi");
  };

  return { announce, toManagers, record, claim, handleCallback, button };
};

module.exports = { create, claimPatch, button, takenLine };
