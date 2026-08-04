import { useState } from "react";
import { LogIn } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkIn } from "../../services/attendanceService";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

export default function CheckInButton({ schedule, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await checkIn(schedule);
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
        className="btn-primary w-full justify-center py-3 text-base"
        onClick={run}
        disabled={busy}
      >
        <LogIn className="h-5 w-5" />
        {busy ? "Tasdiqlanmoqda..." : "Ishni boshlash"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
