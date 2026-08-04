import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  PackageCheck,
  Phone,
  StickyNote,
  User,
} from "lucide-react";
import type { Brand, Customer, Holiday, Order, OrderFile, OrderProduct } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import StatusBadge from "../../components/ui/StatusBadge";
import { deadlineInfo } from "../../lib/workingDays";
import { formatDate } from "../../lib/format";

type Props = {
  order: Order;
  customer: Customer | null;
  brand: Brand | null;
  textileProducts: OrderProduct[];
  files: OrderFile[];
  holidays: Holiday[];
  canAct: boolean;
  isAdmin: boolean;
  busy: boolean;
  printers: Staff[];
  onAccept: () => void;
  onReady: () => void;
  onReassign: (email: string, name: string) => void;
};

export default function ProductionOrderCard({
  order,
  customer,
  brand,
  textileProducts,
  files,
  holidays,
  canAct,
  isAdmin,
  busy,
  printers,
  onAccept,
  onReady,
  onReassign,
}: Props) {
  const dl = deadlineInfo(order.deadline, holidays);
  const canAccept = canAct && (order.status === "new" || order.status === "accepted");
  const canFinish = canAct && order.status === "production";
  const note = order.production_note || order.client_request_note || order.description;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/orders/${order.id}`}
            className="font-display text-lg font-extrabold text-brand-700 hover:underline"
          >
            {order.order_number || "-"}
          </Link>
          <div className="text-sm font-medium text-ink-800">{order.title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={order.status} />
          {dl?.overdue && (
            <span className="chip gap-1 bg-rose-100 text-rose-700">
              <AlertTriangle className="h-3 w-3" /> Kechikkan
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-1.5 text-ink-700">
          <User className="h-3.5 w-3.5 text-ink-400" />
          {customer ? `${customer.first_name} ${customer.last_name}` : "Mijoz biriktirilmagan"}
          {customer?.phone && (
            <a
              href={`tel:${customer.phone}`}
              className="ml-1 flex items-center gap-1 text-xs text-ink-500 hover:text-brand-700"
            >
              <Phone className="h-3 w-3" /> {customer.phone}
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-ink-700">
          <Building2 className="h-3.5 w-3.5 text-ink-400" />
          {brand?.name || "Brend yo'q"}
        </div>
      </div>

      <div className="rounded-xl bg-ink-50 p-3">
        <div className="text-[11px] font-semibold uppercase text-ink-500">Mahsulotlar</div>
        <div className="mt-1.5 space-y-1">
          {textileProducts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-1.5 text-sm text-ink-800">
              <span className="font-medium">{p.product_name || "-"}</span>
              <span className="text-ink-500">× {p.quantity}</span>
              {p.size && <span className="chip bg-white text-ink-600">{p.size}</span>}
              {p.color && <span className="chip bg-white text-ink-600">{p.color}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <div>
          Muddat: <span className="font-semibold text-ink-700">{formatDate(order.deadline)}</span>
          {dl && (
            <span
              className={`ml-1 ${
                dl.tone === "rose" ? "text-rose-600" : dl.tone === "amber" ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              ({dl.overdue ? `${dl.days} kun kechikdi` : dl.days === 0 ? "bugun" : `${dl.days} ish kuni qoldi`})
            </span>
          )}
        </div>
        <div>Menejer: <span className="font-semibold text-ink-700">{order.manager_name || "-"}</span></div>
      </div>

      {isAdmin ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-ink-500">Pechatnik</span>
          <select
            className="input w-auto py-1.5 text-sm"
            value={order.assigned_printer_email}
            onChange={(e) => {
              const email = e.target.value;
              const found = printers.find((p) => p.email === email);
              onReassign(email, found?.full_name || "");
            }}
          >
            <option value="">-- biriktirilmagan --</option>
            {printers.map((p) => (
              <option key={p.email} value={p.email}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </div>
      ) : (
        order.assigned_printer_name && (
          <div className="text-xs text-ink-500">
            Pechatnik: <span className="font-semibold text-ink-700">{order.assigned_printer_name}</span>
          </div>
        )
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-ink-400" />
          {files.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg bg-ink-100 px-2 py-1 text-xs text-ink-700 hover:bg-ink-200"
            >
              {f.filename || "Fayl"} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}

      {note && (
        <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-pre-wrap">{note}</span>
        </div>
      )}

      {(canAccept || canFinish) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canAccept && (
            <button className="btn-primary" onClick={onAccept} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> Qabul qildim
            </button>
          )}
          {canFinish && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              onClick={onReady}
              disabled={busy}
            >
              <PackageCheck className="h-4 w-4" /> Tayyor bo'ldi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
