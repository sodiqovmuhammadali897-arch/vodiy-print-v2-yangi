import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  PackageCheck,
  Phone,
  User,
} from "lucide-react";
import type { Brand, Customer, Holiday, Order, OrderFile, OrderProduct, OrderStatus } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import StatusBadge, { orderStatusLabel } from "../../components/ui/StatusBadge";
import { PRODUCTION_LINE_STATUSES } from "../../lib/orderConstants";
import { deadlineInfo } from "../../lib/workingDays";
import { formatDate } from "../../lib/format";

type DispatchProps = {
  mode: "dispatch";
  canAssign: boolean;
  printers: Staff[];
  onAssign: (email: string, name: string) => void;
  // Non-Textil categories have no dedicated worker panel yet, so this is
  // the only way to move them past "Yangi" — the mas'ul hodim sets it
  // directly here instead of through a per-role accept/finish flow.
  onStatusChange: (status: OrderStatus) => void;
};

type PechatnikProps = {
  mode: "pechatnik";
  canAct: boolean;
  // Admins get a free-form status <select> (can move forward or back to
  // correct a mistaken click) instead of the fixed two-button flow.
  isAdmin: boolean;
  busy: boolean;
  onAccept: () => void;
  onReady: () => void;
  onStatusChange: (status: OrderStatus) => void;
};

type Props = (DispatchProps | PechatnikProps) & {
  product: OrderProduct;
  order: Order;
  customer: Customer | null;
  brand: Brand | null;
  holidays: Holiday[];
  files: OrderFile[];
};

export default function ProductionProductCard(props: Props) {
  const { product, order, customer, brand, holidays, files, mode } = props;
  const dl = deadlineInfo(order.deadline, holidays);
  const isTextile = product.category === "Textil";
  // Order lines created before this feature shipped don't have these
  // fields in Firestore at all (undefined, not just empty) — fall back
  // instead of crashing the whole page on old data.
  const sizeBreakdown = Array.isArray(product.size_breakdown) ? product.size_breakdown : [];
  const productionStatus = product.production_status || "new";
  const colorCount = new Set(sizeBreakdown.map((e) => e.color)).size;
  const sizeCount = new Set(sizeBreakdown.map((e) => e.size)).size;

  const canAccept =
    mode === "pechatnik" &&
    props.canAct &&
    (productionStatus === "new" || productionStatus === "accepted");
  const canFinish =
    mode === "pechatnik" && props.canAct && productionStatus === "production";

  // "Tayyor" is hidden by default on both Ishlab chiqarish and Pechatnik,
  // so a mistaken click here makes the card vanish immediately with no way
  // to notice/undo — confirm first, same as other one-way actions in the app.
  const confirmedStatusChange = (status: OrderStatus) => {
    if (status === "ready" && !confirm("Bu mahsulotni \"Tayyor\" deb belgilaysizmi? Tasdiqlagach ro'yxatdan yashiriladi.")) {
      return;
    }
    props.onStatusChange(status);
  };
  const confirmedReady = () => {
    if (mode !== "pechatnik") return;
    if (!confirm("Bu mahsulotni \"Tayyor\" deb belgilaysizmi? Tasdiqlagach ro'yxatdan yashiriladi.")) return;
    props.onReady();
  };

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
          <span className="chip bg-ink-100 text-ink-700">{product.category || "-"}</span>
          <StatusBadge status={productionStatus} />
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
        <div className="text-[11px] font-semibold uppercase text-ink-500">Mahsulot</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-800">
          <span className="font-medium">{product.product_name || "-"}</span>
          <span className="text-ink-500">× {product.quantity}</span>
          {isTextile && sizeBreakdown.length > 0 ? (
            <span className="chip bg-surface text-ink-600">
              {colorCount} rang · {sizeCount} razmer
            </span>
          ) : (
            <>
              {product.size && <span className="chip bg-surface text-ink-600">{product.size}</span>}
              {product.color && <span className="chip bg-surface text-ink-600">{product.color}</span>}
            </>
          )}
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

      {mode === "dispatch" &&
        (props.canAssign ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-ink-500">Pechatnik</span>
            <select
              className="input w-auto py-1.5 text-sm"
              value={product.assigned_printer_email || ""}
              onChange={(e) => {
                const email = e.target.value;
                const found = props.printers.find((p) => p.email === email);
                props.onAssign(email, found?.full_name || "");
              }}
            >
              <option value="">-- biriktirilmagan --</option>
              {props.printers.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs text-ink-500">
            Pechatnik:{" "}
            <span className="font-semibold text-ink-700">
              {product.assigned_printer_name || "biriktirilmagan"}
            </span>
          </div>
        ))}

      {mode === "dispatch" && props.canAssign && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-ink-500">Holat</span>
          <select
            className="input w-auto py-1.5 text-sm"
            value={productionStatus}
            onChange={(e) => confirmedStatusChange(e.target.value as OrderStatus)}
          >
            {PRODUCTION_LINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "pechatnik" && props.canAct && props.isAdmin && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-semibold uppercase text-ink-500">Holat</span>
          <select
            className="input w-auto py-1.5 text-sm"
            value={productionStatus}
            disabled={props.busy}
            onChange={(e) => confirmedStatusChange(e.target.value as OrderStatus)}
          >
            {PRODUCTION_LINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "pechatnik" && !props.isAdmin && (canAccept || canFinish) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canAccept && (
            <button className="btn-primary" onClick={props.onAccept} disabled={props.busy}>
              <CheckCircle2 className="h-4 w-4" /> Qabul qildim
            </button>
          )}
          {canFinish && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              onClick={confirmedReady}
              disabled={props.busy}
            >
              <PackageCheck className="h-4 w-4" /> Tayyor bo'ldi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
