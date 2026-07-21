import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Building2,
  Phone,
  MapPin,
  FileUp,
  Trash2,
  Paperclip,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Brand, Customer, Order, OrderFile } from "../../lib/types";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import OrderFormModal from "./OrderFormModal";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fileForm, setFileForm] = useState({ filename: "", url: "" });

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const o = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    const ord = (o.data as Order) || null;
    setOrder(ord);
    if (ord) {
      const [b, c, f] = await Promise.all([
        ord.brand_id
          ? supabase.from("brands").select("*").eq("id", ord.brand_id).maybeSingle()
          : Promise.resolve({ data: null }),
        ord.customer_id
          ? supabase.from("customers").select("*").eq("id", ord.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("order_files")
          .select("*")
          .eq("order_id", ord.id)
          .order("created_at", { ascending: false }),
      ]);
      setBrand((b.data as Brand) || null);
      setCustomer((c.data as Customer) || null);
      setFiles((f.data as OrderFile[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  const addFile = async () => {
    if (!order || !fileForm.filename.trim() || !fileForm.url.trim()) return;
    await supabase.from("order_files").insert({
      order_id: order.id,
      filename: fileForm.filename,
      url: fileForm.url,
      mime_type: guessMime(fileForm.filename),
      size: 0,
    });
    setFileForm({ filename: "", url: "" });
    void load();
  };

  const removeFile = async (fid: string) => {
    await supabase.from("order_files").delete().eq("id", fid);
    void load();
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

  const debt = Number(order.total_amount) - Number(order.paid_amount);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/orders")} className="btn-ghost -ml-2">
        <ArrowLeft className="h-4 w-4" /> Buyurtmalar
      </button>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-ink-900">
                {order.title}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-ink-500">
              Yaratildi: {formatDateTime(order.created_at)}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Tahrirlash
          </button>
        </div>
        {order.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-ink-700">
            {order.description}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricBox label="Umumiy" value={formatMoney(order.total_amount)} />
          <MetricBox label="To'langan" value={formatMoney(order.paid_amount)} tone="emerald" />
          <MetricBox
            label="Qarz"
            value={formatMoney(Math.max(0, debt))}
            tone={debt > 0 ? "rose" : "emerald"}
          />
          <MetricBox label="Muddat" value={formatDate(order.deadline)} />
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
                <Link
                  to={`/customers/${customer.id}`}
                  className="font-semibold text-ink-900 hover:text-brand-700"
                >
                  {customer.first_name} {customer.last_name}
                </Link>
                <div className="mt-1.5 space-y-1 text-xs text-ink-600">
                  {customer.company && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> {customer.company}
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {customer.phone}
                    </div>
                  )}
                  {customer.telegram && (
                    <div className="flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" />{" "}
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://t.me/${customer.telegram.replace(/^@/, "")}`}
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-900">
              Buyurtma fayllari
            </h2>
            <span className="chip bg-ink-100 text-ink-700">
              <Paperclip className="h-3 w-3" /> {files.length}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input"
              placeholder="Fayl nomi (ex: logo.pdf)"
              value={fileForm.filename}
              onChange={(e) =>
                setFileForm((f) => ({ ...f, filename: e.target.value }))
              }
            />
            <input
              className="input"
              placeholder="URL yoki havola"
              value={fileForm.url}
              onChange={(e) => setFileForm((f) => ({ ...f, url: e.target.value }))}
            />
            <button className="btn-primary" onClick={addFile}>
              <FileUp className="h-4 w-4" /> Qo'shish
            </button>
          </div>
          <p className="mb-3 text-xs text-ink-500">
            Qo'llab-quvvatlanadi: PNG, JPG, PDF, AI, CDR, PSD, ZIP, RAR (havola sifatida)
          </p>
          {files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
              Fayllar hali biriktirilmagan
            </div>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-ink-800">{f.filename}</div>
                    <div className="text-xs text-ink-500">{f.mime_type}</div>
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                  >
                    <ExternalLink className="h-4 w-4" /> Ochish
                  </a>
                  <button
                    className="btn-ghost text-rose-600 hover:bg-rose-50"
                    onClick={() => removeFile(f.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <OrderFormModal
        open={editing}
        onClose={() => setEditing(false)}
        order={order}
        onSaved={() => {
          setEditing(false);
          void load();
        }}
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

const guessMime = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    pdf: "application/pdf",
    ai: "application/postscript",
    cdr: "application/x-cdr",
    psd: "image/vnd.adobe.photoshop",
    zip: "application/zip",
    rar: "application/vnd.rar",
  };
  return map[ext] || "application/octet-stream";
};
