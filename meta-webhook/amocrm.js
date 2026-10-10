// amoCRM → ERP, read only: the "amoCRM tahlil" tab in Sotuv bo'limi.
//
// Every couple of minutes the server pulls from amoCRM (API v4, long-lived
// token): users, pipelines and their stages, leads (stage, manager, price,
// source, loss reason, dates) and call notes (Mois Zvonki writes each call
// into amoCRM with its duration). Nothing is written back to amoCRM, no
// chat or call content is read, and no lead is created in the ERP.
//
// Tasks (zadachalar) are pulled too, for the KPI: per manager and month,
// amo_tasks/{YYYY-MM}_{amoUserId} — how many came due, how many were done
// on time (see amoTasks.js) — and, with the Telegram bot on, each manager
// gets the day's tasks at 09:00 and what is left of them at 18:00.
//
// For those Telegram notes the server also looks up the customer (the
// lead's main contact: name and phone) when a task is named in a message;
// that stays in memory and in the message, never in Firestore.
//
// The raw data stays in this process's memory (it is reloaded from amoCRM
// on start); Firestore only gets the counts, one doc per manager per month
// (amo_stats/{YYYY-MM}_{amoUserId}), so a manager can be allowed to read
// just their own doc and the page reads a handful of docs, not thousands.
const crypto = require("crypto");
const T = require("./amoTasks");

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const WON = 142;
const LOST = 143;
const POLL_MS = 2 * 60 * 1000;
const META_EVERY_MS = 30 * 60 * 1000;
const STALE_DAYS = 3;
const CALL_TYPES = ["call_in", "call_out"];

const dayOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const monthOf = (ms) => dayOf(ms).slice(0, 7);
const hmOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(11, 16);
const monthStartMs = (month) => Date.parse(`${month}-01T00:00:00Z`) - TZ_OFFSET_MS;
const prevMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// "vodiyprint", "vodiyprint.amocrm.ru" or "https://vodiyprint.amocrm.ru/".
const hostOf = (v) => {
  const s = String(v || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return !s ? "" : s.includes(".") ? s : `${s}.amocrm.ru`;
};

// A call is counted per person called, not per note: the phone (hashed —
// the number itself is never stored) or else the card it was logged on.
const callKey = (note) => {
  const digits = String((note.params && note.params.phone) || "").replace(/\D/g, "").slice(-9);
  if (digits.length >= 7) return crypto.createHash("sha1").update(digits).digest("hex").slice(0, 12);
  return `e${note.entity_type || ""}${note.entity_id || note.id}`;
};

// "+998901234567" → "+998 90 123 45 67"; anything else as written.
const phoneLabel = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  const n = d.length === 9 ? `998${d}` : d;
  return n.length === 12 && n.startsWith("998") ? `+998 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8, 10)} ${n.slice(10, 12)}` : String(v || "").trim();
};

const toContact = (c) => {
  const phone = ((c.custom_fields_values || []).find((f) => f.field_code === "PHONE") || { values: [] }).values[0];
  return { name: String(c.name || "").trim().slice(0, 80), phone: phone ? phoneLabel(phone.value) : "" };
};

const toLead = (l, sources) => {
  const emb = l._embedded || {};
  const loss = (emb.loss_reason || [])[0];
  const contacts = emb.contacts || [];
  const main = contacts.find((c) => c.is_main) || contacts[0];
  const tag = (emb.tags || [])[0];
  return {
    id: l.id,
    created: Number(l.created_at || 0) * 1000,
    updated: Number(l.updated_at || l.created_at || 0) * 1000,
    closed: l.closed_at ? Number(l.closed_at) * 1000 : null,
    status: Number(l.status_id || 0),
    pipeline: Number(l.pipeline_id || 0),
    user: Number(l.responsible_user_id || 0),
    name: String(l.name || "").slice(0, 120),
    contact: main ? Number(main.id) : null,
    price: Number(l.price || 0),
    loss: loss ? loss.name : null,
    source: (l.source_id && sources.get(Number(l.source_id))) || (tag && tag.name) || "Noma'lum",
  };
};

const toCall = (n) => ({
  id: (n.params && n.params.uniq) || `${n.entity_type || ""}${n.id}`,
  user: Number(n.created_by || n.responsible_user_id || 0),
  at: Number(n.created_at || 0) * 1000,
  duration: Math.max(0, Number((n.params && n.params.duration) || 0)),
  dir: n.note_type === "call_in" ? "in" : "out",
  key: callKey(n),
});

