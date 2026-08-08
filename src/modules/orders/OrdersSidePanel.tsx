import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  Phone,
  Send,
  MapPin,
  Building2,
  ClipboardCopy,
  Pencil,
  Trash2,
  FileDown,
  Wallet,
  Paperclip,
  ExternalLink,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";
import type { Brand, Customer, Holiday, Order, OrderFile, OrderPayment, OrderProduct, OrderStatus } from "../../lib/types";
import StatusBadge, { ORDER_STATUS_OPTIONS, orderStatusLabel } from "../../components/ui/StatusBadge";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import ProductionBadge from "../../components/ui/ProductionBadge";
import { ORDER_STAGE_GROUPS, orderStageIndex } from "../../lib/orderConstants";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { deadlineInfo } from "../../lib/workingDays";
import { exportNodeToPdf } from "../../lib/exportPdf";
import { updateOne } from "../../lib/firestoreDb";
import OrderPaymentModal from "./OrderPaymentModal";

type Tab = "asosiy" | "mahsulotlar" | "tolovlar" | "jarayon" | "fayllar" | "izohlar";

const TABS: { key: Tab; label: string }[] = [
  { key: "asosiy", label: "Asosiy" },
  { key: "mahsulotlar", label: "Mahsulotlar" },
  { key: "tolovlar", label: "To'lovlar" },
  { key: "jarayon", label: "Jarayon" },
  { key: "fayllar", label: "Fayllar" },
  { key: "izohlar", label: "Izohlar" },
];

type Props = {
  order: Order;
  customer: Customer | null;
  brand: Brand | null;
  products: OrderProduct[];
  payments: OrderPayment[];
  files: OrderFile[];
  holidays: Holiday[];
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPaymentSaved: () => void;
};

