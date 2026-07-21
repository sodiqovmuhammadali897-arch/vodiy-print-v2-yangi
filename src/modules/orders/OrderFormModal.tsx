import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import { supabase } from "../../lib/supabase";
import type { Brand, Customer, Order, OrderStatus } from "../../lib/types";
import { ORDER_STATUS_OPTIONS, orderStatusLabel } from "../../components/ui/StatusBadge";
import { Send, Building2, Phone, MapPin } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  order?: Order | null;
  onSaved: () => void;
};

const emptyForm = {
  brand_id: "",
  customer_id: "",
  title: "",
  description: "",
  status: "new" as OrderStatus,
  total_amount: "",
  paid_amount: "",
  telegram_link: "",
  manager_name: "",
  deadline: "",
};

export default function OrderFormModal({ open, onClose, order, onSaved }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("customers").select("*").order("first_name"),
    ]).then(([b, c]) => {
      setBrands((b.data as Brand[]) || []);
      setCustomers((c.data as Customer[]) || []);
    });
  }, [open]);

  useEffect(() => {
    if (order) {
      setForm({
        brand_id: order.brand_id || "",
        customer_id: order.customer_id || "",
        title: order.title,
        description: order.description,
        status: order.status,
        total_amount: String(order.total_amount || ""),
        paid_amount: String(order.paid_amount || ""),
        telegram_link: order.telegram_link,
        manager_name: order.manager_name,
        deadline: order.deadline || "",
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [order, open]);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === form.brand_id) || null,
    [brands, form.brand_id],
  );
  const linkedCustomer = useMemo(() => {
    if (form.customer_id) {
      return customers.find((c) => c.id === form.customer_id) || null;
    }
    if (selectedBrand) {
      return customers.find((c) => c.id === selectedBrand.customer_id) || null;
    }
    return null;
  }, [customers, form.customer_id, selectedBrand]);

  const onBrandChange = (brand_id: string) => {
    const b = brands.find((x) => x.id === brand_id);
    setForm((f) => ({
      ...f,
      brand_id,
      customer_id: b?.customer_id || f.customer_id,
    }));
  };

  const submit = async () => {
    if (!form.title.trim()) return setError("Buyurtma nomi kiritilishi shart");
    setSaving(true);
    setError(null);
    const payload = {
      brand_id: form.brand_id || null,
      customer_id: form.customer_id || linkedCustomer?.id || null,
      title: form.title,
      description: form.description,
      status: form.status,
      total_amount: Number(form.total_amount) || 0,
      paid_amount: Number(form.paid_amount) || 0,
      telegram_link: form.telegram_link,
      manager_name: form.manager_name,
      deadline: form.deadline || null,
      completed_at:
        form.status === "done"
          ? order?.completed_at || new Date().toISOString()
          : null,
    };
    const { error } = order
      ? await supabase.from("orders").update(payload).eq("id", order.id)
      : await supabase.from("orders").insert(payload);
    setSaving(false);
    if (error) return setError(error.message);
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? "Buyurtmani tahrirlash" : "Yangi buyurtma"}
      size="xl"
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
        <div className="md:col-span-2">
          <label className="label">Brend</label>
          <select
            className="input"
            value={form.brand_id}
            onChange={(e) => onBrandChange(e.target.value)}
          >
            <option value="">-- brend tanlang --</option>
            {brands.map((b) => {
              const owner = customers.find((c) => c.id === b.customer_id);
              return (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {owner ? ` — ${owner.first_name} ${owner.last_name}` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {linkedCustomer && (
          <div className="md:col-span-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Mijoz avtomatik
            </div>
            <div className="mt-1 font-semibold text-ink-900">
              {linkedCustomer.first_name} {linkedCustomer.last_name}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-ink-700 sm:grid-cols-2">
              {linkedCustomer.company && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {linkedCustomer.company}
                </div>
              )}
              {linkedCustomer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {linkedCustomer.phone}
                </div>
              )}
              {linkedCustomer.telegram && (
                <div className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> {linkedCustomer.telegram}
                </div>
              )}
              {linkedCustomer.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {linkedCustomer.address}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="label">Buyurtma nomi *</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Tavsif</label>
          <textarea
            className="input min-h-[80px]"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as OrderStatus }))
            }
          >
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Menejer</label>
          <input
            className="input"
            value={form.manager_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, manager_name: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="label">Umumiy summa (so'm)</label>
          <input
            type="number"
            className="input"
            value={form.total_amount}
            onChange={(e) =>
              setForm((f) => ({ ...f, total_amount: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="label">To'langan (so'm)</label>
          <input
            type="number"
            className="input"
            value={form.paid_amount}
            onChange={(e) =>
              setForm((f) => ({ ...f, paid_amount: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="label">Muddat</label>
          <input
            type="date"
            className="input"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Telegram havola</label>
          <input
            className="input"
            placeholder="https://t.me/..."
            value={form.telegram_link}
            onChange={(e) =>
              setForm((f) => ({ ...f, telegram_link: e.target.value }))
            }
          />
        </div>
      </div>
    </Modal>
  );
}