// Counts for one month, one doc per amoCRM user (0 = no manager). `open`,
// `stale` and `funnel` are the state right now; everything else is what
// happened in the month.
function computeStats(month, { leads, calls, now }) {
  const start = monthStartMs(month);
  const end = monthStartMs(nextMonth(month));
  const inMonth = (ms) => ms >= start && ms < end;
  const isCurrent = inMonth(now);
  const today = dayOf(now);
  const by = new Map();
  const of = (user) => {
    if (!by.has(user)) {
      by.set(user, {
        leads: { created: 0, won: 0, lost: 0, won_amount: 0, open: 0, stale: 0 },
        calls: { total: 0, answered: 0, talk_sec: 0, in: 0, out: 0, talked: 0 },
        today: { day: today, total: 0, answered: 0, talk_sec: 0, talked: 0, first: null, last: null },
        funnel: {},
        sources: {},
        loss: {},
        daily: {},
        _talked: new Set(),
        _todayTalked: new Set(),
      });
    }
    return by.get(user);
  };
  const day = (s, d) => (s.daily[d] = s.daily[d] || { leads: 0, calls: 0, talk_sec: 0 });

  for (const l of leads) {
    if (inMonth(l.created)) {
      const s = of(l.user);
      s.leads.created++;
      s.sources[l.source] = (s.sources[l.source] || 0) + 1;
      day(s, dayOf(l.created)).leads++;
    }
    const closedAt = l.closed || l.updated;
    if ((l.status === WON || l.status === LOST) && inMonth(closedAt)) {
      const s = of(l.user);
      if (l.status === WON) {
        s.leads.won++;
        s.leads.won_amount += l.price;
      } else {
        s.leads.lost++;
        const r = l.loss || "Sabab ko'rsatilmagan";
        s.loss[r] = (s.loss[r] || 0) + 1;
      }
    }
    if (isCurrent && l.status !== WON && l.status !== LOST) {
      const s = of(l.user);
      s.leads.open++;
      if (now - l.updated > STALE_DAYS * 86400000) s.leads.stale++;
      const k = `${l.pipeline}:${l.status}`;
      s.funnel[k] = (s.funnel[k] || 0) + 1;
    }
  }

  for (const c of calls) {
    if (!inMonth(c.at)) continue;
    const s = of(c.user);
    const d = dayOf(c.at);
    s.calls.total++;
    s.calls[c.dir]++;
    day(s, d).calls++;
    if (c.duration > 0) {
      s.calls.answered++;
      s.calls.talk_sec += c.duration;
      s._talked.add(c.key);
      day(s, d).talk_sec += c.duration;
    }
    if (d === today) {
      const t = s.today;
      t.total++;
      if (c.duration > 0) {
        t.answered++;
        t.talk_sec += c.duration;
        s._todayTalked.add(c.key);
      }
      const hm = hmOf(c.at);
      if (!t.first || hm < t.first) t.first = hm;
      if (!t.last || hm > t.last) t.last = hm;
    }
  }

  const out = new Map();
  for (const [user, s] of by) {
    s.calls.talked = s._talked.size;
    s.today.talked = s._todayTalked.size;
    delete s._talked;
    delete s._todayTalked;
    if (!isCurrent) s.today = null;
    out.set(user, s);
  }
  return out;
}

