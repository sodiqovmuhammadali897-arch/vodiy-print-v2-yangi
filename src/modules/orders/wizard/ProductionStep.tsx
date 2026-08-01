import { Plus } from "lucide-react";
import type { OrderPayload, WizardPayment, WizardProduct } from "../../../lib/orderService";
import type { TextileCompany } from "../../../lib/types";
import { PRODUCTION_COMPANIES, DESIGNER_STATUSES, DELIVERY_TYPES, PAYMENT_TYPES } from "../../../lib/orderConstants";
import ProductLineItem from "./ProductLineItem";

type Props = {
  payload: OrderPayload;
  onPayloadChange: (patch: Partial<OrderPayload>) => void;
  products: WizardProduct[];
  setProducts: (updater: (prev: WizardProduct[]) => WizardProduct[]) => void;
  payments: WizardPayment[];
  setPayments: (updater: (prev: WizardPayment[]) => WizardPayment[]) => void;
  textileCompanies: TextileCompany[];
  managerNames: string[];
  historyPrices: Record<string, number>;
};

const emptyProduct: WizardProduct = {
  position: 0, category: "", product_name: "", variant: "", size: "", material: "",
  color: "", quantity: 0, unit_price: 0, discount: 0, total: 0, note: "",
};

const emptyPayment: WizardPayment = {
  amount: 0, payment_type: "Naqd", payment_date: new Date().toISOString().slice(0, 10),
  received_by: "", note: "",
};

