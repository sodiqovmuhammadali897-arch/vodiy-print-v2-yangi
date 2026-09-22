import { useState } from "react";
import { LogIn } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkIn } from "../../services/attendanceService";
import { captureSelfie, SelfieCancelledError } from "../../utils/selfieCapture";
import { useAuth } from "../../lib/AuthContext";
import { randomCheckInMessage } from "../../utils/attendanceMessages";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

// How long the motivational message stays up before the card switches
// to the check-out state — long enough to read, short enough to not
// feel like it's blocking the next action.
const SUCCESS_DISPLAY_MS = 2600;

export default function CheckInButton({ schedule, onDone }: Props) {
  const { staff } = useAuth();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"selfie" | "verify" | "success" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setStep("selfie");
      const photoDataUrl = await captureSelfie();
      setStep("verify");
      await checkIn(schedule, photoDataUrl);
      setMessage(randomCheckInMessage(staff?.full_name || "Xodim"));
      setStep("success");
      setTimeout(() => {
        setBusy(false);
        setStep(null);
        onDone();
      }, SUCCESS_DISPLAY_MS);
    } catch (err) {
      if (!(err instanceof SelfieCancelledError)) {
        setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
      }
      setBusy(false);
      setStep(null);
    }
  };

  const label = step === "selfie" ? "Selfie olinmoqda..." : step === "verify" ? "Tasdiqlanmoqda..." : "Ishni boshlash";

  if (step === "success" && message) {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
        {message}
      </div>
    );
  }

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