function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const create = (db, { subdomain = process.env.AMO_SUBDOMAIN, token = process.env.AMO_TOKEN, fetchImpl = fetch, log = console, notify = null } = {}) => {
  const host = hostOf(subdomain);
  const enabled = Boolean(host && token);
  const users = new Map(); // id → { id, name, email }
  const statuses = {}; // "pipeline:status" → { name, pipeline, sort, color }
  const sources = new Map();
  const leads = new Map();
  const calls = new Map();
  let unsorted = new Map(); // lead id → lead, still in "Неразобранное"
  let leadsSince = 0;
  let notesSince = 0;
  let metaAt = 0;
  let staffAt = 0;
  let staffByUser = new Map();
  let staffInfo = new Map(); // email → { chat, admin }
  const tasks = new Map();
  let tasksSince = 0;
  let tasksError = null;
  const misses = new Map(); // task id → { month, user, due }
  const contacts = new Map(); // contact id → { name, phone, at }
  let missesLoaded = false;
  let reminders = null; // { morning: "YYYY-MM-DD", evening: … }
  let timer = null;
  let running = false;
  const written = new Map(); // doc id → JSON last written

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const api = async (path, params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchImpl(`https://${host}/api/v4/${path}${qs.toString() ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        // A hung request would stop every later sync (one runs at a time).
        signal: AbortSignal.timeout(30 * 1000),
      });
      if (res.status === 204) return null;
      if (res.status === 429) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (res.status === 401) throw new Error("amoCRM token yaroqsiz yoki muddati o'tgan (401)");
      if (!res.ok) throw new Error(`amoCRM ${path}: HTTP ${res.status}`);
      return res.json();
    }
    throw new Error(`amoCRM ${path}: juda ko'p so'rov (429)`);
  };

  const pageAll = async (path, params, key) => {
    const out = [];
    for (let page = 1; page < 400; page++) {
      const data = await api(path, { ...params, limit: 250, page });
      const rows = (data && data._embedded && data._embedded[key]) || [];
      out.push(...rows);
      if (!rows.length || !(data._links && data._links.next)) break;
      await sleep(150); // amoCRM allows ~7 requests a second
    }
    return out;
  };

  const loadMeta = async () => {
    const [us, pipes] = await Promise.all([pageAll("users", {}, "users"), pageAll("leads/pipelines", {}, "pipelines")]);
    users.clear();
    for (const u of us) users.set(Number(u.id), { id: Number(u.id), name: u.name || `#${u.id}`, email: String(u.email || "").toLowerCase() });
    for (const k of Object.keys(statuses)) delete statuses[k];
    for (const p of pipes) {
      for (const s of (p._embedded && p._embedded.statuses) || []) {
        statuses[`${p.id}:${s.id}`] = { name: s.name, pipeline: p.name, pipeline_sort: Number(p.sort || 0), sort: Number(s.sort || 0), color: s.color || null };
      }
    }
    try {
      const srcs = await pageAll("sources", {}, "sources");
      sources.clear();
      for (const s of srcs) sources.set(Number(s.id), s.name);
    } catch {
      // Sources are optional (only integrations create them); tags stand in.
    }
    metaAt = Date.now();
  };

  const loadStaff = async () => {
    const snap = await db.collection("staff").get();
    const byEmail = new Map();
    const byId = new Map();
    staffInfo = new Map();
    for (const d of snap.docs) {
      const s = d.data();
      const email = String(s.email || d.id).toLowerCase();
      byEmail.set(email, email);
      staffInfo.set(email, { chat: s.telegram_chat_id || null, admin: s.role === "admin" && !s.report_manager_id, name: s.full_name || email });
      if (s.amo_user_id) byId.set(Number(s.amo_user_id), email);
    }
    staffByUser = new Map();
    for (const u of users.values()) {
      const email = byId.get(u.id) || (u.email && byEmail.get(u.email)) || null;
      if (email) staffByUser.set(u.id, email);
    }
    staffAt = Date.now();
  };

  const pullLeads = async (since) => {
    const params = { with: "loss_reason,source_id,contacts" };
    if (since) params["filter[updated_at][from]"] = Math.floor(since / 1000);
    const rows = await pageAll("leads", params, "leads");
    for (const l of rows) leads.set(Number(l.id), toLead(l, sources));
    return rows.length;
  };

  // Incoming requests (chats, calls, forms) wait in "Неразобранное" until a
  // manager accepts them; they are leads too. Rebuilt every time, since an
  // accepted one moves to the normal list and a declined one disappears.
  const pullUnsorted = async () => {
    let rows = [];
    try {
      rows = await pageAll("leads/unsorted", {}, "unsorted");
    } catch (err) {
      log.error("amoCRM unsorted failed", err.message || err);
      return 0;
    }
    const next = new Map();
    for (const u of rows) {
      const lead = ((u._embedded && u._embedded.leads) || [])[0];
      const id = Number((lead && lead.id) || 0) || `u${u.uid}`;
      next.set(id, {
        id,
        created: Number(u.created_at || 0) * 1000,
        updated: Number(u.created_at || 0) * 1000,
        closed: null,
        status: -1,
        pipeline: Number(u.pipeline_id || 0),
        user: 0,
        price: 0,
        loss: null,
        source: u.source_name || u.category || "Noma'lum",
      });
    }
    unsorted = next;
    return rows.length;
  };

  const pullCalls = async (since) => {
    let n = 0;
    for (const entity of ["leads", "contacts"]) {
      const rows = await pageAll(`${entity}/notes`, { "filter[note_type][]": CALL_TYPES, "filter[updated_at][from]": Math.floor(since / 1000) }, "notes");
      for (const note of rows) {
        const c = toCall({ ...note, entity_type: entity[0] });
        calls.set(c.id, c);
      }
      n += rows.length;
    }
    return n;
  };

  // Every open task, plus everything changed since last month began; then
  // only what changed. A failure here never stops the lead/call sync.
  const pullTasks = async (since, now) => {
    if (!since) {
      const [open, recent] = await Promise.all([
        pageAll("tasks", { "filter[is_completed]": 0 }, "tasks"),
        pageAll("tasks", { "filter[updated_at][from]": Math.floor(monthStartMs(prevMonth(monthOf(now))) / 1000) }, "tasks"),
      ]);
      for (const t of [...open, ...recent]) tasks.set(Number(t.id), T.toTask(t));
      return [];
    }
    const rows = await pageAll("tasks", { "filter[updated_at][from]": Math.floor(since / 1000) }, "tasks");
    const moved = [];
    for (const t of rows) {
      const next = T.toTask(t);
      const prev = tasks.get(next.id);
      if (T.postponed(prev, next, now)) moved.push({ task: next, prevDue: prev.due });
      tasks.set(next.id, next);
    }
    return moved;
  };

  // The customer behind a task, for Telegram: the lead's main contact
  // (or the task's own contact), else the lead's name.
  const contactOf = (t) => (t.entity === "contacts" ? t.entityId : t.entity === "leads" && leads.has(t.entityId) ? leads.get(t.entityId).contact : null);
  const loadContacts = async (list, now) => {
    const want = [...new Set(list.map(contactOf).filter((id) => id && !(contacts.has(id) && now - contacts.get(id).at < 6 * 3600 * 1000)))];
    for (let i = 0; i < want.length; i += 50) {
      try {
        const rows = await pageAll("contacts", { "filter[id][]": want.slice(i, i + 50) }, "contacts");
        for (const c of rows) contacts.set(Number(c.id), { ...toContact(c), at: now });
      } catch (err) {
        log.error("amoCRM contacts failed", err.message || err);
      }
    }
  };
  const whoOf = (t) => {
    const c = contacts.get(contactOf(t));
    if (c && (c.name || c.phone)) return [c.name, c.phone].filter(Boolean).join(", ");
    return t.entity === "leads" && leads.has(t.entityId) ? leads.get(t.entityId).name || null : null;
  };

  // A task put off to a later day: late in its month's KPI, and the
  // manager and the admins hear about it now.
  const onPostponed = async (moved, now) => {
    if (!moved.length) return;
    const byMonth = new Map();
    for (const { task, prevDue } of moved) {
      const had = misses.get(task.id);
      const entry = { month: had ? had.month : T.monthOf(prevDue), user: task.user, due: had ? had.due : prevDue, postponed: true, at: now, to: task.due };
      misses.set(task.id, entry);
      if (!byMonth.has(entry.month)) byMonth.set(entry.month, {});
      byMonth.get(entry.month)[task.id] = { user: entry.user, due: entry.due, postponed: true, at: now, to: task.due };
    }
    for (const [month, ids] of byMonth) await db.collection("amo_task_misses").doc(month).set({ month, ids }, { merge: true });
    if (!notify) return;
    await loadContacts(moved.map((m) => m.task), now);
    const admins = [...staffInfo.values()].filter((i) => i.admin && i.chat);
    for (const { task, prevDue } of moved) {
      const email = staffByUser.get(task.user);
      const info = email && staffInfo.get(email);
      const name = (users.get(task.user) || {}).name || (info && info.name) || `#${task.user}`;
      if (info && info.chat) await notify("sendMessage", { chat_id: info.chat, text: T.postponeText(task, prevDue, whoOf(task), now) }).catch((err) => log.error("amoCRM postpone notice failed", err.message));
      for (const a of admins) {
        if (info && a.chat === info.chat) continue;
        await notify("sendMessage", { chat_id: a.chat, text: T.adminPostponeText(name, task, prevDue, whoOf(task)) }).catch(() => undefined);
      }
    }
  };

  const loadMisses = async (now) => {
    const cur = monthOf(now);
    for (const month of [prevMonth(cur), cur]) {
      const snap = await db.collection("amo_task_misses").doc(month).get();
      const ids = (snap.exists && snap.data().ids) || {};
      for (const [id, m] of Object.entries(ids)) misses.set(Number(id), { month, user: Number(m.user || 0), due: Number(m.due || 0), postponed: Boolean(m.postponed), at: Number(m.at || 0), to: Number(m.to || 0) });
    }
    missesLoaded = true;
  };

  // Remember open tasks past their deadline, so a later deadline change
  // doesn't erase the miss.
  const recordMisses = async (now) => {
    const cur = monthOf(now);
    const keep = new Set([cur, prevMonth(cur)]);
    const byMonth = new Map();
    for (const m of T.newMisses(tasks.values(), misses, now)) {
      misses.set(m.id, m);
      if (!keep.has(m.month)) continue;
      if (!byMonth.has(m.month)) byMonth.set(m.month, {});
      byMonth.get(m.month)[m.id] = { user: m.user, due: m.due };
    }
    for (const [month, ids] of byMonth) await db.collection("amo_task_misses").doc(month).set({ month, ids }, { merge: true });
  };

  const writeTasks = async (now) => {
    const cur = monthOf(now);
    const list = [...tasks.values()];
    const leadList = [...leads.values()];
    const batch = db.batch();
    let changed = 0;
    for (const month of [cur, prevMonth(cur)]) {
      for (const [user, s] of T.computeTasks(month, { tasks: list, misses, leads: leadList, now })) {
        if (!user) continue;
        const id = `${month}_${user}`;
        const doc = { month, amo_user_id: user, name: (users.get(user) || {}).name || `#${user}`, staff_email: staffByUser.get(user) || null, ...s };
        const json = JSON.stringify(doc);
        if (written.get(`t:${id}`) === json) continue;
        batch.set(db.collection("amo_tasks").doc(id), { ...doc, updated_at: new Date(now).toISOString() });
        written.set(`t:${id}`, json);
        changed++;
      }
    }
    if (changed) await batch.commit();
    return changed;
  };

  // 09:00 and 18:00 Tashkent: each manager's tasks in their private chat;
  // 18:05 a one-line-per-manager summary to the admins. Sent once a day
  // (amo_meta/reminders), and not at all if the server was down past the
  // slot by more than two hours.
  const SLOTS = [
    { key: "morning", from: "09:00", to: "11:00" },
    { key: "evening", from: "18:00", to: "20:00" },
  ];
  const remind = async (now) => {
    if (!notify) return;
    if (!reminders) {
      const snap = await db.collection("amo_meta").doc("reminders").get();
      reminders = snap.exists ? snap.data() : {};
    }
    const today = T.dayOf(now);
    const hm = T.hmOf(now);
    const slot = SLOTS.find((s) => hm >= s.from && hm < s.to && reminders[s.key] !== today);
    if (!slot) return;
    reminders[slot.key] = today;
    await db.collection("amo_meta").doc("reminders").set({ [slot.key]: today }, { merge: true });
    const today_ = T.dayOf(now);
    await loadContacts([...tasks.values()].filter((t) => !t.done && t.due && T.dayOf(t.due) <= today_), now);
    const leadName = whoOf;
    const byUser = new Map();
    for (const t of tasks.values()) {
      if (!byUser.has(t.user)) byUser.set(t.user, []);
      byUser.get(t.user).push(t);
    }
    const summary = slot.key === "evening" ? T.computeTasks(T.monthOf(now), { tasks: [...tasks.values()], misses, leads: [...leads.values()], now }) : null;
    const rows = [];
    for (const [user, list] of byUser) {
      const email = staffByUser.get(user);
      const info = email && staffInfo.get(email);
      const text = slot.key === "morning" ? T.morningText(list, now, leadName) : T.eveningText(list, now, leadName);
      if (text && info && info.chat) await notify("sendMessage", { chat_id: info.chat, text }).catch((err) => log.error("amoCRM reminder failed", err.message));
      if (summary && summary.has(user)) {
        const s = summary.get(user);
        if (s.today_due) rows.push({ name: (users.get(user) || {}).name || `#${user}`, total: s.today_due, open: s.today_open, noTask: s.no_task_leads });
      }
    }
    const adminMsg = summary ? T.adminText(rows) : null;
    if (adminMsg) {
      for (const info of staffInfo.values()) if (info.admin && info.chat) await notify("sendMessage", { chat_id: info.chat, text: adminMsg }).catch(() => undefined);
    }
  };

  const writeStats = async (now) => {
    const cur = monthOf(now);
    const months = [cur, prevMonth(cur)];
    const leadList = [...leads.values(), ...[...unsorted.values()].filter((u) => !leads.has(u.id))];
    const callList = [...calls.values()];
    const batch = db.batch();
    let changed = 0;
    for (const month of months) {
      const stats = computeStats(month, { leads: leadList, calls: callList, now });
      for (const [user, s] of stats) {
        const id = `${month}_${user}`;
        const doc = {
          month,
          amo_user_id: user,
          name: user ? (users.get(user) || {}).name || `#${user}` : "Menejersiz",
          staff_email: staffByUser.get(user) || null,
          ...s,
        };
        const json = JSON.stringify(doc);
        if (written.get(id) === json) continue;
        batch.set(db.collection("amo_stats").doc(id), { ...doc, updated_at: new Date(now).toISOString() });
        written.set(id, json);
        changed++;
      }
    }
    if (changed) await batch.commit();
    return changed;
  };

  const writeStatus = (fields) =>
    db.collection("amo_meta").doc("status").set(
      {
        host,
        users: [...users.values()].map(({ id, name }) => ({ id, name })),
        statuses,
        ...fields,
      },
      { merge: true },
    );

  const tick = async () => {
    if (!enabled || running) return;
    running = true;
    const now = Date.now();
    try {
      if (!metaAt || now - metaAt > META_EVERY_MS) await loadMeta();
      if (!staffAt || now - staffAt > 5 * 60 * 1000) await loadStaff();
      const startedAt = now - 60 * 1000; // overlap: a change during the pull is caught next time
      if (!leadsSince) {
        await pullLeads(0);
        await pullCalls(monthStartMs(prevMonth(monthOf(now))));
      } else {
        await pullLeads(leadsSince);
        await pullCalls(notesSince);
      }
      const unsortedCount = await pullUnsorted();
      leadsSince = startedAt;
      notesSince = startedAt;
      const changed = await writeStats(now);
      let taskDocs = 0;
      try {
        const moved = await pullTasks(tasksSince, now);
        tasksSince = startedAt;
        if (!missesLoaded) await loadMisses(now);
        await onPostponed(moved, now);
        await recordMisses(now);
        taskDocs = await writeTasks(now);
        await remind(now);
        tasksError = null;
      } catch (err) {
        tasksError = String(err.message || err).slice(0, 300);
        log.error("amoCRM tasks sync failed", tasksError);
      }
      const month = monthOf(now);
      const all = [...leads.values(), ...[...unsorted.values()].filter((u) => !leads.has(u.id))];
      const newestLead = all.reduce((m, l) => (!m || l.created > m.created ? l : m), null);
      const newest = newestLead ? newestLead.created : 0;
      // What the server holds, so a page showing zeros can say why.
      await writeStatus({
        ok: true,
        error: null,
        last_sync: new Date(now).toISOString(),
        poll_minutes: POLL_MS / 60000,
        leads: leads.size,
        unsorted: unsortedCount,
        leads_this_month: all.filter((l) => monthOf(l.created) === month).length,
        newest_lead_at: newest ? new Date(newest).toISOString() : null,
        newest_lead_id: newestLead ? String(newestLead.id) : null,
        max_lead_id: all.reduce((m, l) => (typeof l.id === "number" && l.id > m ? l.id : m), 0),
        calls_loaded: calls.size,
        calls_this_month: [...calls.values()].filter((c) => monthOf(c.at) === month).length,
        stats_docs_written: changed,
        tasks_loaded: tasks.size,
        task_docs_written: taskDocs,
        tasks_error: tasksError,
        users_count: users.size,
        stages_count: Object.keys(statuses).length,
        server_time: new Date().toISOString(),
        server_month: month,
      });
      log.log(`amoCRM sync: ${leads.size} leads (+${unsortedCount} unsorted), ${calls.size} calls, ${changed} stat docs written`);
      return changed;
    } catch (err) {
      log.error("amoCRM sync failed", err.message || err);
      await writeStatus({ ok: false, error: String(err.message || err).slice(0, 300), last_error_at: new Date(now).toISOString() }).catch(() => undefined);
    } finally {
      running = false;
    }
  };

  const start = async () => {
    if (!enabled) {
      log.log("AMO_SUBDOMAIN / AMO_TOKEN not set — amoCRM sync off.");
      return;
    }
    await tick();
    timer = setInterval(() => tick().catch((err) => log.error("amoCRM tick failed", err)), POLL_MS);
    log.log(`amoCRM sync started (${host}, every ${POLL_MS / 60000} min)`);
  };
  const stop = () => clearInterval(timer);

  return { start, stop, tick, enabled, _test: { leads, calls, users, statuses, tasks, misses } };
};

module.exports = { create, computeStats, hostOf, toLead, toCall };
