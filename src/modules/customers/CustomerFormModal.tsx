import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import { insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import { nextCustomerNumber } from "../../lib/numbering";
import { CUSTOMER_SOURCES, CUSTOMER_TYPES, INDUSTRIES, UZBEKISTAN_REGIONS } from "../../lib/orderConstants";
import type { Customer, Manager } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSaved: (customer: Customer) => void;
};

const emptyForm = {
  customer_type: "new" as Customer["customer_type"],
  source: "",
  industry: "",
  first_name: "",
  last_name: "",
  phone: "",
  extra_phone: "",
  telegram: "",
  company: "",
  position: "",
  region: "",
  address: "",
  note: "",
  manager_name: "",
};

export default function CustomerFormModal({
  open,
  onClose,
  customer,
  onSaved,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Customer[]>([]);
  const [managerNames, setManagerNames] = useState<string[]>([]);

  useEffect(() => {
    if (customer) {
      setForm({
        customer_type: customer.customer_type,
        source: customer.source,
        industry: customer.industry || "",
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        extra_phone: customer.extra_phone,
        telegram: customer.telegram,
        company: customer.company,
        position: customer.position,
        region: customer.region || "",
        address: customer.address,
        note: customer.note,
        manager_name: customer.manager_name || "",
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [customer, open]);

  useEffect(() => {
    if (!open) return;
    void listAll<Customer>("customers").then(setExisting);
    void listAll<Manager>("managers", { orderBy: ["created_at", "asc"] }).then((m) =>
      setManagerNames(m.map((x) => x.name)),
    );
  }, [open]);

  const submit = async () => {
    if (!form.first_name.trim()) return setError("Ism kiritilishi shart");
    if (!form.phone.trim()) return setError("Telefon raqami kiritilishi shart");
    const normalizedPhone = form.phone.replace(/\D/g, "");
    const duplicate = existing.find(
      (c) =>
        c.id !== customer?.id &&
        normalizedPhone &&
        c.phone.replace(/\D/g, "") === normalizedPhone,
    );
    if (duplicate) {
      const proceed = confirm(
        `Bu telefon raqami allaqachon ro'yxatda: ${duplicate.first_name} ${duplicate.last_name}. Baribir davom etamizmi?`,
      );
      if (!proceed) return;
    }
    setSaving(true);
    setError(null);
    try {
      if (customer) {
        await updateOne("customers", customer.id, form);
        onSaved({ ...customer, ...form });
      } else {
        const customer_number = await nextCustomerNumber();
        const saved = await insertOne("customers", {
          ...form,
          customer_number,
        });
        onSaved(saved as Customer);
      }
      setSaving(false);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Ism *</label>
          <input
            className="input"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Familiya</label>
          <input
            className="input"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Telefon *</label>
          <input
            className="input"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Qo'shimcha telefon</label>
          <input
            className="input"
            value={form.extra_phone}
            onChange={(e) => setForm((f) => ({ ...f, extra_phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Telegram</label>
          <input
            className="input"
            placeholder="@username"
            value={form.telegram}
            onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Kompaniya</label>
          <input
            className="input"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Lavozim</label>
          <input
            className="input"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Mijoz turi</label>
          <select
            className="input"
            value={form.customer_type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                customer_type: e.target.value as Customer["customer_type"],
              }))
            }
          >
            {CUSTOMER_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Menejer</label>
          <select
            className="input"
            value={form.manager_name}
            onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
          >
            <option value="">-- tanlang --</option>
            {managerNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Manba</label>
          <select
            className="input"
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          >
            <option value="">-- tanlang --</option>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Soha</label>
          <input
            className="input"
            list="industries-list"
            placeholder="Tanlang yoki yozing..."
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
          />
          <datalist id="industries-list">
            {INDUSTRIES.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Viloyat</label>
          <select
            className="input"
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          >
            <option value="">-- tanlang --</option>
            {UZBEKISTAN_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Manzil</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
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
