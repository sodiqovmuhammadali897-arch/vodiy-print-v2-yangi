import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Shown while the device has no internet: pages keep working from the
// data saved on the device (see firestoreDb.ts), but saving needs the
// connection back.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        Internet yo'q — telefonda saqlangan ma'lumotlar ko'rsatilmoqda. Ko'rish mumkin; o'zgartirishni saqlash uchun internet kerak.
      </span>
    </div>
  );
}
