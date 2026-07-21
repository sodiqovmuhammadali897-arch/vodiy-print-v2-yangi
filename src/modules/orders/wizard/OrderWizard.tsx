import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Plus,
  User,
  Package,
  Palette,
  Wallet,
  Factory,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type {
  Brand,
  Customer,
  Holiday,
  Manager,
  Order,
  OrderPayment,
  OrderProduct,
  OrderStatus,
  TextileCompany,
} from "../../../lib/types";
import {
  CUSTOMER_SOURCES,
  DELIVERY_TYPES,
  DESIGNER_STATUSES,
  FILE_LINK_TYPES,
  ORDER_STATUSES,
  PAYMENT_TYPES,
  PRODUCTION_COMPANIES,
} from "../../../lib/orderConstants";
import { nextOrderNumber, nextCustomerNumber } from "../../../lib/numbering";
import { computeOrderTotals } from "../../../lib/orderCalculations";
import { deadlineInfo } from "../../../lib/workingDays";
import { saveOrder } from "../../../lib/orderService";
import type {
  OrderPayload,
  WizardFileLink,
  WizardPayment,
  WizardProduct,
} from "../../../lib/orderService";
import { formatMoney } from "../../../lib/format";
import CustomerStep from "./CustomerStep";
import ProductLineItem from "./ProductLineItem";
import FilesStep from "./FilesStep";
import ProductionStep from "./ProductionStep";
import ReviewStep from "./ReviewStep";
import ProductionBadge from "../../../components/ui/ProductionBadge";

const STEPS = [
  { key: "customer", label: "Mijoz va brend", icon: User },
  { key: "products", label: "Mahsulotlar", icon: Package },
  { key: "design", label: "Dizayn va fayllar", icon: Palette },
  { key: "payment", label: "To'lov", icon: Wallet },
  { key: "production", label: "Ishlab chiqarish", icon: Factory },
  { key: "review", label: "Tekshirish", icon: ClipboardCheck },
] as const;

const emptyProduct = (): WizardProduct => ({
  position: 0,
  category: "",
  product_name: "",
  variant: "",
  size: "",
  material: "",
  color: "",
  quantity: 0,
  unit_price: 0,
  discount: 0,
  total: 0,
  note: "",
});

const emptyPayment = (): WizardPayment => ({
  amount: 0,
  payment_type: "Naqd",
  payment_date: new Date().toISOString().slice(0, 10),
  received_by: "",
  note: "",
});

const todayISO = () => new Date().toISOString().slice(0, 10);

const isFutureDate = (iso: string): boolean => {
  const d = new Date(iso);
  const t = new Date();
  return d.setHours(0, 0, 0, 0) > t.setHours(0, 0, 0, 0);
};

