import { useEffect, useState } from "react";
import { Archive, Plus, Trash2 } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Customer, Manager, Product } from "../../lib/types";
import { PAYMENT_TYPES, CUSTOMER_SOURCES } from "../../lib/orderConstants";
import { tierPriceFor } from "../../lib/priceTiers";
import { saveOrder } from "../../lib/orderService";
import type { OrderPayload, WizardPayment, WizardProduct } from "../../lib/orderService";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onSaved: () => void;
};

type Line = { productId: string; productName: string; category: string; quantity: number; unitPrice: number };

const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ productId: "", productName: "", category: "", quantity: 0, unitPrice: 0 });

type PayStatus = "paid" | "partial" | "unpaid";

export default function HistoricalOrderModal({ open, onClose, customer, onSaved }: Props) {
  const { user, staff } = useAuth();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);

  const [orderDate, setOrderDate] = useState(todayISO());
  const [totalOnlyMode, setTotalOnlyMode] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [payStatus, setPayStatus] = useState<PayStatus>("paid");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [managerId, setManagerId] = useState("");
  const [paymentType, setPaymentType] = useState<string>(PAYMENT_TYPES[0]);
  const [customerSource, setCustomerSource] = useState("");
  const [historicalRef, setHistoricalRef] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      listAll<Product>("products", { orderBy: ["name", "asc"] }),
      listAll<Manager>("managers", { orderBy: ["name", "asc"] }),
    ]).then(([p, m]) => {
      setCatalog(p);
      setManagers(m);
    });
    setOrderDate(todayISO());
    setTotalOnlyMode(false);
    setLines([emptyLine()]);
    setManualTotal(0);
    setPayStatus("paid");
    setPaidAmount(0);
    setPaymentDate("");
    setManagerId("");
    setPaymentType(PAYMENT_TYPES[0]);
    setCustomerSource("");
    setHistoricalRef("");
    setNote("");
    setError(null);
  }, [open]);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addLine = () => setLines((rows) => [...rows, emptyLine()]);
  const removeLine = (i: number) => setLines((rows) => (rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i)));

  const pickProduct = (i: number, productId: string) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) {
      updateLine(i, { productId: "", productName: "" });
      return;
    }
    const qty = lines[i].quantity || product.min_order_qty || 1;
    updateLine(i, {
      productId,
      productName: product.name,
      category: product.category,
      quantity: qty,
      unitPrice: tierPriceFor(product.price_tiers || [], qty),
    });
  };

  const linesTotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const orderTotal = totalOnlyMode ? manualTotal : linesTotal;

  const submit = async () => {
    setError(null);
    if (!orderDate) return setError("Buyurtma sanasini kiriting");
    if (totalOnlyMode) {
      if (manualTotal <= 0) return setError("Jami summani kiriting");
    } else {
      const valid = lines.filter((l) => l.productName.trim() && l.quantity > 0);
      if (valid.length === 0) return setError("Kamida bitta mahsulot qatorini to'ldiring");
    }

    const manager = managers.find((m) => m.id === managerId);
    const receivedBy = staff?.full_name || user?.email || "";

    const products: WizardProduct[] = totalOnlyMode
      ? [
          {
            position: 0,
            category: "",
            product_name: "Eski buyurtma (mahsulotlar ko'rsatilmagan)",
            variant: "",
            size: "",
            material: "",
            color: "",
            quantity: 1,
            unit_price: manualTotal,
            discount: 0,
            total: manualTotal,
            note: "",
            size_breakdown: [],
            production_status: "delivered",
            production_company: "",
            assigned_printer_email: "",
            assigned_printer_name: "",
            production_accepted_at: null,
            production_completed_at: orderDate,
          },
        ]
      : lines
          .filter((l) => l.productName.trim() && l.quantity > 0)
          .map((l, i) => ({
            position: i,
            category: l.category,
            product_name: l.productName.trim(),
            variant: "",
            size: "",
            material: "",
            color: "",
            quantity: l.quantity,
            unit_price: l.unitPrice,
            discount: 0,
            total: l.quantity * l.unitPrice,
            note: "",
            size_breakdown: [],
            production_status: "delivered",
            production_company: "",
            assigned_printer_email: "",
            assigned_printer_name: "",
            production_accepted_at: null,
            production_completed_at: orderDate,
          }));

    const paidNow = payStatus === "paid" ? orderTotal : payStatus === "partial" ? paidAmount : 0;
    const payments: WizardPayment[] =
      paidNow > 0
        ? [
            {
              amount: paidNow,
              payment_type: paymentType,
              payment_date: paymentDate || orderDate,
              received_by: receivedBy,
              note: "",
            },
          ]
        : [];

    const payload: OrderPayload = {
      order_number: null,
      brand_id: null,
      customer_id: customer.id,
      manager_id: managerId || null,
      manager_name: manager?.name || "",
      title: totalOnlyMode ? "Eski buyurtma" : lines[0]?.productName.trim() || "Eski buyurtma",
      description: "",
      status: "closed",
      order_date: orderDate,
      deadline: null,
      customer_source: customerSource,
      production_company: "",
      textile_company_id: null,
      textile_company_name: "",
      designer_name: "",
      designer_status: "Dizayn kerak emas",
      production_manager: "",
      logistics_manager: "",
      qc_manager: "",
      assigned_printer_email: "",
      assigned_printer_name: "",
      delivery_type: "",
      delivery_address: "",
      delivery_location_url: "",
      delivery_phone: "",
      courier: "",
      delivery_date: null,
      delivery_time: "",
      delivery_cost: 0,
      payment_type: paymentType,
      telegram_link: "",
      customer_note: "",
      production_note: "",
      logistics_note: "",
      private_note: note.trim(),
      client_request_note: "",
      discount_amount: 0,
      is_draft: false,
      is_historical: true,
      historical_ref: historicalRef.trim(),
    };

    setSaving(true);
    const res = await saveOrder(payload, products, payments, []);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Eski buyurtma qo'shish"
      description={`${customer.first_name} ${customer.last_name}`.trim()}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash (arxivga qo'shish)"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-brand-50 px-3.5 py-3 text-xs text-brand-800">
        <p>
          Bu buyurtma arxivga qo'shiladi va faqat mijoz statistikasi uchun ishlatiladi. Ishlab chiqarish,
          ombor, logistika jarayonlariga chiqmaydi.
        </p>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-brand-700">
          <Archive className="h-3 w-3" /> Arxiv buyurtma
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Buyurtma sanasi *</label>
          <input type="date" className="input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Eski buyurtma ID (bo'lsa)</label>
          <input
            className="input"
            placeholder="masalan: daftar-045"
            value={historicalRef}
            onChange={(e) => setHistoricalRef(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-ink-200">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-3.5 py-2.5">
          <b className="text-sm text-ink-900">Buyurtma mahsulotlari</b>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-600">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={totalOnlyMode}
              onChange={(e) => setTotalOnlyMode(e.target.checked)}
            />
            Faqat summani bilaman
          </label>
        </div>

        {totalOnlyMode ? (
          <div className="p-3.5">
            <label className="label">Jami summa</label>
            <input
              type="number"
              className="input max-w-xs"
              value={manualTotal || ""}
              onChange={(e) => setManualTotal(Number(e.target.value) || 0)}
            />
          </div>
        ) : (
          <div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-ink-100 px-3.5 py-2 last:border-b-0">
                <select
                  className="input col-span-5"
                  value={l.productId}
                  onChange={(e) => pickProduct(i, e.target.value)}
                >
                  <option value="">-- mahsulot tanlang --</option>
                  {catalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input col-span-2"
                  placeholder="Soni"
                  value={l.quantity || ""}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  className="input col-span-2"
                  placeholder="Dona narxi"
                  value={l.unitPrice || ""}
                  onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })}
                />
                <div className="col-span-2 text-right text-sm font-semibold text-ink-900">
                  {(l.quantity * l.unitPrice).toLocaleString("uz-UZ")}
                </div>
                <button
                  className="col-span-1 flex justify-end text-ink-400 hover:text-rose-600"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between bg-ink-50/60 px-3.5 py-2.5">
              <button className="text-xs font-bold text-brand-700" onClick={addLine}>
                <span className="inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Mahsulot qo'shish
                </span>
              </button>
              <span className="text-xs text-ink-600">
                Mahsulotlar jami: <b className="text-ink-900">{linesTotal.toLocaleString("uz-UZ")} so'm</b>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">To'lov holati *</label>
          <select className="input" value={payStatus} onChange={(e) => setPayStatus(e.target.value as PayStatus)}>
            <option value="paid">To'liq to'langan</option>
            <option value="partial">Qisman to'langan</option>
            <option value="unpaid">To'lanmagan</option>
          </select>
        </div>
        {payStatus === "partial" ? (
          <div>
            <label className="label">To'langan summa</label>
            <input
              type="number"
              className="input"
              value={paidAmount || ""}
              onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
            />
          </div>
        ) : (
          <div>
            <label className="label">To'lov sanasi (agar ma'lum bo'lsa)</label>
            <input
              type="date"
              className="input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={payStatus === "unpaid"}
            />
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Menejer</label>
          <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">-- tanlanmagan --</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To'lov turi</label>
          <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            {PAYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="label">Manba</label>
        <select className="input" value={customerSource} onChange={(e) => setCustomerSource(e.target.value)}>
          <option value="">-- tanlanmagan --</option>
          {CUSTOMER_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="label">Izoh (ixtiyoriy)</label>
        <textarea
          className="input min-h-[60px]"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="mt-1 text-right text-[11px] text-ink-400">{note.length} / 500</p>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50/60 px-3.5 py-2.5 text-sm">
        <span className="text-ink-600">Jami summa</span>
        <b className="text-ink-900">{orderTotal.toLocaleString("uz-UZ")} so'm</b>
      </div>
      {payStatus === "partial" && paidAmount > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <span>Qoldiq qarz</span>
          <b>{Math.max(0, orderTotal - paidAmount).toLocaleString("uz-UZ")} so'm</b>
        </div>
      )}
    </Modal>
  );
}
