import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  Phone,
  Send,
  MapPin,
  Building2,
  Briefcase,
  ClipboardList,
  Paperclip,
  ExternalLink,
  Pencil,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { insertOne, listWhere } from "../../lib/firestoreDb";
import type { Customer, CustomerNote, Order, OrderFile, OrderPayment } from "../../lib/types";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime, formatMoney, formatMoneyShort, initialsOf } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";

type Tab = "asosiy" | "buyurtmalar" | "tolovlar" | "fayllar" | "izohlar";

const TABS: { key: Tab; label: string }[] = [
  { key: "asosiy", label: "Asosiy" },
  { key: "buyurtmalar", label: "Buyurtmalar" },
  { key: "tolovlar", label: "To'lovlar" },
  { key: "fayllar", label: "Fayllar" },
  { key: "izohlar", label: "Izohlar" },
];

type Props = {
  customer: Customer;
  orders: Order[];
  payments: OrderPayment[];
  files: OrderFile[];
  debt: number;
  onClose: () => void;
  onEdit: () => void;
};

export default function CustomerSidePanel({
  customer,
  orders,
  payments,
  files,
  debt,
  onClose,
  onEdit,
}: Props) {
  const navigate = useNavigate();
  const { user, staff, can } = useAuth();
  const canEdit = can("customers", "edit");
  const [tab, setTab] = useState<Tab>("asosiy");
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setTab("asosiy");
    setNotesLoading(true);
    void listWhere<CustomerNote>("customer_notes", "customer_id", customer.id, {
      orderBy: ["created_at", "asc"],
    }).then((rows) => {
      setNotes(rows);
      setNotesLoading(false);
    });
  }, [customer.id]);

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const lifetimeValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalDue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalPaid = orders.reduce((s, o) => s + Number(o.paid_amount || 0), 0);
  const paymentDiscipline = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null;
  const recentOrders = orders.slice(0, 4);

  const addNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setPosting(true);
    try {
      const saved = await insertOne<Omit<CustomerNote, "id" | "created_at">>("customer_notes", {
        customer_id: customer.id,
        author_email: user?.email || "",
        author_name: staff?.full_name || user?.email || "Noma'lum",
        text,
      });
      setNotes((prev) => [...prev, saved as CustomerNote]);
      setNewNote("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card flex h-fit max-h-[calc(100vh-8rem)] w-full flex-col lg:sticky lg:top-4 lg:w-96">
      <div className="flex items-start justify-between gap-2 border-b border-ink-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            {initialsOf(`${customer.first_name} ${customer.last_name}`)}
          </div>
          <div>
            <div className="font-display text-base font-bold text-ink-900">
              {customer.first_name} {customer.last_name}
            </div>
            <div className="text-xs text-ink-500">{customer.company || customer.customer_number}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to={`/customers/${customer.id}`}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            title="To'liq sahifa"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          {canEdit && (
            <button
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="Tahrirlash"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <CustomerTypeBadge type={customer.customer_type} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-4 pt-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-semibold transition ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "asosiy" && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              {customer.phone && (
                <InfoLine icon={<Phone className="h-3.5 w-3.5" />} label="Telefon">
                  <a href={`tel:${customer.phone}`} className="hover:text-brand-700">
                    {customer.phone}
                  </a>
                </InfoLine>
              )}
              {customer.telegram && (
                <InfoLine icon={<Send className="h-3.5 w-3.5" />} label="Telegram">
                  <a
                    href={`https://t.me/${customer.telegram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    {customer.telegram}
                  </a>
                </InfoLine>
              )}
              {customer.address && (
                <InfoLine icon={<MapPin className="h-3.5 w-3.5" />} label="Manzil">
                  {customer.address}
                </InfoLine>
              )}
              {customer.industry && (
                <InfoLine icon={<Briefcase className="h-3.5 w-3.5" />} label="Toifa">
                  {customer.industry}
                </InfoLine>
              )}
              {customer.company && (
                <InfoLine icon={<Building2 className="h-3.5 w-3.5" />} label="Kompaniya">
                  {customer.company}
                </InfoLine>
              )}
              <InfoLine icon={<ClipboardList className="h-3.5 w-3.5" />} label="Manager">
                {customer.manager_name || "-"}
              </InfoLine>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Jami buyurtmalar" value={String(orders.length)} />
              <MiniStat label="Jami summa" value={formatMoneyShort(lifetimeValue)} />
              <MiniStat
                label="Qarzdorlik"
                value={formatMoneyShort(debt)}
                tone={debt > 0 ? "rose" : "emerald"}
              />
              <MiniStat
                label="To'lov intizomi"
                value={paymentDiscipline === null ? "-" : `${paymentDiscipline}%`}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Oxirgi buyurtmalar
                </h3>
                {orders.length > 4 && (
                  <button
                    className="text-xs font-semibold text-brand-700 hover:underline"
                    onClick={() => setTab("buyurtmalar")}
                  >
                    Barchasi
                  </button>
                )}
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-ink-400">Buyurtmalar yo'q</p>
              ) : (
                <div className="space-y-1.5">
                  {recentOrders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/orders/${o.id}`}
                      className="flex items-center justify-between rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs hover:border-brand-300"
                    >
                      <span className="font-semibold text-ink-800">{o.order_number || o.title}</span>
                      <StatusBadge status={o.status} />
                      <span className="text-ink-500">{formatDate(o.order_date || o.created_at)}</span>
                      <span className="font-semibold text-ink-700">{formatMoneyShort(o.total_amount)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "buyurtmalar" && (
          <div className="space-y-1.5">
            {orders.length === 0 && <p className="text-sm text-ink-400">Buyurtmalar yo'q</p>}
            {orders.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="flex flex-col gap-1 rounded-lg border border-ink-100 p-2.5 text-xs hover:border-brand-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-800">{o.order_number || o.title}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-center justify-between text-ink-500">
                  <span>{formatDate(o.order_date || o.created_at)}</span>
                  <span className="font-semibold text-ink-700">{formatMoney(o.total_amount)}</span>
                </div>
              </Link>
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
                  <span>{ordersById.get(p.order_id)?.order_number || "-"}</span>
                  <span>{p.payment_type || "-"}</span>
                </div>
              </div>
            ))}
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
                <span className="flex items-center gap-1 text-ink-500">
                  {ordersById.get(f.order_id)?.order_number}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            ))}
          </div>
        )}

        {tab === "izohlar" && (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-2.5">
              {notesLoading ? (
                <p className="text-sm text-ink-400">Yuklanmoqda...</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-ink-400">Hali izoh yo'q</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-xl bg-ink-50 p-2.5 text-sm">
                    <div className="flex items-center justify-between text-[11px] text-ink-500">
                      <span className="font-semibold text-ink-700">{n.author_name}</span>
                      <span>{formatDateTime(n.created_at)}</span>
                    </div>
                    <p className="mt-1 text-ink-800">{n.text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <textarea
                className="input min-h-[44px] flex-1 py-2 text-sm"
                placeholder="Izoh yozing..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void addNote();
                  }
                }}
              />
              <button className="btn-primary shrink-0" onClick={addNote} disabled={posting || !newNote.trim()}>
                Yuborish
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="border-t border-ink-100 p-4">
          <button
            className="btn-primary w-full justify-center"
            onClick={() => navigate(`/orders/new?customer=${customer.id}`)}
          >
            <Plus className="h-4 w-4" /> Buyurtma yaratish
          </button>
        </div>
      )}
    </div>
  );
}

function InfoLine({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-ink-700">
      <span className="text-ink-400">{icon}</span>
      <span className="w-20 shrink-0 text-xs text-ink-500">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose" | "emerald";
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div
        className={`mt-0.5 font-display text-base font-bold ${
          tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-ink-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
