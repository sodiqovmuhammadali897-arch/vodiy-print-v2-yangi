import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { OrderPayload, WizardPayment, WizardProduct } from "../../../lib/orderService";
import type { Product, TextileCompany } from "../../../lib/types";
import { listAll } from "../../../lib/firestoreDb";
import { DESIGNER_STATUSES, DELIVERY_TYPES, PAYMENT_TYPES } from "../../../lib/orderConstants";
import { formatMoney } from "../../../lib/format";
import { discountShare } from "../../../lib/orderCalculations";
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
  size_breakdown: [], files: [],
  production_status: "new", production_company: "Vodiy Print",
  assigned_printer_email: "", assigned_printer_name: "",
  production_accepted_at: null, production_completed_at: null,
};

const emptyPayment: WizardPayment = {
  amount: 0, payment_type: "Naqd", payment_date: new Date().toISOString().slice(0, 10),
  received_by: "", note: "",
};

export default function ProductionStep({
  payload, onPayloadChange, products, setProducts, payments, setPayments,
  textileCompanies, managerNames, historyPrices,
}: Props) {
  // The Mahsulotlar catalog, for the product picker and tier prices.
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    void listAll<Product>("products", { orderBy: ["name", "asc"] })
      .then((rows) => setCatalog(rows.filter((p) => p.is_active !== false && !p.archived_at)))
      .catch(() => setCatalog([]));
  }, []);

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
            <ProductLineItem key={i} index={i} product={p} catalog={catalog} onChange={(patch) => updateProduct(i, patch)} onRemove={() => removeProduct(i)} historyPrice={historyPrices[p.product_name] ?? null} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Ishlab chiqarish</h2>
        <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          Har bir mahsulot uchun ishlab chiqaruvchini "Mahsulotlar" bo'limida, mahsulot ichida belgilang — turli mahsulotlar turli kompaniyalarga (autros) biriktirilishi mumkin.
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {products.some((p) => p.category === "Textil") && (
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
          )}
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:max-w-md">
          <div>
            <label className="label">Turi</label>
            <select className="input" value={payload.delivery_type} onChange={(e) => onPayloadChange({ delivery_type: e.target.value })}>
              <option value="">-- tanlang --</option>
              {DELIVERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Narxi</label>
            <input
              type="number"
              className="input"
              value={payload.delivery_cost || ""}
              onChange={(e) => onPayloadChange({ delivery_cost: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <OrderDiscountCard payload={payload} products={products} onPayloadChange={onPayloadChange} />

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">To'lovlar</h2>
          <button className="btn-primary" onClick={addPayment}><Plus className="h-4 w-4" /> To'lov qo'shish</button>
        </div>
        {payments.length === 0 && (
          <button
            type="button"
            onClick={addPayment}
            className="w-full rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500 hover:border-brand-300 hover:bg-brand-50/40"
          >
            To'lov qo'shilmagan. Mijoz to'lagan summani yozish uchun <b className="text-brand-700">"To'lov qo'shish"</b>ni bosing.
          </button>
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
// The order-level discount, kept apart from the payments below it: typing
// the paid amount here by mistake used to cut the order total.
function OrderDiscountCard({
  payload,
  products,
  onPayloadChange,
}: {
  payload: OrderPayload;
  products: WizardProduct[];
  onPayloadChange: (patch: Partial<OrderPayload>) => void;
}) {
  const d = discountShare(products, payload.discount_amount);
  return (
    <div className="card p-5">
      <h2 className="mb-1 font-display text-lg font-bold text-ink-900">Buyurtmaga chegirma</h2>
      <p className="mb-3 text-xs text-ink-500">
        Faqat mijozga berilgan chegirma yoziladi. Mijoz to'lagan pul bu yerga emas — pastdagi "To'lovlar"ga.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Chegirma (so'm)</label>
          <input
            type="number"
            min={0}
            className={`input max-w-xs ${d.large ? "border-amber-400 bg-amber-50" : ""}`}
            value={payload.discount_amount || ""}
            placeholder="0"
            onChange={(e) => onPayloadChange({ discount_amount: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="pb-2 text-sm text-ink-600">
          Mahsulotlar: <b>{formatMoney(d.gross)}</b>
          {d.total > 0 && (
            <>
              {" "}· chegirma <b>{formatMoney(d.total)}</b> ({d.percent.toFixed(0)}%)
            </>
          )}{" "}
          · jami <b>{formatMoney(Math.max(0, d.gross - d.total))}</b>
        </div>
      </div>
      {d.large && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            ⚠️ Chegirma summaning <b>{d.percent.toFixed(0)}%</b>i. Mijoz to'lagan pulni yozmoqchi bo'lsangiz — uni "To'lovlar"ga yozing.
          </span>
          {payload.discount_amount > 0 && (
            <button type="button" className="btn-secondary text-xs" onClick={() => onPayloadChange({ discount_amount: 0 })}>
              Chegirmani olib tashlash
            </button>
          )}
        </div>
      )}
    </div>
  );
}
