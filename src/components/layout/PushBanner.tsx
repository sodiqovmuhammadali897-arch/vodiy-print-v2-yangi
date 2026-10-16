import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { enablePush, pushState, registerServiceWorker, syncPush } from "../../lib/push";

const LATER_KEY = "vp_push_later";
const LATER_MS = 7 * 24 * 3600 * 1000;

const laterUntil = (): number => {
  try {
    return Number(localStorage.getItem(LATER_KEY) || 0);
  } catch {
    return 0;
  }
};

// Asks once (then weekly, if put off) to turn on phone notifications, and
// keeps this device's subscription saved for whoever is signed in.
export default function PushBanner({ email }: { email: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!email) return;
    void registerServiceWorker();
    void syncPush(email);
    void pushState().then((s) => setShow(s === "off" && Notification.permission === "default" && Date.now() > laterUntil()));
  }, [email]);

  if (!show) return null;

  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS));
    } catch {
      // private mode: just hide it for now
    }
    setShow(false);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm">
      <Bell className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Bildirishnomalarni yoqing</div>
        <div className="text-xs opacity-90">
          Zadacha, vazifa, eslatma va KPI xabarlari telefoningizga kelsin.{" "}
          <Link to="/settings#notifications" className="underline">
            Sozlash
          </Link>
        </div>
      </div>
      <button
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 disabled:opacity-60"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const s = await enablePush(email).catch(() => "off" as const);
          setBusy(false);
          if (s !== "off" || Notification.permission !== "default") setShow(false);
        }}
      >
        Yoqish
      </button>
      <button className="rounded-lg p-1.5 opacity-80 hover:opacity-100" onClick={later} aria-label="Keyinroq">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
