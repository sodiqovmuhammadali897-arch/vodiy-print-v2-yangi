import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import { CRM_LOST_REASONS } from "../../../lib/crm";
import { markCrmLost, type Actor } from "../../../lib/crmService";
import type { Lead, LeadTask } from "../../../lib/types";

// «Yo'qotildi» — the reason is required (amoCRM's «Ёпилиш сабаби» list).
export default function LostModal({ lead, tasks, actor, onClose }: { lead: Lead; tasks: LeadTask[]; actor: Actor; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!reason) return setError("Sababni tanlang");
    setSaving(true);
    try {
      await markCrmLost(lead, reason, comment.trim(), tasks, actor);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Lid yo'qotildi"
      description={`${lead.brand || lead.full_name || lead.phone} — sababini tanlang`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn-primary bg-rose-600 hover:bg-rose-700" disabled={saving} onClick={() => void save()}>
            Yo'qotildi
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        {CRM_LOST_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-lg border px-2.5 py-2 text-left text-sm ${reason === r ? "border-rose-500 bg-rose-50 font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" : "border-ink-200 text-ink-700"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <label className="label mt-3">Izoh (ixtiyoriy)</label>
      <textarea className="input min-h-[60px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Masalan: raqobatchi 4 000 so'm aytgan" />
      {tasks.length > 0 && <p className="mt-2 text-xs text-ink-500">Ochiq zadachalari ({tasks.length}) yopiladi.</p>}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}
