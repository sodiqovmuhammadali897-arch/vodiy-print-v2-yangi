import { useEffect, useState } from "react";
import { insertOne, updateOne } from "../../lib/firestoreDb";
import { WAREHOUSE_CATEGORIES } from "../../lib/orderConstants";
import type { WarehouseItem } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  item: WarehouseItem | null;
  onSaved: () => void;
};

const emptyForm = {
  name: "",
  category: WAREHOUSE_CATEGORIES[0] as string,
  unit: "dona",
  quantity: 0,
  minThreshold: 0,
  note: "",
};

export default function WarehouseItemFormModal({ open, onClose, item, onSaved }: Props) {
  const { staff, user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name,
        category: item.category || WAREHOUSE_CATEGORIES[0],
        unit: item.unit || "dona",
        quantity: item.quantity,
        minThreshold: item.min_threshold,
        note: item.note,
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [item, open]);

  const submit = async () => {
    if (!form.name.trim()) return setError("Mahsulot nomini kiriting");
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await updateOne("warehouse_items", item.id, {
          name: form.name.trim(),
          category: form.category,
          unit: form.unit.trim() || "dona",
          min_threshold: form.minThreshold,
          note: form.note.trim(),
        });
      } else {
        const created = await insertOne<Omit<WarehouseItem, "id" | "created_at">>("warehouse_items", {
          name: form.name.trim(),
          category: form.category,
          unit: form.unit.trim() || "dona",
          quantity: form.quantity,
          min_threshold: form.minThreshold,
          note: form.note.trim(),
        });
        if (form.quantity > 0) {
          const nowIso = new Date().toISOString();
          await insertOne("warehouse_transactions", {
            item_id: created.id,
            item_name: created.name,
            type: "in",
            quantity: form.quantity,
            reason: "Boshlang'ich zaxira",
            performed_by: staff?.full_name || user?.email || "",
            date: nowIso.slice(0, 10),
            created_at: nowIso,
          });
        }
      }
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
      title={item ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Mahsulot nomi *</label>
          <input
            className="input"
            placeholder="masalan: Qog'oz 300gr (melovka)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Turkumi</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {WAREHOUSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">O'lchov birligi</label>
          <input
            className="input"
            placeholder="dona, metr, list, kg..."
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
        </div>
        {!item && (
          <div>
            <label className="label">Boshlang'ich zaxira</label>
            <input
              type="number"
              className="input"
              value={form.quantity || ""}
              onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
            />
          </div>
        )}
        <div>
          <label className="label">Kam qolish chegarasi</label>
          <input
            type="number"
            className="input"
            value={form.minThreshold || ""}
            onChange={(e) => setForm((f) => ({ ...f, minThreshold: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[60px]"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </div>
      {item && (
        <p className="mt-3 text-xs text-ink-500">
          Joriy zaxira: <b className="text-ink-800">{item.quantity} {item.unit}</b> — miqdorni o'zgartirish
          uchun ro'yxatdagi Kirim/Chiqim tugmalaridan foydalaning.
        </p>
      )}
    </Modal>
  );
}
