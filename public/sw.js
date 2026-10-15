// Vodiyprint service worker: keeps the app's code on the phone so it opens
// at once, shows the phone notifications sent by meta-webhook/push.js and
// opens the right page when one is tapped.
const CODE = "vp-code-v1"; // built JS/CSS (names change with content), fonts, icons
const PAGE = "vp-page-v1"; // the last index.html, for a slow connection
const KEEP = 120; // files kept in CODE; older deploys' files are dropped
const PAGE_WAIT_MS = 3000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CODE && k !== PAGE) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

const trim = async () => {
  const c = await caches.open(CODE);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await c.delete(k);
};

// Code: from the phone if there, else download and keep.
const fromCache = async (req) => {
  const c = await caches.open(CODE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await c.put(req, res.clone());
    trim().catch(() => undefined);
  }
  return res;
};

// The page: fresh from the server; if the server takes long (or there is
// no connection), the last copy — the fresh one still replaces it.
const page = async (req) => {
  const c = await caches.open(PAGE);
  const net = fetch(req).then(async (res) => {
    if (res.ok) await c.put("/index.html", res.clone());
    return res;
  });
  net.catch(() => undefined);
  const timer = new Promise((res) => setTimeout(() => res(null), PAGE_WAIT_MS));
  const first = await Promise.race([net.catch(() => null), timer]);
  if (first) return first;
  return (await c.match("/index.html")) || net;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (/^\/(webhooks|sayt)\b|\.(apk|json)$/.test(url.pathname)) return;
    e.respondWith(page(req));
    return;
  }
  if (/^\/(assets|fonts|app)\//.test(url.pathname)) e.respondWith(fromCache(req));
});

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: "Vodiyprint", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "Vodiyprint", {
      body: d.body || "",
      icon: "/app/icon-192.png",
      badge: "/app/badge-96.png",
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
