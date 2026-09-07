import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { insertOne, updateOne } from "../../lib/firestoreDb";
import type { WarehouseItem, WarehouseTransactionType } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  item: WarehouseItem | null;
  defaultType: WarehouseTransactionType;
  onSaved: () => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function WarehouseTransactionModal({ open, onClose, item, defaultType, onSaved }: Props) {
  const { staff, user } = useAuth();
  const [type, setType] = useState<WarehouseTransactionType>(defaultType);
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setQuantity(0);
    setReason("");
    setDate(todayISO());
    setError(null);
  }, [open, defaultType, item?.id]);

  if (!item) return null;

  const submit = async () => {
    if (quantity <= 0) return setError("Miqdorni kiriting");
    if (type === "out" && quantity > item.quantity) {
      return setError(`Ombordagi zaxiradan (${item.quantity} ${item.unit}) ko'p chiqim qilib bo'lmaydi`);
    }
    setSaving(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      await insertOne("warehouse_transactions", {
        item_id: item.id,
        item_name: item.name,
        type,
        quantity,
        reason: reason.trim(),
        performed_by: staff?.full_name || user?.email || "",
        date,
        created_at: nowIso,
      });
      const nextQty = type === "in" ? item.quantity + quantity : item.quantity - quantity;
      await updateOne("warehouse_items", item.id, { quantity: nextQty });
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={type === "in" ? "Kirim qilish" : "Chiqim qilish"}
      description={`${item.name} · joriy: ${item.quantity} ${item.unit}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="btn-primary"
            style={type === "out" ? { background: "#e11d48" } : undefined}
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">Amal turi</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("in")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold ${
                type === "in"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-ink-200 text-ink-500"
              }`}
            >
              <ArrowDownCircle className="h-4 w-4" /> Kirim
            </button>
            <button
              type="button"
              onClick={() => setType("out")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold ${
                type === "out"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-ink-200 text-ink-500"
              }`}
            >
              <ArrowUpCircle className="h-4 w-4" /> Chiqim
            </button>
          </div>
        </div>
        <div>
          <label className="label">Miqdor ({item.unit})</label>
          <input
            type="number"
            className="input"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Sabab</label>
          <input
            className="input"
            placeholder={type === "in" ? "masalan: Yangi xarid" : "masalan: Buyurtma VP-045 uchun"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Sana</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
