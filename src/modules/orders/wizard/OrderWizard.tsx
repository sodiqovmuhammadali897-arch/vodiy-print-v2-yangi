import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  FileText,
  User,
  Package,
  Paperclip,
  ClipboardCheck,
} from "lucide-react";
import { listAll, getOne } from "../../../lib/firestoreDb";
import type { Brand, Customer, Manager, Order, OrderProduct, OrderPayment, OrderStatus, TextileCompany } from "../../../lib/types";
import { ORDER_STATUSES } from "../../../lib/orderConstants";
import { saveOrder } from "../../../lib/orderService";
import type { OrderPayload, WizardFileLink, WizardPayment, WizardProduct } from "../../../lib/orderService";
import { computeOrderTotals } from "../../../lib/orderCalculations";
import { formatMoney } from "../../../lib/format";
import { useAuth } from "../../../lib/AuthContext";
import type { Staff } from "../../../lib/permissions";
import CustomerStep from "./CustomerStep";
import ProductionStep from "./ProductionStep";
import FilesStep from "./FilesStep";
import ReviewStep from "./ReviewStep";

const STEPS = [
  { key: "customer", label: "Mijoz", icon: User },
  { key: "production", label: "Mahsulot va to'lov", icon: Package },
  { key: "files", label: "Fayllar", icon: Paperclip },
  { key: "review", label: "Tekshirish", icon: ClipboardCheck },
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyPayload = (): OrderPayload => ({
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

export default function OrderWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer");
  const isNew = !id || id === "new";
  const { can, user, staff } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [managerNames, setManagerNames] = useState<string[]>([]);
  const [textileCompanies, setTextileCompanies] = useState<TextileCompany[]>([]);
  const [printers, setPrinters] = useState<Staff[]>([]);
  const [historyPrices, setHistoryPrices] = useState<Record<string, number>>({});

  const [payload, setPayload] = useState<OrderPayload>(emptyPayload());
  const [products, setProducts] = useState<WizardProduct[]>([]);
  const [payments, setPayments] = useState<WizardPayment[]>([]);
  const [files, setFiles] = useState<WizardFileLink[]>([]);

  useEffect(() => {
    const load = async () => {
      const [c, b, m, tx, op, st] = await Promise.all([
        listAll<Customer>("customers", { orderBy: ["first_name", "asc"] }),
        listAll<Brand>("brands", { orderBy: ["name", "asc"] }),
        listAll<Manager>("managers", { orderBy: ["created_at", "asc"] }),
        listAll<TextileCompany>("textile_companies", { orderBy: ["name", "asc"] }),
        listAll<OrderProduct>("order_products"),
        listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
      ]);
      setCustomers(c);
      setBrands(b);
      setManagerNames(m.map((x) => x.name));
      setTextileCompanies(tx);
      setPrinters(
        st.filter((s) => s.role === "admin" || s.permissions?.production?.edit),
      );

      const prices: Record<string, number> = {};
      for (const p of op) {
        if (p.product_name) prices[p.product_name] = p.unit_price;
      }
      setHistoryPrices(prices);

      if (isNew && preselectedCustomerId) {
        const customerBrands = b.filter((br) => br.customer_id === preselectedCustomerId);
        setPayload((p) => ({
          ...p,
          customer_id: preselectedCustomerId,
          brand_id: customerBrands.length === 1 ? customerBrands[0].id : null,
        }));
      }

      if (!isNew && id) {
        const order = await getOne<Order>("orders", id);
        if (order) {
          setInitialStatus(order.status);
          setPayload({
            id: order.id,
            order_number: order.order_number,
            brand_id: order.brand_id,
            customer_id: order.customer_id,
            manager_id: order.manager_id,
            manager_name: order.manager_name || "",
            title: order.title,
            description: order.description || "",
            status: order.status,
            order_date: order.order_date || order.created_at?.slice(0, 10) || todayISO(),
            deadline: order.deadline,
            customer_source: order.customer_source || "",
            production_company: order.production_company || "Vodiy Print",
            textile_company_id: order.textile_company_id || null,
            textile_company_name: order.textile_company_name || "",
            designer_name: order.designer_name || "",
            designer_status: order.designer_status || "Dizayn kerak emas",
            production_manager: order.production_manager || "",
            logistics_manager: order.logistics_manager || "",
            qc_manager: order.qc_manager || "",
            assigned_printer_email: order.assigned_printer_email || "",
            assigned_printer_name: order.assigned_printer_name || "",
            delivery_type: order.delivery_type || "",
            delivery_address: order.delivery_address || "",
            delivery_location_url: order.delivery_location_url || "",
            delivery_phone: order.delivery_phone || "",
            courier: order.courier || "",
            delivery_date: order.delivery_date,
            delivery_time: order.delivery_time || "",
            delivery_cost: Number(order.delivery_cost || 0),
            payment_type: order.payment_type || "Naqd",
            telegram_link: order.telegram_link || "",
            customer_note: order.customer_note || "",
            production_note: order.production_note || "",
            logistics_note: order.logistics_note || "",
            private_note: order.private_note || "",
            client_request_note: order.client_request_note || "",
            discount_amount: Number(order.discount_amount || 0),
            is_draft: !!order.is_draft,
          });

          const [pr, pay, fl] = await Promise.all([
            listAll<OrderProduct>("order_products"),
            listAll<OrderPayment>("order_payments"),
            listAll<WizardFileLink & { order_id: string }>("order_files"),
          ]);
          setProducts(
            pr
              .filter((p) => p.order_id === id)
              .sort((a, b) => a.position - b.position)
              .map((p) => ({
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
                size_breakdown: Array.isArray(p.size_breakdown) ? p.size_breakdown : [],
              })),
          );
          setPayments(
            pay
              .filter((p) => p.order_id === id)
              .map((p) => ({
                amount: Number(p.amount),
                payment_type: p.payment_type,
                payment_date: p.payment_date,
                received_by: p.received_by,
                note: p.note,
              })),
          );
          setFiles(
            fl
              .filter((f) => f.order_id === id)
              .map((f) => ({
                filename: f.filename,
                url: f.url,
                link_type: f.link_type || "Boshqa",
                note: f.note || "",
              })),
          );
        }
        setLoading(false);
      }
    };
    void load();
  }, [id, isNew]);

  const onPayloadChange = (patch: Partial<OrderPayload>) =>
    setPayload((p) => ({ ...p, ...patch }));

  const onCustomerCreated = (c: Customer) => setCustomers((cs) => [...cs, c]);

  const totals = useMemo(
    () => computeOrderTotals(products, payload.discount_amount, payments),
    [products, payload.discount_amount, payments],
  );

  const linkedCustomer = useMemo(
    () => customers.find((c) => c.id === payload.customer_id) || null,
    [customers, payload.customer_id],
  );
  const linkedBrand = useMemo(
    () => brands.find((b) => b.id === payload.brand_id) || null,
    [brands, payload.brand_id],
  );

  const doSave = async (asDraft: boolean) => {
    setError(null);
    const filteredProducts = products.filter((p) => p.product_name.trim() || p.quantity > 0);
    if (!payload.title.trim() && !filteredProducts[0]?.product_name) {
      setError("Buyurtma nomi yoki mahsulot kiritilishi shart");
      return;
    }
    setSaving(true);
    const res = await saveOrder(
      {
        ...payload,
        title: payload.title || filteredProducts[0]?.product_name || "Buyurtma",
        is_draft: asDraft,
      },
      filteredProducts,
      payments,
      files,
      initialStatus
        ? {
            previousStatus: initialStatus,
            actorEmail: user?.email || "",
            actorName: staff?.full_name || user?.email || "",
          }
        : undefined,
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

  if (!can("orders", "edit")) {
    return <Navigate to="/orders" replace />;
  }

  if (loading) {
    return <div className="py-16 text-center text-ink-500">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/orders")} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Buyurtmalar
        </button>
        {payload.order_number && (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            Buyurtma ID:
            <span className="font-display text-lg font-extrabold text-brand-700">
              {payload.order_number}
            </span>
          </div>
        )}
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
          customers={customers}
          brands={brands}
          payload={payload}
          onPayloadChange={onPayloadChange}
          onCustomerCreated={onCustomerCreated}
          managerNames={managerNames}
        />
      )}

      {step === 1 && (
        <ProductionStep
          payload={payload}
          onPayloadChange={onPayloadChange}
          products={products}
          setProducts={setProducts}
          payments={payments}
          setPayments={setPayments}
          textileCompanies={textileCompanies}
          managerNames={managerNames}
          printers={printers}
          historyPrices={historyPrices}
        />
      )}

      {step === 2 && <FilesStep files={files} setFiles={setFiles} />}

      {step === 3 && (
        <ReviewStep
          orderNumber={payload.order_number || ""}
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
            onChange={(e) => onPayloadChange({ status: e.target.value as OrderStatus })}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => doSave(true)} disabled={saving}>
            <Save className="h-4 w-4" /> Qoralama
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={goNext}>
              Keyingisi <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button className="btn-primary" onClick={() => doSave(false)} disabled={saving}>
              <FileText className="h-4 w-4" />
              {saving ? "Saqlanmoqda..." : "Buyurtmani saqlash"}
            </button>
          )}
        </div>
      </div>

      <div className="text-right text-sm text-ink-500">
        Umumiy: <span className="font-semibold text-ink-800">{formatMoney(totals.total)}</span>
        {" · "}Qoldiq: <span className="font-semibold text-ink-800">{formatMoney(totals.remaining)}</span>
      </div>
    </div>
  );
}
