// Push-bildirishnomalar on this device: the service worker (public/sw.js),
// the browser's permission and the subscription saved in push_subs, which
// meta-webhook/push.js sends to. Works in Chrome/Android (and the
// Vodiyprint app) and in the iPhone home-screen app (iOS 16.4+).
import { getOne, upsertOne, deleteOne } from "./firestoreDb";

export type PushKind = "amo" | "tasks" | "reminders" | "kpi" | "admin";
export type PushPrefs = Partial<Record<PushKind, boolean>>;
export type PushState = "unsupported" | "ios-browser" | "blocked" | "off" | "on";

export const pushSupported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhone Safari gets push only once the site is on the home screen.
const isIos = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const standalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let registration: Promise<ServiceWorkerRegistration | null> | null = null;
export const registerServiceWorker = (): Promise<ServiceWorkerRegistration | null> => {
  if (!registration) {
    registration = "serviceWorker" in navigator ? navigator.serviceWorker.register("/sw.js").catch(() => null) : Promise.resolve(null);
  }
  return registration;
};

const keyBytes = (base64: string): Uint8Array => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// One doc per device: the id is a hash of the browser's push address.
const subId = async (endpoint: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
};

const save = async (email: string, sub: PushSubscription): Promise<void> => {
  const json = sub.toJSON();
  await upsertOne("push_subs", await subId(sub.endpoint), {
    email,
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh || "", auth: json.keys?.auth || "" },
    ua: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString(),
  });
};

export const pushState = async (): Promise<PushState> => {
  if (!pushSupported()) return isIos() && !standalone() ? "ios-browser" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const reg = await registerServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
};

// Must run from a tap (iPhone asks for permission only then).
export const enablePush = async (email: string): Promise<PushState> => {
  if (!pushSupported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Service worker ishga tushmadi");
  const meta = await getOne<{ key: string }>("push_meta", "public");
  if (!meta?.key) throw new Error("Server hali tayyor emas — birozdan keyin urinib ko'ring");
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(meta.key) as BufferSource }));
  await save(email, sub);
  return "on";
};

export const disablePush = async (): Promise<void> => {
  const reg = await registerServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await deleteOne("push_subs", await subId(sub.endpoint)).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
};

// On every start: keep this device's subscription saved under whoever is
// signed in now (the browser may have renewed it).
export const syncPush = async (email: string): Promise<void> => {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registerServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await save(email, sub).catch(() => undefined);
};

export const sendTestPush = (email: string) => upsertOne("push_tests", email, { at: new Date().toISOString() });
