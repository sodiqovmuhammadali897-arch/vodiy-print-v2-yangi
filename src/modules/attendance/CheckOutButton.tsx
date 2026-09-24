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
  // Asked in the page, not with window.confirm(): some browsers (Telegram's
  // in-app browser, home-screen web apps, or a site the user once told
  // "don't show dialogs") silently answer "no", which made the button look
  // dead.
  const [confirming, setConfirming] = useState(false);

  const run = async () => {
    setConfirming(false);
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

  if (confirming) {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 text-center">
        <p className="mb-3 text-sm font-semibold text-ink-800">Ishni tugatishni tasdiqlaysizmi?</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary justify-center" onClick={() => setConfirming(false)}>
            Bekor
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 font-semibold text-white hover:bg-slate-900"
            onClick={run}
          >
            <LogOut className="h-4 w-4" /> Ha, tugatish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        disabled={busy}
      >
        <LogOut className="h-5 w-5" />
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
