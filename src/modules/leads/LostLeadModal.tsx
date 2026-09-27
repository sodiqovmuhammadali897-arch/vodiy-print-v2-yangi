import { useEffect, useState } from "react";
import { LOST_LEAD_REASONS } from "../../lib/orderConstants";
import { markLeadLost } from "../../lib/leadStatusChange";
import { listAll } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import type { Competitor, Lead } from "../../lib/types";
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
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorId, setCompetitorId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [theirPrice, setTheirPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(LOST_LEAD_REASONS[0]);
      setComment("");
      setCompetitorId("");
      setOtherName("");
      setTheirPrice(0);
      setError(null);
      void listAll<Competitor>("competitors", { orderBy: ["name", "asc"] })
        .then((rows) => setCompetitors(rows.filter((c) => c.active !== false)))
        .catch(() => setCompetitors([]));
    }
  }, [open]);

  const toCompetitor = reason === "Raqobatchini tanladi";

  const submit = async () => {
    if (!lead) return;
    if (reason === "Boshqa" && !comment.trim()) {
      setError("\"Boshqa\" tanlansa, izoh yozish shart");
      return;
    }
    const picked = competitors.find((c) => c.id === competitorId);
    const competitorName = picked ? picked.name : otherName.trim();
    if (toCompetitor && !competitorName) {
      setError("Qaysi raqobatchiga ketganini tanlang yoki yozing");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const actorEmail = user?.email?.toLowerCase() || "";
      const actorName = staff?.full_name || actorEmail;
      await markLeadLost(
        lead,
        reason,
        comment.trim(),
        { email: actorEmail, name: actorName },
        toCompetitor ? { id: picked?.id || null, name: competitorName, price: theirPrice } : null,
      );
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
      {toCompetitor && (
        <div className="mt-3 space-y-3 rounded-xl bg-ink-50 p-3">
          <div>
            <label className="label">Qaysi raqobatchi? *</label>
            <select className="input" value={competitorId} onChange={(e) => setCompetitorId(e.target.value)}>
              <option value="">— ro'yxatda yo'q, nomini yozaman —</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` (${c.city})` : ""}
                </option>
              ))}
            </select>
            {!competitorId && (
              <input className="input mt-2" placeholder="Raqobatchi nomi" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label">Ular aytgan narx (jami, so'm)</label>
            <input
              type="number"
              className="input"
              placeholder="bilsangiz yozing"
              value={theirPrice || ""}
              onChange={(e) => setTheirPrice(Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="mt-1 text-xs text-ink-500">
              Biz aytgan narx lidning «Taxminiy summa»sidan olinadi{lead?.estimated_amount ? `: ${Number(lead.estimated_amount).toLocaleString("ru-RU")} so'm` : " (kiritilmagan)"}.
            </p>
          </div>
          <textarea className="input min-h-[60px]" placeholder="Izoh (ixtiyoriy): nima uchun ularni tanladi?" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
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
