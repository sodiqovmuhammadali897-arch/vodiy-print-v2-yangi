import type { Brand, Customer } from "../../../lib/types";
import type {
  OrderPayload,
  WizardFileLink,
  WizardPayment,
  WizardProduct,
} from "../../../lib/orderService";
import type { OrderTotals } from "../../../lib/orderCalculations";
import { formatMoney } from "../../../lib/format";
import ProductionBadge from "../../../components/ui/ProductionBadge";
import CustomerTypeBadge from "../../../components/ui/CustomerTypeBadge";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { OrderStatus } from "../../../lib/types";

type Props = {
  orderNumber: string;
  payload: OrderPayload;
  customer: Customer | null;
  brand: Brand | null;
  products: WizardProduct[];
  payments: WizardPayment[];
  files: WizardFileLink[];
  totals: OrderTotals;
};

export default function ReviewStep({
  orderNumber,
  payload,
  customer,
  brand,
  products,
  payments,
  files,
  totals,
}: Props) {
  const activeProducts = products.filter(
    (p) => p.product_name.trim() || p.quantity > 0,
  );
  const activePayments = payments.filter((p) => Number(p.amount) > 0);
  const activeFiles = files.filter((f) => f.url.trim());

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-ink-500">
              Buyurtma
            </div>
            <div className="font-display text-2xl font-extrabold text-brand-700">
              {orderNumber || "…"}
            </div>
            <div className="mt-1 text-sm text-ink-700">
              {payload.title || "-"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={payload.status as OrderStatus} />
            <ProductionBadge name={payload.production_company} />
            {payload.is_draft && (
              <span className="chip bg-ink-100 text-ink-700">Qoralama</span>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Field label="Sana" value={payload.order_date || "-"} />
          <Field label="Deadline" value={payload.deadline || "-"} />
          <Field label="Menejer" value={payload.manager_name || "-"} />
          <Field label="Manba" value={payload.customer_source || "-"} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-base font-bold text-ink-900">
          Mijoz va brend
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-ink-100 p-4">
            <div className="text-xs font-semibold uppercase text-ink-500">
              Mijoz
            </div>
            {customer ? (
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand-700">
                    {customer.customer_number || "-"}
                  </span>
                  <span className="font-semibold text-ink-900">
                    {customer.first_name} {customer.last_name}
                  </span>
                  <CustomerTypeBadge type={customer.customer_type} />
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  {customer.phone} {customer.telegram ? `· ${customer.telegram}` : ""}
                </div>
                {customer.company && (
                  <div className="text-xs text-ink-500">{customer.company}</div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-sm text-ink-400">Tanlanmagan</div>
            )}
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <div className="text-xs font-semibold uppercase text-ink-500">
              Brend
            </div>
            <div className="mt-1 font-semibold text-ink-900">
              {brand?.name || "-"}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-base font-bold text-ink-900">
          Mahsulotlar ({activeProducts.length})
        </h3>
        {activeProducts.length === 0 ? (
          <div className="mt-3 text-sm text-ink-400">
            Mahsulot qo'shilmagan
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-100">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-xs font-semibold uppercase text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Mahsulot</th>
                  <th className="px-3 py-2 text-right">Miqdor</th>
                  <th className="px-3 py-2 text-right">Narx</th>
                  <th className="px-3 py-2 text-right">Chegirma</th>
                  <th className="px-3 py-2 text-right">Jami</th>
                </tr>
              </thead>
              <tbody>
                {activeProducts.map((p, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    <td className="px-3 py-2 text-ink-500">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink-900">
                        {p.product_name || "-"}
                      </div>
                      <div className="text-xs text-ink-500">
                        {[p.category, p.variant, p.color, p.size, p.material]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{p.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(p.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(p.discount)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatMoney(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-display text-base font-bold text-ink-900">Moliya</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryBox label="Umumiy" value={formatMoney(totals.total)} />
          <SummaryBox label="Chegirma" value={formatMoney(totals.discount)} />
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
        </div>
        {activePayments.length > 0 && (
          <div className="mt-4 space-y-1 text-sm">
            {activePayments.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2"
              >
                <span className="text-ink-600">
                  {p.payment_date} · {p.payment_type}
                  {p.received_by ? ` · ${p.received_by}` : ""}
                </span>
                <span className="font-semibold">{formatMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeFiles.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-base font-bold text-ink-900">
            Fayllar ({activeFiles.length})
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {activeFiles.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2"
              >
                <span className="truncate text-ink-700">
                  <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
                    {f.link_type}
                  </span>
                  {f.filename || f.url}
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  Ochish
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {payload.delivery_type && (
        <div className="card p-5">
          <h3 className="font-display text-base font-bold text-ink-900">
            Yetkazish
          </h3>
          <div className="mt-3">
            <Field label="Turi" value={payload.delivery_type} />
          </div>
        </div>
      )}

      {(payload.client_request_note ||
        payload.customer_note ||
        payload.production_note ||
        payload.logistics_note ||
        payload.private_note) && (
        <div className="card p-5">
          <h3 className="font-display text-base font-bold text-ink-900">
            Izohlar
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <NoteRow label="Mijozning talabi" value={payload.client_request_note} />
            <NoteRow label="Mijoz uchun" value={payload.customer_note} />
            <NoteRow
              label="Ishlab chiqarish"
              value={payload.production_note}
            />
            <NoteRow label="Logistika" value={payload.logistics_note} />
            <NoteRow
              label="Ichki (maxfiy)"
              value={payload.private_note}
              tone="amber"
            />
          </div>
        </div>
      )}
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