export default function OrdersSidePanel({
  order,
  customer,
  brand,
  products,
  payments,
  files,
  holidays,
  canEdit,
  canDelete,
  busy,
  onClose,
  onStatusChange,
  onDuplicate,
  onDelete,
  onPaymentSaved,
}: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("asosiy");
  const [menuOpen, setMenuOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customerNote, setCustomerNote] = useState(order.customer_note || "");
  const [privateNote, setPrivateNote] = useState(order.private_note || "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setTab("asosiy");
    setMenuOpen(false);
    setCustomerNote(order.customer_note || "");
    setPrivateNote(order.private_note || "");
  }, [order.id]);

  const dl = deadlineInfo(order.deadline, holidays);
  const remaining =
    Number(order.remaining_amount || 0) ||
    Math.max(0, Number(order.total_amount || 0) - Number(order.paid_amount || 0));
  const paidPct =
    order.total_amount > 0 ? Math.round((Number(order.paid_amount || 0) / order.total_amount) * 100) : 0;
  const stageIndex = orderStageIndex(order.status);
  const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);

  const exportPdf = async () => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      await exportNodeToPdf(containerRef.current, `buyurtma-${order.order_number || order.id}`);
    } finally {
      setExporting(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateOne("orders", order.id, {
        customer_note: customerNote,
        private_note: privateNote,
      });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="card flex h-fit max-h-[calc(100vh-8rem)] w-full flex-col lg:sticky lg:top-4 lg:w-[26rem]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-ink-100 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold text-ink-900">{order.order_number || "-"}</span>
            {order.status === "cancelled" ? (
              <span className="chip bg-rose-100 text-rose-700">Bekor qilindi</span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
          <div className="mt-1 text-sm text-ink-700">
            {customer ? (
              <span>
                {customer.first_name} {customer.last_name}
                {customer.company ? ` · ${customer.company}` : ""}
              </span>
            ) : (
              <span className="text-ink-400">Mijoz biriktirilmagan</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {customer?.phone && (
            <a
              href={`tel:${customer.phone}`}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="Qo'ng'iroq"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {customer?.telegram && (
            <a
              href={`https://t.me/${customer.telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="Telegram"
            >
              <Send className="h-4 w-4" />
            </a>
          )}
          <div className="relative">
            <button
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-ink-100 bg-surface py-1 shadow-pop">
                <Link
                  to={`/orders/${order.id}`}
                  className="block px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                  onClick={() => setMenuOpen(false)}
                >
                  To'liq sahifa
                </Link>
                {canDelete && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> O'chirish
                  </button>
                )}
              </div>
            )}
          </div>
          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-4 pt-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-semibold transition ${
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "asosiy" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoTile label="Buyurtma sanasi" value={formatDateTime(order.order_date || order.created_at)} />
              <InfoTile
                label="Topshirish sanasi"
                value={formatDate(order.deadline)}
                hint={
                  dl
                    ? dl.overdue
                      ? `${dl.days} kun kechikdi`
                      : dl.days === 0
                      ? "Bugun"
                      : `${dl.days} ish kuni qoldi`
                    : undefined
                }
                hintTone={dl?.tone}
              />
              <InfoTile label="To'lov turi" value={order.payment_type || "-"} />
              <InfoTile
                label="To'lov holati"
                value={`${paidPct}% to'landi`}
                tone={paidPct >= 100 ? "emerald" : paidPct > 0 ? "amber" : "rose"}
              />
              <InfoTile label="Jami summa" value={formatMoney(order.total_amount)} />
              <InfoTile label="Qarzdorlik" value={formatMoney(remaining)} tone={remaining > 0 ? "rose" : "emerald"} />
              <InfoTile label="Manager" value={order.manager_name || "-"} />
              <InfoTile label="Manzil" value={order.delivery_address || "-"} />
            </div>

            {brand && (
              <div className="flex items-center gap-2 rounded-xl border border-ink-100 p-2.5 text-sm text-ink-700">
                <Building2 className="h-4 w-4 text-ink-400" /> {brand.name}
              </div>
            )}
            {customer?.address && (
              <div className="flex items-center gap-2 text-sm text-ink-600">
                <MapPin className="h-3.5 w-3.5 text-ink-400" /> {customer.address}
              </div>
            )}
            {customer && (
              <div>
                <CustomerTypeBadge type={customer.customer_type} />
              </div>
            )}
            {order.production_company && (
              <ProductionBadge name={order.production_company} />
            )}
          </div>
        )}

        {tab === "mahsulotlar" && (
          <div className="space-y-1.5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Jami {totalQty} dona · {products.length} pozitsiya
            </div>
            {products.length === 0 && <p className="text-sm text-ink-400">Mahsulotlar yo'q</p>}
            {products.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink-100 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-800">{p.product_name || "-"}</span>
                  <span className="font-semibold text-ink-700">{formatMoney(p.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-500">
                  <span>× {p.quantity}</span>
                  {p.size && <span className="chip bg-ink-100 text-ink-600">{p.size}</span>}
                  {p.color && <span className="chip bg-ink-100 text-ink-600">{p.color}</span>}
                  {p.variant && <span className="chip bg-ink-100 text-ink-600">{p.variant}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "tolovlar" && (
          <div className="space-y-1.5">
            {payments.length === 0 && <p className="text-sm text-ink-400">To'lovlar yo'q</p>}
            {payments.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink-100 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-700">{formatMoney(p.amount)}</span>
                  <span className="text-ink-500">{formatDate(p.payment_date)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-ink-500">
                  <span>{p.payment_type || "-"}</span>
                  <span>{p.received_by || "-"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "jarayon" && (
          <div className="space-y-5">
            {order.status === "cancelled" ? (
              <div className="chip bg-rose-100 text-rose-700">Bekor qilindi</div>
            ) : (
              <div className="flex items-center">
                {ORDER_STAGE_GROUPS.map((g, i) => (
                  <div key={g.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          i < stageIndex
                            ? "bg-emerald-500 text-white"
                            : i === stageIndex
                            ? "bg-brand-600 text-white"
                            : "bg-ink-100 text-ink-400"
                        }`}
                      >
                        {i < stageIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <span
                        className={`w-16 text-center text-[10px] font-semibold ${
                          i <= stageIndex ? "text-ink-800" : "text-ink-400"
                        }`}
                      >
                        {g.label}
                      </span>
                    </div>
                    {i < ORDER_STAGE_GROUPS.length - 1 && (
                      <div className={`mx-1 h-0.5 flex-1 ${i < stageIndex ? "bg-emerald-500" : "bg-ink-100"}`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div>
                <label className="label">Aniq status</label>
                <select
                  className="input"
                  value={order.status}
                  disabled={busy}
                  onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
                >
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {tab === "fayllar" && (
          <div className="space-y-1.5">
            {files.length === 0 && <p className="text-sm text-ink-400">Fayllar yo'q</p>}
            {files.map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-ink-100 p-2.5 text-xs hover:border-brand-300"
              >
                <span className="flex items-center gap-1.5 text-ink-800">
                  <Paperclip className="h-3.5 w-3.5 text-ink-400" /> {f.filename || "Fayl"}
                </span>
                <ExternalLink className="h-3 w-3 text-ink-400" />
              </a>
            ))}
          </div>
        )}

        {tab === "izohlar" && (
          <div className="space-y-4">
            <div>
              <label className="label">Mijozga izoh</label>
              <textarea
                className="input min-h-[70px]"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">Ichki izoh</label>
              <textarea
                className="input min-h-[70px]"
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            {canEdit && (
              <button className="btn-primary" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? "Saqlanmoqda..." : "Izohlarni saqlash"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-4">
        {canEdit && (
          <button className="btn-secondary justify-center" onClick={() => navigate(`/orders/${order.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Tahrirlash
          </button>
        )}
        {canEdit && (
          <button className="btn-secondary justify-center" onClick={onDuplicate}>
            <ClipboardCopy className="h-4 w-4" /> Nusxa olish
          </button>
        )}
        <button className="btn-secondary justify-center" onClick={exportPdf} disabled={exporting}>
          <FileDown className="h-4 w-4" /> {exporting ? "..." : "PDF"}
        </button>
        {canEdit && (
          <button className="btn-primary justify-center" onClick={() => setPaymentModalOpen(true)}>
            <Wallet className="h-4 w-4" /> To'lov qabul qilish
          </button>
        )}
      </div>

      <OrderPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        order={order}
        onSaved={() => {
          setPaymentModalOpen(false);
          onPaymentSaved();
        }}
      />
    </div>
  );
}

function InfoTile({
  label,
  value,
  hint,
  hintTone,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "rose" | "amber" | "emerald" | "ink";
  tone?: "rose" | "amber" | "emerald";
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div
        className={`mt-0.5 truncate text-sm font-bold ${
          tone === "rose"
            ? "text-rose-600"
            : tone === "amber"
            ? "text-amber-700"
            : tone === "emerald"
            ? "text-emerald-600"
            : "text-ink-900"
        }`}
        title={value}
      >
        {value}
      </div>
      {hint && (
        <div
          className={`mt-0.5 text-[11px] ${
            hintTone === "rose"
              ? "text-rose-600"
              : hintTone === "amber"
              ? "text-amber-700"
              : hintTone === "emerald"
              ? "text-emerald-700"
              : "text-ink-500"
          }`}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
