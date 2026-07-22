import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import { insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { Brand, Customer } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  brand?: Brand | null;
  defaultCustomerId?: string;
  onSaved: () => void;
};

export default function BrandFormModal({
  open,
  onClose,
  brand,
  defaultCustomerId,
  onSaved,
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    name: "",
    customer_id: "",
    logo_url: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void listAll<Customer>("customers", {
      orderBy: ["first_name", "asc"],
    }).then(setCustomers);
  }, [open]);

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name,
        customer_id: brand.customer_id,
        logo_url: brand.logo_url,
        note: brand.note,
      });
    } else {
      setForm({
        name: "",
        customer_id: defaultCustomerId || "",
        logo_url: "",
        note: "",
      });
    }
    setError(null);
  }, [brand, defaultCustomerId, open]);

  const submit = async () => {
    if (!form.name.trim()) return setError("Brend nomi kiritilishi shart");
    if (!form.customer_id) return setError("Mijoz tanlanishi shart");
    setSaving(true);
    setError(null);
    try {
      if (brand) {
        await updateOne("brands", brand.id, form);
      } else {
        await insertOne("brands", form);
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
      title={brand ? "Brendni tahrirlash" : "Yangi brend qo'shish"}
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
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="label">Brend nomi *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Mijoz *</label>
          <select
            className="input"
            value={form.customer_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, customer_id: e.target.value }))
            }
            disabled={!!defaultCustomerId && !brand}
          >
            <option value="">-- tanlang --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
                {c.company ? ` (${c.company})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input
            className="input"
            placeholder="https://..."
            value={form.logo_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, logo_url: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[80px]"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
