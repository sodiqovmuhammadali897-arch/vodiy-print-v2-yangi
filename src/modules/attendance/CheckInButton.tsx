import { useState } from "react";
import { LogIn } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkIn } from "../../services/attendanceService";
import { captureSelfie, SelfieCancelledError } from "../../utils/selfieCapture";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

export default function CheckInButton({ schedule, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"selfie" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setStep("selfie");
      const photoDataUrl = await captureSelfie();
      setStep("verify");
      await checkIn(schedule, photoDataUrl);
      onDone();
    } catch (err) {
      if (!(err instanceof SelfieCancelledError)) {
        setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
      }
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  const label = step === "selfie" ? "Selfie olinmoqda..." : step === "verify" ? "Tasdiqlanmoqda..." : "Ishni boshlash";

  return (
    <div>
      <button
        className="btn-primary w-full justify-center py-3 text-base"
        onClick={run}
        disabled={busy}
      >
        <LogIn className="h-5 w-5" />
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
