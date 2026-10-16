// Keeps the open app on the newest deploy, and the data kept on the device
// from being cleared by the phone.
//
// A deploy changes the main script's name in index.html. Every few minutes
// (and whenever the app comes back to the screen) the page is fetched and
// compared with the one running. When it differs: if the app was away for
// a while it simply reloads; otherwise onUpdate() lets the person choose
// (a reload in the middle of typing would lose the form).
const CHECK_MS = 5 * 60 * 1000;
const AWAY_MS = 10 * 60 * 1000;

const scriptOf = (html: string): string | null => {
  const m = html.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/);
  return m ? m[1] : null;
};

const runningScript = (): string | null => {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src).pathname : null;
};

// Is a newer deploy on the server? null: can't tell (offline, development).
export const checkForUpdate = async (): Promise<boolean | null> => {
  const running = runningScript();
  if (!running || navigator.onLine === false) return null;
  try {
    const res = await fetch("/index.html", { cache: "no-store" });
    const latest = res.ok ? scriptOf(await res.text()) : null;
    return latest ? latest !== running : null;
  } catch {
    return null;
  }
};

export const startUpdateWatch = (onUpdate: () => void): (() => void) => {
  const running = runningScript();
  if (!running) return () => undefined; // development
  let hiddenAt = 0;
  let found = false;

  const check = async (): Promise<boolean> => {
    if (found) return true;
    found = (await checkForUpdate()) === true;
    if (found) onUpdate();
    return found;
  };

  const onVisibility = async () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt && Date.now() - hiddenAt >= AWAY_MS;
    if ((await check()) && away) window.location.reload();
  };

  const timer = setInterval(() => void check(), CHECK_MS);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
};

// Asks the browser to keep this site's storage until the person clears it
// (installed apps and home-screen apps usually get it without a prompt).
export const keepStorage = (): void => {
  if (navigator.storage && navigator.storage.persist) void navigator.storage.persist().catch(() => false);
};

// Everything this app keeps on the device: the saved code (service worker)
// and the saved data (Firestore). The page reloads afterwards.
export const clearDeviceCache = async (): Promise<void> => {
  if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
};

export type StorageInfo = { usedMb: number | null; kept: boolean | null };
export const storageInfo = async (): Promise<StorageInfo> => {
  const s = navigator.storage;
  const [est, kept] = await Promise.all([
    s && s.estimate ? s.estimate().catch(() => null) : Promise.resolve(null),
    s && s.persisted ? s.persisted().catch(() => null) : Promise.resolve(null),
  ]);
  return { usedMb: est && est.usage != null ? est.usage / 1048576 : null, kept };
};
