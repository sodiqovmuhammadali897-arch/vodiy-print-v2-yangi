// Push-bildirishnomalar: the same notices the bot sends on Telegram, also
// as phone notifications (web push — the Vodiyprint Android app, Chrome,
// and the iPhone home-screen app). Telegram keeps working as before.
//
// The ERP saves each device's subscription in push_subs/{id} {email, ...}
// and the person's choices in push_prefs/{email} {amo, tasks, reminders,
// kpi, admin} (missing = on). The VAPID keys are made here once and kept in
// push_meta/vapid (server only); the public half is copied to
// push_meta/public for the ERP. A push_tests/{email} doc asks for a test
// notification.
//
// Other modules call the helpers below without holding a reference:
//   require("./push").toEmail(email, "tasks", text, "/tasks")
// Before init() (or when web-push is missing) they do nothing.
let webpush = null;
try {
  webpush = require("web-push");
} catch {
  webpush = null;
}

const KINDS = ["amo", "tasks", "reminders", "kpi", "admin"];
const STAFF_TTL_MS = 60 * 1000;

let db = null;
let ready = null;
let staffCache = { at: 0, list: [] };

// A Telegram text → { title, body }: the first line is the title.
const fromText = (text) => {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || "Vodiyprint").slice(0, 80);
  const body = lines.slice(1).join("\n").slice(0, 300);
  return { title, body };
};

const keys = async () => {
  const ref = db.collection("push_meta").doc("vapid");
  const snap = await ref.get();
  if (snap.exists && snap.data().publicKey) return snap.data();
  const made = webpush.generateVAPIDKeys();
  await ref.set({ ...made, created_at: new Date().toISOString() });
  return made;
};

const staff = async () => {
  if (Date.now() - staffCache.at < STAFF_TTL_MS) return staffCache.list;
  const list = (await db.collection("staff").get()).docs.map((d) => ({ email: d.id, ...d.data() }));
  staffCache = { at: Date.now(), list };
  return list;
};

const wants = async (email, kind) => {
  const snap = await db.collection("push_prefs").doc(email).get();
  return !snap.exists || snap.data()[kind] !== false;
};

// Sends to every device of one person; drops subscriptions the browser
// has given up (404/410).
const send = async (email, kind, msg) => {
  if (!db || !webpush || !email) return 0;
  await ready;
  email = String(email).toLowerCase();
  if (kind !== "test" && !(await wants(email, kind))) return 0;
  const subs = (await db.collection("push_subs").where("email", "==", email).get()).docs;
  let sent = 0;
  for (const d of subs) {
    const s = d.data();
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title: msg.title, body: msg.body || "", url: msg.url || "/", tag: msg.tag || kind }),
        { TTL: 12 * 3600 },
      );
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await d.ref.delete().catch(() => undefined);
      else console.error("Push failed", email, err.statusCode || "", err.message);
    }
  }
  return sent;
};

const toEmail = (email, kind, text, url = "/") =>
  send(email, kind, { ...fromText(text), url }).catch((err) => console.error("Push failed", err.message));

const toChat = async (chatId, kind, text, url = "/") => {
  if (!db || !webpush || !chatId) return;
  const s = (await staff()).find((x) => x.telegram_chat_id && Number(x.telegram_chat_id) === Number(chatId));
  if (s) await toEmail(s.email, kind, text, url);
};

// Admins as the bot counts them elsewhere: role admin, not a sales manager.
const toAdmins = async (kind, text, url = "/") => {
  if (!db || !webpush) return;
  for (const s of (await staff()).filter((x) => x.role === "admin" && !x.report_manager_id)) await toEmail(s.email, kind, text, url);
};

const init = (database) => {
  if (!webpush) {
    console.warn("web-push is not installed — push notifications are off");
    return;
  }
  db = database;
  ready = keys()
    .then(async (k) => {
      webpush.setVapidDetails("https://printvodiy.uz", k.publicKey, k.privateKey);
      await db.collection("push_meta").doc("public").set({ key: k.publicKey });
    })
    .catch((err) => console.error("Push keys failed", err.message));

  // "Sinov xabari" from the ERP.
  db.collection("push_tests").onSnapshot(
    (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const email = ch.doc.id;
        ch.doc.ref
          .delete()
          .then(() => send(email, "test", { title: "🔔 Vodiyprint", body: "Bildirishnomalar ishlayapti!", url: "/notifications" }))
          .catch((err) => console.error("Push test failed", err.message));
      }
    },
    (err) => console.error("push_tests listener failed", err.message),
  );
};

module.exports = { init, toEmail, toChat, toAdmins, fromText, KINDS };
