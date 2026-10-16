import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { keepStorage, startUpdateWatch } from "../../lib/appUpdate";

// "Yangi versiya tayyor" — see appUpdate.ts.
export default function UpdateBar() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    keepStorage();
    return startUpdateWatch(() => setReady(true));
  }, []);

  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span>Yangi versiya tayyor</span>
        <button className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900" onClick={() => window.location.reload()}>
          Yangilash
        </button>
      </div>
    </div>
  );
}
