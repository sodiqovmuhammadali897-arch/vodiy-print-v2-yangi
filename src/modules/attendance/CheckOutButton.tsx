import { useState } from "react";
import { LogOut } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkOut } from "../../services/attendanceService";
import { captureSelfie, SelfieCancelledError } from "../../utils/selfieCapture";
import { useAuth } from "../../lib/AuthContext";
import { randomCheckOutMessage } from "../../utils/attendanceMessages";
import { formatMinutes } from "../../utils/attendanceCalculations";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

// How long the thank-you message stays up before the card switches to
// the "ish yakunlandi" state — long enough to read, short enough to
// not feel like it's blocking anything.
const SUCCESS_DISPLAY_MS = 2600;

export default function CheckOutButton({ schedule, onDone }: Props) {
  const { staff } = useAuth();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"selfie" | "verify" | "success" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("Ishni tugatishni tasdiqlaysizmi?")) return;
    setBusy(true);
    setError(null);
    try {
      setStep("selfie");
      const photoDataUrl = await captureSelfie();
      setStep("verify");
      const result = await checkOut(schedule, photoDataUrl);
      const workedLabel = formatMinutes(result.workedMinutes || 0);
      setMessage(randomCheckOutMessage(staff?.full_name || "Xodim", workedLabel));
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

  const label = step === "selfie" ? "Selfie olinmoqda..." : step === "verify" ? "Tasdiqlanmoqda..." : "Ishni tugatish";

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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
        onClick={run}
        disabled={busy}
      >
        <LogOut className="h-5 w-5" />
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
