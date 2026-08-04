import { useState } from "react";
import { LogOut } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkOut } from "../../services/attendanceService";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

export default function CheckOutButton({ schedule, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("Ishni tugatishni tasdiqlaysizmi?")) return;
    setBusy(true);
    setError(null);
    try {
      await checkOut(schedule);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink-800 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-ink-900 disabled:opacity-60"
        onClick={run}
        disabled={busy}
      >
        <LogOut className="h-5 w-5" />
        {busy ? "Tasdiqlanmoqda..." : "Ishni tugatish"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
