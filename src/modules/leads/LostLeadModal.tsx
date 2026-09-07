import { useEffect, useState } from "react";
import { LOST_LEAD_REASONS } from "../../lib/orderConstants";
import { markLeadLost } from "../../lib/leadStatusChange";
import { useAuth } from "../../lib/AuthContext";
import type { Lead } from "../../lib/types";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onDone: () => void;
};

export default function LostLeadModal({ open, onClose, lead, onDone }: Props) {
  const { user, staff } = useAuth();
  const [reason, setReason] = useState<string>(LOST_LEAD_REASONS[0]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(LOST_LEAD_REASONS[0]);
      setComment("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!lead) return;
    if (reason === "Boshqa" && !comment.trim()) {
      setError("\"Boshqa\" tanlansa, izoh yozish shart");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const actorEmail = user?.email?.toLowerCase() || "";
      const actorName = staff?.full_name || actorEmail;
      await markLeadLost(lead, reason, comment.trim(), { email: actorEmail, name: actorName });
      setSaving(false);
      onDone();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lidni yo'qotilgan deb belgilash"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-danger" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Yo'qotilgan deb belgilash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      <label className="label">Sababi *</label>
      <div className="space-y-1">
        {LOST_LEAD_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2.5 py-1.5 text-sm text-ink-700">
            <input
              type="radio"
              name="lost-reason"
              className="h-4 w-4 accent-brand-600"
              checked={reason === r}
              onChange={() => setReason(r)}
            />
            {r}
          </label>
        ))}
      </div>
      {reason === "Boshqa" && (
        <textarea
          className="input mt-2 min-h-[70px]"
          placeholder="Izoh (majburiy)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
    </Modal>
  );
}