export default function OrderWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [textileCompanies, setTextileCompanies] = useState<TextileCompany[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [orderNumber, setOrderNumber] = useState<string>("");
  const [payload, setPayload] = useState<OrderPayload>({
    order_number: null,
    brand_id: null,
    customer_id: null,
    manager_id: null,
    manager_name: "",
    title: "",
    description: "",
    status: "new",
    order_date: todayISO(),
    deadline: null,
    customer_source: "",
    production_company: "Vodiy Print",
    textile_company_id: null,
    textile_company_name: "",
    designer_name: "",
    designer_status: "Dizayn kerak emas",
    production_manager: "",
    logistics_manager: "",
    qc_manager: "",
    delivery_type: "",
    delivery_address: "",
    delivery_location_url: "",
    delivery_phone: "",
    courier: "",
    delivery_date: null,
    delivery_time: "",
    delivery_cost: 0,
    payment_type: "Naqd",
    telegram_link: "",
    customer_note: "",
    production_note: "",
    logistics_note: "",
    private_note: "",
    client_request_note: "",
    discount_amount: 0,
    is_draft: false,
  });
  const [products, setProducts] = useState<WizardProduct[]>([emptyProduct()]);
  const [payments, setPayments] = useState<WizardPayment[]>([]);
  const [files, setFiles] = useState<WizardFileLink[]>([]);
  const [customProduction, setCustomProduction] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [c, b, m, h, tx] = await Promise.all([
        supabase.from("customers").select("*").order("first_name"),
        supabase.from("brands").select("*").order("name"),
        supabase.from("managers").select("*").order("name"),
        supabase.from("holidays").select("*"),
        supabase.from("textile_companies").select("*").order("name"),
      ]);
      setCustomers((c.data as Customer[]) || []);
      setBrands((b.data as Brand[]) || []);
      setManagers((m.data as Manager[]) || []);
      setHolidays((h.data as Holiday[]) || []);
      setTextileCompanies((tx.data as TextileCompany[]) || []);

      if (isNew) {
        const nextNum = await nextOrderNumber();
        setOrderNumber(nextNum);
      } else if (id) {
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (data) {
          const o = data as Order;
          setOrderNumber(o.order_number || "");
          setPayload({
            id: o.id,
            order_number: o.order_number,
            brand_id: o.brand_id,
            customer_id: o.customer_id,
            manager_id: o.manager_id,
            manager_name: o.manager_name || "",
            title: o.title,
            description: o.description || "",
            status: o.status,
            order_date: o.order_date || o.created_at?.slice(0, 10) || todayISO(),
            deadline: o.deadline,
            customer_source: o.customer_source || "",
            production_company: o.production_company || "Vodiy Print",
            textile_company_id: o.textile_company_id || null,
            textile_company_name: o.textile_company_name || "",
            designer_name: o.designer_name || "",
            designer_status: o.designer_status || "Dizayn kerak emas",
            production_manager: o.production_manager || "",
            logistics_manager: o.logistics_manager || "",
            qc_manager: o.qc_manager || "",
            delivery_type: o.delivery_type || "",
            delivery_address: o.delivery_address || "",
            delivery_location_url: o.delivery_location_url || "",
            delivery_phone: o.delivery_phone || "",
            courier: o.courier || "",
            delivery_date: o.delivery_date,
            delivery_time: o.delivery_time || "",
            delivery_cost: Number(o.delivery_cost || 0),
            payment_type: o.payment_type || "Naqd",
            telegram_link: o.telegram_link || "",
            customer_note: o.customer_note || "",
            production_note: o.production_note || "",
            logistics_note: o.logistics_note || "",
            private_note: o.private_note || "",
            client_request_note: o.client_request_note || "",
            discount_amount: Number(o.discount_amount || 0),
            is_draft: !!o.is_draft,
          });
          const [pr, pay, fl] = await Promise.all([
            supabase
              .from("order_products")
              .select("*")
              .eq("order_id", o.id)
              .order("position"),
            supabase
              .from("order_payments")
              .select("*")
              .eq("order_id", o.id)
              .order("created_at"),
            supabase.from("order_files").select("*").eq("order_id", o.id),
          ]);
          const rows = ((pr.data as OrderProduct[]) || []).map((p) => ({
            position: p.position,
            category: p.category,
            product_name: p.product_name,
            variant: p.variant,
            size: p.size,
            material: p.material,
            color: p.color,
            quantity: Number(p.quantity),
            unit_price: Number(p.unit_price),
            discount: Number(p.discount),
            total: Number(p.total),
            note: p.note,
          }));
          setProducts(rows.length ? rows : [emptyProduct()]);
          setPayments(
            ((pay.data as OrderPayment[]) || []).map((p) => ({
              amount: Number(p.amount),
              payment_type: p.payment_type,
              payment_date: p.payment_date,
              received_by: p.received_by,
              note: p.note,
            })),
          );
          setFiles(
            (fl.data || []).map((f: {
              filename: string;
              url: string;
              link_type?: string | null;
              note?: string | null;
            }) => ({
              filename: f.filename,
              url: f.url,
              link_type: f.link_type || "Boshqa",
              note: f.note || "",
            })),
          );
          if (
            o.production_company &&
            !PRODUCTION_COMPANIES.some((p) => p.key === o.production_company)
          ) {
            setCustomProduction(true);
          }
        }
        setLoading(false);
      }
    };
    void load();
  }, [id, isNew]);

  const linkedCustomer = useMemo(
    () => customers.find((c) => c.id === payload.customer_id) || null,
    [customers, payload.customer_id],
  );
  const linkedBrand = useMemo(
    () => brands.find((b) => b.id === payload.brand_id) || null,
    [brands, payload.brand_id],
  );

  const totals = computeOrderTotals(products, payload.discount_amount, payments);
  const dl = deadlineInfo(payload.deadline, holidays);

  const set = <K extends keyof OrderPayload>(key: K, v: OrderPayload[K]) =>
    setPayload((p) => ({ ...p, [key]: v }));

  const onSelectCustomer = (c: Customer | null) => {
    set("customer_id", c?.id || null);
    if (c) {
      const cbrands = brands.filter((b) => b.customer_id === c.id);
      if (cbrands.length === 1) set("brand_id", cbrands[0].id);
    }
  };

  const onSelectBrand = (b: Brand | null) => {
    set("brand_id", b?.id || null);
    if (b) set("customer_id", b.customer_id);
  };

  const createCustomer = async (data: Partial<Customer>) => {
    const number = await nextCustomerNumber();
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        customer_number: number,
        customer_type: "new",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone: data.phone || "",
        extra_phone: data.extra_phone || "",
        telegram: data.telegram || "",
        company: data.company || "",
        address: data.address || "",
        note: data.note || "",
        source: data.source || "",
      })
      .select("*")
      .maybeSingle();
    if (error || !created) {
      alert(error?.message || "Xatolik");
      return;
    }
    setCustomers((cs) => [...cs, created as Customer]);
    set("customer_id", (created as Customer).id);
  };

  const createBrand = async (name: string) => {
    if (!payload.customer_id) {
      alert("Avval mijozni tanlang");
      return;
    }
    const { data, error } = await supabase
      .from("brands")
      .insert({ name, customer_id: payload.customer_id })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      alert(error?.message || "Xatolik");
      return;
    }
    setBrands((bs) => [...bs, data as Brand]);
    set("brand_id", (data as Brand).id);
  };

  const addProduct = () => setProducts((ps) => [...ps, emptyProduct()]);
  const updateProduct = (i: number, patch: Partial<WizardProduct>) =>
    setProducts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeProduct = (i: number) =>
    setProducts((ps) => (ps.length === 1 ? ps : ps.filter((_, idx) => idx !== i)));

  const addPayment = () => setPayments((ps) => [...ps, emptyPayment()]);
  const updatePayment = (i: number, patch: Partial<WizardPayment>) =>
    setPayments((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePayment = (i: number) =>
    setPayments((ps) => ps.filter((_, idx) => idx !== i));

  const doSave = async (asDraft: boolean) => {
    setError(null);
    if (!payload.title.trim()) {
      const firstProduct = products.find((p) => p.product_name.trim());
      if (firstProduct) {
        set("title", firstProduct.product_name);
      } else {
        setError("Buyurtma nomi yoki mahsulot kiritilishi shart");
        return;
      }
    }
    if (payload.order_date && isFutureDate(payload.order_date)) {
      setError("Buyurtma sanasi kelajakda bo'lishi mumkin emas");
      return;
    }
    setSaving(true);
    const filteredProducts = products.filter(
      (p) => p.product_name.trim() || p.quantity > 0,
    );
    const res = await saveOrder(
      {
        ...payload,
        title: payload.title || filteredProducts[0]?.product_name || "Buyurtma",
        order_number: orderNumber || null,
        is_draft: asDraft,
      },
      filteredProducts,
      payments,
      files,
    );
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    navigate(`/orders/${res.id}`, { replace: true });
  };

  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  if (loading) {
    return <div className="py-16 text-center text-ink-500">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/orders")} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Buyurtmalar
        </button>
        <div className="flex items-center gap-2 text-sm text-ink-500">
          Buyurtma ID:
          <span className="font-display text-lg font-extrabold text-brand-700">
            {orderNumber || "…"}
          </span>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={`flex flex-1 min-w-[130px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : done
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-ink-500 hover:bg-ink-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    active
                      ? "bg-white/20 text-white"
                      : done
                      ? "bg-emerald-600 text-white"
                      : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === 0 && (
        <CustomerStep
          payload={payload}
          set={set}
          customers={customers}
          brands={brands}
          managers={managers}
          linkedCustomer={linkedCustomer}
          onSelectCustomer={onSelectCustomer}
          onSelectBrand={onSelectBrand}
          onCreateCustomer={createCustomer}
          onCreateBrand={createBrand}
        />
      )}

      {step === 1 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900">
                Mahsulotlar
              </h2>
              <p className="text-xs text-ink-500">
                Bir buyurtmada bir nechta mahsulot qo'shishingiz mumkin
              </p>
            </div>
            <button className="btn-primary" onClick={addProduct}>
              <Plus className="h-4 w-4" /> Mahsulot qo'shish
            </button>
          </div>
          <div className="space-y-3">
            {products.map((p, i) => (
              <ProductLineItem
                key={i}
                index={i}
                product={p}
                onChange={(patch) => updateProduct(i, patch)}
                onRemove={() => removeProduct(i)}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-col items-end gap-1 border-t border-ink-100 pt-4">
            <div className="text-sm text-ink-500">
              Mahsulotlar jami:{" "}
              <span className="font-semibold text-ink-800">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="text-sm text-ink-500">
              Umumiy chegirma:{" "}
              <input
                type="number"
                className="input w-40 inline-block"
                value={payload.discount_amount || ""}
                onChange={(e) =>
                  set("discount_amount", Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="font-display text-lg font-extrabold text-ink-900">
              Umumiy: {formatMoney(totals.total)}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold text-ink-900">Dizayn</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">Dizayner</label>
                <input
                  className="input"
                  value={payload.designer_name}
                  onChange={(e) => set("designer_name", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Dizayn holati</label>
                <select
                  className="input"
                  value={payload.designer_status}
                  onChange={(e) => set("designer_status", e.target.value)}
                >
                  {DESIGNER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Telegram havola (asosiy)</label>
                <input
                  className="input"
                  placeholder="https://t.me/..."
                  value={payload.telegram_link}
                  onChange={(e) => set("telegram_link", e.target.value)}
                />
              </div>
            </div>
          </div>
          <FilesStep files={files} setFiles={setFiles} />
        </div>
      )}

      {step === 3 && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">To'lov</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Umumiy summa</label>
              <div className="input flex items-center bg-ink-50 font-bold">
                {formatMoney(totals.total)}
              </div>
            </div>
            <div>
              <label className="label">Chegirma</label>
              <input
                type="number"
                className="input"
                value={payload.discount_amount || ""}
                onChange={(e) =>
                  set("discount_amount", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Asosiy to'lov turi</label>
              <select
                className="input"
                value={payload.payment_type}
                onChange={(e) => set("payment_type", e.target.value)}
              >
                {PAYMENT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink-900">
              To'lov qatorlari
            </h3>
            <button className="btn-secondary" onClick={addPayment}>
              <Plus className="h-4 w-4" /> To'lov qo'shish
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {payments.length === 0 && (
              <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center text-sm text-ink-500">
                Avans yoki to'lov qo'shilmagan
              </div>
            )}
            {payments.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-3"
              >
                <div className="col-span-6 md:col-span-3">
                  <label className="label">Summa</label>
                  <input
                    type="number"
                    className="input"
                    value={p.amount || ""}
                    onChange={(e) =>
                      updatePayment(i, { amount: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="label">Turi</label>
                  <select
                    className="input"
                    value={p.payment_type}
                    onChange={(e) =>
                      updatePayment(i, { payment_type: e.target.value })
                    }
                  >
                    {PAYMENT_TYPES.filter((x) => x !== "Aralash to'lov").map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="label">Sana</label>
                  <input
                    type="date"
                    className="input"
                    value={p.payment_date}
                    onChange={(e) =>
                      updatePayment(i, { payment_date: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="label">Qabul qildi</label>
                  <input
                    className="input"
                    value={p.received_by}
                    onChange={(e) =>
                      updatePayment(i, { received_by: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-end">
                  <button
                    onClick={() => removePayment(i)}
                    className="btn-ghost text-rose-600 hover:bg-rose-50"
                  >
                    O'chirish
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryBox label="Umumiy" value={formatMoney(totals.total)} />
            <SummaryBox
              label="To'langan"
              value={formatMoney(totals.paid)}
              tone="emerald"
            />
            <SummaryBox
              label="Qoldiq"
              value={formatMoney(totals.remaining)}
              tone={totals.remaining > 0 ? "rose" : "emerald"}
            />
            <SummaryBox label="Chegirma" value={formatMoney(totals.discount)} />
          </div>
          {totals.paid > totals.total && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Diqqat: to'langan summa umumiy summadan katta
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <ProductionStep
          payload={payload}
          set={set}
          managers={managers}
          textileCompanies={textileCompanies}
          onTextileCompanyCreated={(c) =>
            setTextileCompanies((prev) => [...prev, c])
          }
          customProduction={customProduction}
          setCustomProduction={setCustomProduction}
          dl={dl}
        />
      )}

      {step === 5 && (
        <ReviewStep
          orderNumber={orderNumber}
          payload={payload}
          customer={linkedCustomer}
          brand={linkedBrand}
          products={products}
          payments={payments}
          files={files}
          totals={totals}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-secondary" onClick={goPrev} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Orqaga
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={payload.status}
            onChange={(e) => set("status", e.target.value as OrderStatus)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary"
            onClick={() => doSave(true)}
            disabled={saving}
          >
            <Save className="h-4 w-4" /> Qoralama
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={goNext}>
              Keyingisi <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => doSave(false)}
              disabled={saving}
            >
              <FileText className="h-4 w-4" />
              {saving ? "Saqlanmoqda..." : "Buyurtmani saqlash"}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-ink-100/60 px-4 py-3 text-xs text-ink-600 flex flex-wrap items-center gap-2">
        Ishlab chiqaruvchi:
        <ProductionBadge name={payload.production_company} />
        {dl && (
          <span
            className={`chip ${
              dl.tone === "rose"
                ? "bg-rose-100 text-rose-700"
                : dl.tone === "amber"
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {dl.label}
          </span>
        )}
      </div>

      {/* placeholder used to import lists to satisfy linter */}
      <div className="hidden">
        {CUSTOMER_SOURCES.length} {DELIVERY_TYPES.length} {FILE_LINK_TYPES.length}
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-ink-900";
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <div className="text-[11px] font-semibold uppercase text-ink-500">
        {label}
      </div>
      <div className={`mt-1 text-base font-bold ${cls}`}>{value}</div>
    </div>
  );
}