export default function ProductionStep({
  payload, onPayloadChange, products, setProducts, payments, setPayments,
  textileCompanies, managerNames, historyPrices,
}: Props) {
  const addProduct = () => setProducts((p) => [...p, { ...emptyProduct, position: p.length }]);
  const updateProduct = (i: number, patch: Partial<WizardProduct>) =>
    setProducts((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));

  const addPayment = () => setPayments((p) => [...p, { ...emptyPayment }]);
  const updatePayment = (i: number, patch: Partial<WizardPayment>) =>
    setPayments((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removePayment = (i: number) => setPayments((p) => p.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">Mahsulotlar</h2>
          <button className="btn-primary" onClick={addProduct}><Plus className="h-4 w-4" /> Mahsulot qo'shish</button>
        </div>
        {products.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">Mahsulot qo'shilmagan</div>
        )}
        <div className="space-y-3">
          {products.map((p, i) => (
            <ProductLineItem key={i} index={i} product={p} onChange={(patch) => updateProduct(i, patch)} onRemove={() => removeProduct(i)} historyPrice={historyPrices[p.product_name] ?? null} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Ishlab chiqarish</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">Ishlab chiqaruvchi</label>
            <select className="input" value={payload.production_company} onChange={(e) => onPayloadChange({ production_company: e.target.value })}>
              <option value="">-- tanlang --</option>
              {PRODUCTION_COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tekstil kompaniyasi</label>
            <select className="input" value={payload.textile_company_id || ""} onChange={(e) => {
              const id = e.target.value || null;
              const found = textileCompanies.find((t) => t.id === id);
              onPayloadChange({ textile_company_id: id, textile_company_name: found?.name || "" });
            }}>
              <option value="">-- yo'q --</option>
              {textileCompanies.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ishlab chiqarish menejeri</label>
            <select className="input" value={payload.production_manager} onChange={(e) => onPayloadChange({ production_manager: e.target.value })}>
              <option value="">-- tanlang --</option>
              {managerNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dizayner</label>
            <input className="input" value={payload.designer_name} onChange={(e) => onPayloadChange({ designer_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Dizayn holati</label>
            <select className="input" value={payload.designer_status} onChange={(e) => onPayloadChange({ designer_status: e.target.value })}>
              <option value="">-- tanlang --</option>
              {DESIGNER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Logistika menejeri</label>
            <select className="input" value={payload.logistics_manager} onChange={(e) => onPayloadChange({ logistics_manager: e.target.value })}>
              <option value="">-- tanlang --</option>
              {managerNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sifat nazorati (QC)</label>
            <select className="input" value={payload.qc_manager} onChange={(e) => onPayloadChange({ qc_manager: e.target.value })}>
              <option value="">-- tanlang --</option>
              {managerNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Yetkazish</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">Turi</label>
            <select className="input" value={payload.delivery_type} onChange={(e) => onPayloadChange({ delivery_type: e.target.value })}>
              <option value="">-- tanlang --</option>
              {DELIVERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sana</label>
            <input type="date" className="input" value={payload.delivery_date || ""} onChange={(e) => onPayloadChange({ delivery_date: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Vaqti</label>
            <input type="time" className="input" value={payload.delivery_time} onChange={(e) => onPayloadChange({ delivery_time: e.target.value })} />
          </div>
          <div>
            <label className="label">Kuryer</label>
            <input className="input" value={payload.courier} onChange={(e) => onPayloadChange({ courier: e.target.value })} />
          </div>
          <div>
            <label className="label">Narxi</label>
            <input type="number" className="input" value={payload.delivery_cost || ""} onChange={(e) => onPayloadChange({ delivery_cost: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input className="input" value={payload.delivery_phone} onChange={(e) => onPayloadChange({ delivery_phone: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <label className="label">Manzil</label>
            <input className="input" value={payload.delivery_address} onChange={(e) => onPayloadChange({ delivery_address: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">To'lovlar</h2>
          <button className="btn-primary" onClick={addPayment}><Plus className="h-4 w-4" /> To'lov qo'shish</button>
        </div>
        <div className="mb-3">
          <label className="label">Umumiy chegirma</label>
          <input type="number" className="input max-w-xs" value={payload.discount_amount || ""} onChange={(e) => onPayloadChange({ discount_amount: Number(e.target.value) || 0 })} />
        </div>
        {payments.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">To'lov qo'shilmagan</div>
        )}
        <div className="space-y-2">
          {payments.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-3">
              <div className="col-span-6 md:col-span-2">
                <label className="label">Summa</label>
                <input type="number" className="input" value={p.amount || ""} onChange={(e) => updatePayment(i, { amount: Number(e.target.value) || 0 })} />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="label">Turi</label>
                <select className="input" value={p.payment_type} onChange={(e) => updatePayment(i, { payment_type: e.target.value })}>
                  {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="label">Sana</label>
                <input type="date" className="input" value={p.payment_date} onChange={(e) => updatePayment(i, { payment_date: e.target.value })} />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="label">Qabul qildi</label>
                <input className="input" value={p.received_by} onChange={(e) => updatePayment(i, { received_by: e.target.value })} />
              </div>
              <div className="col-span-10 md:col-span-3">
                <label className="label">Izoh</label>
                <input className="input" value={p.note} onChange={(e) => updatePayment(i, { note: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => removePayment(i)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Izohlar</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Mijozning talabi</label>
            <textarea className="input min-h-[70px]" value={payload.client_request_note} onChange={(e) => onPayloadChange({ client_request_note: e.target.value })} />
          </div>
          <div>
            <label className="label">Mijoz uchun izoh</label>
            <textarea className="input min-h-[70px]" value={payload.customer_note} onChange={(e) => onPayloadChange({ customer_note: e.target.value })} />
          </div>
          <div>
            <label className="label">Ishlab chiqarish izohi</label>
            <textarea className="input min-h-[70px]" value={payload.production_note} onChange={(e) => onPayloadChange({ production_note: e.target.value })} />
          </div>
          <div>
            <label className="label">Logistika izohi</label>
            <textarea className="input min-h-[70px]" value={payload.logistics_note} onChange={(e) => onPayloadChange({ logistics_note: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Ichki izoh (faqat xodimlar uchun)</label>
            <textarea className="input min-h-[70px]" value={payload.private_note} onChange={(e) => onPayloadChange({ private_note: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}