import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Building2,
  Phone,
  MapPin,
  ExternalLink,
  Pencil,
  Copy,
  Truck,
  Factory,
  StickyNote,
  ClipboardCopy,
  Paperclip,
  Shirt,
  History,
  CheckCircle2,
  FileOutput,
} from "lucide-react";
import {
  getOne,
  insertMany,
  insertOne,
  listAll,
  listWhere,
  updateOne,
} from "../../lib/firestoreDb";
import type {
  Brand,
  CompanySettings,
  Customer,
  Holiday,
  Order,
  OrderFile,
  OrderPayment,
  OrderProduct,
  OrderStatus,
  StatusHistoryEntry,
  TextileCompany,
} from "../../lib/types";
import StatusBadge from "../../components/ui/StatusBadge";
import ProductionCompanyBadges from "../../components/ui/ProductionCompanyBadges";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import TextileMatrixTable from "../../components/textile/TextileMatrixTable";
import TextileMatrixExport from "../textile/TextileMatrixExport";
import { pivotTextileBreakdown } from "../../lib/textileMatrix";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";
import { nextOrderNumber } from "../../lib/numbering";
import { ORDER_STATUSES } from "../../lib/orderConstants";
import { changeOrderStatus } from "../../lib/orderStatus";
import { maybePromoteCustomer } from "../../lib/orderService";
import { useAuth } from "../../lib/AuthContext";
import RequireCustomerModal from "./RequireCustomerModal";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, staff, can } = useAuth();
  const canEdit = can("orders", "edit");
  const [statusSaving, setStatusSaving] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [requireCustomerOpen, setRequireCustomerOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [textile, setTextile] = useState<TextileCompany | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ord = await getOne<Order>("orders", id);
      setOrder(ord);
      if (ord) {
        // allSettled, not all — a single denied/failed read (e.g. one
        // linked doc the current user can't see) must not blank out the
        // rest of an otherwise-successful load. Each slot logs its own
        // collection name on failure so a real permission gap is easy
        // to spot instead of the whole page silently looking empty.
        const labeled: [string, Promise<unknown>][] = [
          ["brands", ord.brand_id ? getOne<Brand>("brands", ord.brand_id) : Promise.resolve(null)],
          ["customers", ord.customer_id ? getOne<Customer>("customers", ord.customer_id) : Promise.resolve(null)],
          ["order_products", listWhere<OrderProduct>("order_products", "order_id", ord.id, { orderBy: ["position", "asc"] })],
          ["order_payments", listWhere<OrderPayment>("order_payments", "order_id", ord.id, { orderBy: ["payment_date", "asc"] })],
          ["order_files", listWhere<OrderFile>("order_files", "order_id", ord.id, { orderBy: ["created_at", "desc"] })],
          ["holidays", listAll<Holiday>("holidays")],
          ["textile_companies", ord.textile_company_id ? getOne<TextileCompany>("textile_companies", ord.textile_company_id) : Promise.resolve(null)],
          ["order_status_history", listWhere<StatusHistoryEntry>("order_status_history", "order_id", ord.id, { orderBy: ["changed_at", "asc"] })],
          ["company_settings", getOne<CompanySettings>("company_settings", "main")],
        ];
        const settled = await Promise.allSettled(labeled.map(([, p]) => p));
        const value = <T,>(i: number, fallback: T): T => {
          const r = settled[i];
          if (r.status === "fulfilled") return r.value as T;
          console.error(`Buyurtma sahifasi: "${labeled[i][0]}" o'qishda xatolik`, r.reason);
          return fallback;
        };
        setBrand(value(0, null));
        setCustomer(value(1, null));
        setProducts(value(2, []));
        setPayments(value(3, []));
        setFiles(value(4, []));
        setHolidays(value(5, []));
        setTextile(value(6, null));
        setStatusHistory(value(7, []));
        setCompany(value(8, null));
      }
    } catch (e) {
      console.error("Buyurtmani yuklashda xatolik", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const applyStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setStatusSaving(true);
    try {
      await changeOrderStatus(order.id, status, {
        email: user?.email || "",
        name: staff?.full_name || user?.email || "",
      });
      await load();
    } catch (e) {
      alert(
        e instanceof Error
          ? `Statusni o'zgartirib bo'lmadi: ${e.message}`
          : "Statusni o'zgartirib bo'lmadi",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  // Delivery is the natural checkpoint to make sure a completed sale has a
  // real customer behind it, so marking "Yetkazildi" without one linked
  // pauses to ask for one first instead of silently completing the order.
  const changeStatus = async (status: OrderStatus) => {
    if (!order || status === order.status) return;
    if (status === "delivered" && !order.customer_id) {
      if (allCustomers.length === 0) {
        const rows = await listAll<Customer>("customers", {
          orderBy: ["first_name", "asc"],
        });
        setAllCustomers(rows);
      }
      setPendingStatus(status);
      setRequireCustomerOpen(true);
      return;
    }
    await applyStatusChange(status);
  };

  const onCustomerSelected = async (c: Customer) => {
    setRequireCustomerOpen(false);
    if (!order || !pendingStatus) return;
    try {
      await updateOne("orders", order.id, { customer_id: c.id });
      await maybePromoteCustomer(c.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
      setPendingStatus(null);
      return;
    }
    const status = pendingStatus;
    setPendingStatus(null);
    await applyStatusChange(status);
  };

  const confirmTextileSizes = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      await updateOne("orders", order.id, {
        textile_sizes_confirmed_at: new Date().toISOString(),
        textile_sizes_confirmed_by: staff?.full_name || user?.email || "",
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Tasdiqlab bo'lmadi");
    } finally {
      setConfirming(false);
    }
  };

  const duplicate = async () => {
    if (!order) return;
    setDuplicating(true);
    const number = await nextOrderNumber();
    const {
      id: _id,
      order_number: _on,
      created_at: _ca,
      completed_at: _cd,
      ...rest
    } = order;
    void _id;
    void _on;
    void _ca;
    void _cd;
    try {
      const created = await insertOne("orders", {
        ...rest,
        order_number: number,
        status: "new",
        paid_amount: 0,
        remaining_amount: order.total_amount,
        is_draft: false,
        order_date: new Date().toISOString().slice(0, 10),
        // A duplicated order is a fresh one — the client hasn't confirmed
        // sizes for it yet, even if the original order had been confirmed.
        textile_sizes_confirmed_at: null,
        textile_sizes_confirmed_by: "",
      });
      if (products.length > 0) {
        await insertMany(
          "order_products",
          products.map((p) => ({
            order_id: created.id,
            position: p.position,
            category: p.category,
            product_name: p.product_name,
            variant: p.variant,
            size: p.size,
            material: p.material,
            color: p.color,
            quantity: p.quantity,
            unit_price: p.unit_price,
            discount: p.discount,
            total: p.total,
            note: p.note,
            size_breakdown: p.size_breakdown,
            // A duplicated order's production work hasn't started yet,
            // even if the original line was already finished.
            production_status: "new",
            production_company: p.production_company || "Vodiy Print",
            assigned_printer_email: "",
            assigned_printer_name: "",
            production_accepted_at: null,
            production_completed_at: null,
          })),
        );
      }
      navigate(`/orders/${created.id}/edit`);
    } finally {
      setDuplicating(false);
    }
  };

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      /* ignored */
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-ink-500">Yuklanmoqda...</div>;
  }
  if (!order) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-600">Buyurtma topilmadi</p>
        <button className="btn-secondary mt-3" onClick={() => navigate("/orders")}>
          Ortga
        </button>
      </div>
    );
  }

  const debt =
    Number(order.remaining_amount || 0) ||
    Math.max(0, Number(order.total_amount) - Number(order.paid_amount));
  const dl = deadlineInfo(order.deadline, holidays);
  const textileMatrix = pivotTextileBreakdown(products);
  const textileProductName =
    products.find(
      (p) => p.category === "Textil" && Array.isArray(p.size_breakdown) && p.size_breakdown.length > 0,
    )?.product_name || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/orders")} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Buyurtmalar
        </button>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto"
              value={order.status}
              disabled={statusSaving}
              onChange={(e) => changeStatus(e.target.value as OrderStatus)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary"
              onClick={duplicate}
              disabled={duplicating}
            >
              <ClipboardCopy className="h-4 w-4" /> Nusxa olish
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate(`/orders/${order.id}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Tahrirlash
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-2xl font-extrabold text-brand-700">
                {order.order_number || "-"}
              </span>
              <h1 className="font-display text-2xl font-bold text-ink-900">
                {order.title}
              </h1>
              <StatusBadge status={order.status} />
              <ProductionCompanyBadges companies={products.map((p) => p.production_company)} />
              {order.is_draft && (
                <span className="chip bg-ink-100 text-ink-700">Qoralama</span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500">
              Sana: {formatDate(order.order_date || order.created_at)}
              {order.manager_name ? ` · Menejer: ${order.manager_name}` : ""}
              {order.customer_source ? ` · Manba: ${order.customer_source}` : ""}
            </p>
          </div>
        </div>
        {order.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-ink-700">
            {order.description}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricBox label="Umumiy" value={formatMoney(order.total_amount)} />
          <MetricBox
            label="To'langan"
            value={formatMoney(order.paid_amount)}
            tone="emerald"
          />
          <MetricBox
            label="Qarz"
            value={formatMoney(debt)}
            tone={debt > 0 ? "rose" : "emerald"}
          />
          <MetricBox label="Muddat" value={formatDate(order.deadline)} />
          <MetricBox
            label="Kunlar"
            value={dl?.label || "-"}
            tone={
              dl?.tone === "rose"
                ? "rose"
                : dl?.tone === "amber"
                ? "amber"
                : "emerald"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="font-display text-base font-bold text-ink-900">
            Mijoz va brend
          </h2>
          <div className="mt-4 space-y-3">
            {customer ? (
              <div className="rounded-xl border border-ink-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-brand-700">
                    {customer.customer_number || ""}
                  </span>
                  <Link
                    to={`/customers/${customer.id}`}
                    className="font-semibold text-ink-900 hover:text-brand-700"
                  >
                    {customer.first_name} {customer.last_name}
                  </Link>
                  <CustomerTypeBadge type={customer.customer_type} />
                </div>
                <div className="mt-2 space-y-1 text-xs text-ink-600">
                  {customer.company && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> {customer.company}
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                      <button
                        onClick={() => copy(customer.phone)}
                        className="rounded p-0.5 hover:bg-ink-100"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/${customer.phone.replace(
                          /[^\d]/g,
                          "",
                        )}`}
                        className="rounded p-0.5 hover:bg-ink-100"
                      >
                        <Send className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {customer.telegram && (
                    <div className="flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" />
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://t.me/${customer.telegram.replace(
                          /^@/,
                          "",
                        )}`}
                        className="text-brand-700 hover:underline"
                      >
                        {customer.telegram}
                      </a>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {customer.address}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-500">Mijoz biriktirilmagan</div>
            )}
            {brand && (
              <div className="rounded-xl bg-brand-50/60 p-3">
                <div className="text-xs font-semibold uppercase text-brand-700">
                  Brend
                </div>
                <div className="mt-0.5 font-semibold text-ink-900">
                  {brand.name}
                </div>
              </div>
            )}
            {order.telegram_link && (
              <a
                href={order.telegram_link}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary w-full justify-center"
              >
                <Send className="h-4 w-4" /> Telegram havola
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-base font-bold text-ink-900">
            Mahsulotlar ({products.length})
          </h2>
          {products.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
              Mahsulotlar qo'shilmagan
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60 text-xs font-semibold uppercase text-ink-500">
                  <tr>
                    <th className="table-th">#</th>
                    <th className="table-th">Mahsulot</th>
                    <th className="table-th text-right">Miqdor</th>
                    <th className="table-th text-right">Narx</th>
                    <th className="table-th text-right">Chegirma</th>
                    <th className="table-th text-right">Jami</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {products.map((p, i) => (
                    <tr key={p.id}>
                      <td className="table-td text-ink-500">{i + 1}</td>
                      <td className="table-td">
                        <div className="font-medium text-ink-900">
                          {p.product_name}
                        </div>
                        <div className="text-xs text-ink-500">
                          {[p.category, p.variant, p.color, p.size, p.material]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="table-td text-right">{p.quantity}</td>
                      <td className="table-td text-right">
                        {formatMoney(p.unit_price)}
                      </td>
                      <td className="table-td text-right">
                        {formatMoney(p.discount)}
                      </td>
                      <td className="table-td text-right font-semibold">
                        {formatMoney(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {textileMatrix.rows.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 text-brand-700" />
              <h2 className="font-display text-base font-bold text-ink-900">
                Razmer/rang taqsimoti
              </h2>
            </div>
            <button className="btn-secondary" onClick={() => setExportOpen(true)}>
              <FileOutput className="h-4 w-4" /> Chop etish / Ulashish
            </button>
          </div>
          <TextileMatrixTable matrix={textileMatrix} />
          <div className="mt-3">
            {order.textile_sizes_confirmed_at ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Klent bilan ushbu razmerlar tasdiqlandi · Sana:{" "}
                {formatDateTime(order.textile_sizes_confirmed_at)}
                {order.textile_sizes_confirmed_by ? ` · ${order.textile_sizes_confirmed_by}` : ""}
              </div>
            ) : (
              canEdit && (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>Razmerlar hali klent bilan tasdiqlanmagan</span>
                  <button
                    className="btn-primary"
                    onClick={confirmTextileSizes}
                    disabled={confirming}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Tasdiqlash
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">
            To'lovlar
          </h2>
          {payments.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
              To'lovlar qayd etilmagan
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-ink-100 p-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-ink-900">
                      {formatMoney(p.amount)}
                    </div>
                    <div className="text-xs text-ink-500">
                      {formatDate(p.payment_date)} · {p.payment_type}
                      {p.received_by ? ` · ${p.received_by}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-900">
              Fayllar
            </h2>
            <span className="chip bg-ink-100 text-ink-700">
              <Paperclip className="h-3 w-3" /> {files.length}
            </span>
          </div>
          {files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
              Fayllar biriktirilmagan
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {f.link_type && (
                        <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-600">
                          {f.link_type}
                        </span>
                      )}
                      <span className="truncate font-medium text-ink-800">
                        {f.filename}
                      </span>
                    </div>
                    {f.note && (
                      <div className="text-xs text-ink-500">{f.note}</div>
                    )}
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(order.delivery_type || order.delivery_address) && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Yetkazish
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Field label="Turi" value={order.delivery_type || "-"} />
            <Field
              label="Sana"
              value={
                order.delivery_date
                  ? `${formatDate(order.delivery_date)} ${order.delivery_time || ""}`
                  : "-"
              }
            />
            <Field label="Kuryer" value={order.courier || "-"} />
            <Field label="Narx" value={formatMoney(order.delivery_cost || 0)} />
            {order.delivery_address && (
              <div className="col-span-2 md:col-span-4">
                <Field label="Manzil" value={order.delivery_address} />
              </div>
            )}
          </div>
        </div>
      )}

      {(order.textile_company_id || order.textile_company_name) && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Textil ishlab chiqaruvchi
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Field
              label="Kompaniya"
              value={textile?.name || order.textile_company_name || "-"}
            />
            <Field label="ID" value={textile?.company_number || "-"} />
            <Field label="Mas'ul" value={textile?.contact_person || "-"} />
            <Field label="Telefon" value={textile?.phone || "-"} />
          </div>
          {textile && !textile.is_active && (
            <div className="mt-2 text-xs text-amber-700">
              Bu kompaniya hozir "Nofaol" holatida
            </div>
          )}
          {!textile && order.textile_company_name && (
            <div className="mt-2 text-xs text-ink-500">
              Bu kompaniya bazadan olib tashlangan — buyurtmadagi nom tarixiy
              yozuv sifatida saqlanadi
            </div>
          )}
        </div>
      )}

      {(order.production_manager ||
        order.logistics_manager ||
        order.qc_manager ||
        order.designer_name) && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Mas'ul shaxslar
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Field label="Dizayner" value={order.designer_name || "-"} />
            <Field
              label="Dizayn holati"
              value={order.designer_status || "-"}
            />
            <Field
              label="Ishlab chiqarish"
              value={order.production_manager || "-"}
            />
            <Field label="Logistika" value={order.logistics_manager || "-"} />
            <Field label="Sifat nazorati" value={order.qc_manager || "-"} />
          </div>
        </div>
      )}

      {(order.client_request_note ||
        order.customer_note ||
        order.production_note ||
        order.logistics_note ||
        order.private_note) && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Izohlar
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            <NoteRow
              label="Mijozning talabi"
              value={order.client_request_note}
            />
            <NoteRow label="Mijoz uchun" value={order.customer_note} />
            <NoteRow
              label="Ishlab chiqarish"
              value={order.production_note}
            />
            <NoteRow label="Logistika" value={order.logistics_note} />
            <NoteRow
              label="Ichki (maxfiy)"
              value={order.private_note}
              tone="amber"
            />
          </div>
        </div>
      )}

      {statusHistory.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-brand-700" />
            <h2 className="font-display text-base font-bold text-ink-900">
              Status tarixi
            </h2>
          </div>
          <ul className="mt-3 space-y-2">
            {statusHistory.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={h.status} />
                  <span className="text-ink-600">{h.changed_by_name || h.changed_by_email}</span>
                </div>
                <span className="text-xs text-ink-400">{formatDateTime(h.changed_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-ink-400">
        Yaratildi: {formatDateTime(order.created_at)}
        {order.completed_at
          ? ` · Yakunlandi: ${formatDateTime(order.completed_at)}`
          : ""}
      </div>

      <RequireCustomerModal
        open={requireCustomerOpen}
        onClose={() => {
          setRequireCustomerOpen(false);
          setPendingStatus(null);
        }}
        customers={allCustomers}
        onSelected={onCustomerSelected}
      />

      <TextileMatrixExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        company={company}
        orderNumber={order.order_number || ""}
        clientName={customer ? `${customer.first_name} ${customer.last_name}`.trim() : ""}
        productName={textileProductName}
        orderDate={order.order_date || order.created_at}
        matrix={textileMatrix}
      />
    </div>
  );
}

function MetricBox({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "rose" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
      ? "text-amber-700"
      : "text-ink-900";
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <div className="text-[11px] font-semibold uppercase text-ink-500">
        {label}
      </div>
      <div className={`mt-1 text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-ink-500">{label}</div>
      <div className="mt-1 text-sm text-ink-800">{value}</div>
    </div>
  );
}

function NoteRow({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "amber";
}) {
  if (!value) return null;
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-ink-100 bg-ink-50";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-[11px] font-semibold uppercase text-ink-500">
        {label}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink-800">
        {value}
      </div>
    </div>
  );
}
