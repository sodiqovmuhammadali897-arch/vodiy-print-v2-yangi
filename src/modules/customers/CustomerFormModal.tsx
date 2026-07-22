import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import { supabase } from "../../lib/supabase";
import type { Customer } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSaved: () => void;
};

const empty = {
  first_name: "",
  last_name: "",
  phone: "",
  extra_phone: "",
  telegram: "",
  company: "",
  position: "",
  address: "",
  note: "",
};

export default function CustomerFormModal({
  open,
  onClose,
  customer,
  onSaved,
}: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setForm({
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        extra_phone: customer.extra_phone,
        telegram: customer.telegram,
        company: customer.company,
        position: customer.position,
        address: customer.address,
        note: customer.note,
      });
    } else {
      setForm(empty);
    }
    setError(null);
  }, [customer, open]);

  const set = <K extends keyof typeof form>(key: K, v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const submit = async () => {
    if (!form.first_name.trim()) {
      setError("Ism kiritilishi shart");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...form };
    const { error } = customer
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Mijozni tahrirlash" : "Yangi mijoz qo'shish"}
      size="lg"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Ism *</label>
          <input
            className="input"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Familiya</label>
          <input
            className="input"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input
            className="input"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Qo'shimcha telefon</label>
          <input
            className="input"
            value={form.extra_phone}
            onChange={(e) => set("extra_phone", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Telegram username</label>
          <input
            className="input"
            placeholder="@username"
            value={form.telegram}
            onChange={(e) => set("telegram", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Kompaniya</label>
          <input
            className="input"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Lavozim</label>
          <input
            className="input"
            value={form.position}
            onChange={(e) => set("position", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Manzil</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[80px]"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
