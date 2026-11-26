import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LeadCard } from "./LeadPage";
import type { CrmData } from "./useCrm";

// Sotuv bo'limi: a lead opens in a panel from the right (like amoCRM; the
// owner's deck «Sotuv bo'limi — yangi tartib», step 2, 2026-11-26) — the
// board stays behind it. Esc, a click on the dimmed side or the phone's
// «orqaga» closes it (the shell keeps it in the address: ?lead=ID).
export default function LeadDrawer({ id, crm, onClose }: { id: string; crm: CrmData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".modal-pop")) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Lid kartasi">
      <div className="modal-backdrop absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="drawer-in relative h-full w-full max-w-[980px] overflow-y-auto bg-ink-50 p-4 shadow-2xl sm:p-5 lg:rounded-l-3xl">
        <LeadCard key={id} id={id} crm={crm} panel onClose={onClose} />
      </aside>
    </div>,
    document.body,
  );
}
