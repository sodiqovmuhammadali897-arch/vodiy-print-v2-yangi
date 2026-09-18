import { useState } from "react";
import { LogOut } from "lucide-react";
import type { WorkSchedule } from "../../lib/types";
import { checkOut } from "../../services/attendanceService";
import { captureSelfie, SelfieCancelledError } from "../../utils/selfieCapture";

type Props = {
  schedule: WorkSchedule;
  onDone: () => void;
};

export default function CheckOutButton({ schedule, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"selfie" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("Ishni tugatishni tasdiqlaysizmi?")) return;
    setBusy(true);
    setError(null);
    try {
      setStep("selfie");
      const photoDataUrl = await captureSelfie();
      setStep("verify");
      await checkOut(schedule, photoDataUrl);
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

  const label = step === "selfie" ? "Selfie olinmoqda..." : step === "verify" ? "Tasdiqlanmoqda..." : "Ishni tugatish";

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
