import { forwardRef } from "react";
import { ImageOff, Mail, MapPin, Phone, Send } from "lucide-react";
import type { CompanySettings, Product } from "../../lib/types";
import type { QuantityQuote } from "../../lib/priceCalculations";
import { sortTiers } from "../../lib/priceTiers";
import { formatDate, formatMoney } from "../../lib/format";

type Props = {
  product: Product;
  company: CompanySettings | null;
  quantity: number;
  quote: QuantityQuote | null;
};

// Customer-facing price sheet. Deliberately reads only price_tiers,
// spec/description fields, and company contact info off `product` — never
// cost, margin, or vendor data, so there is nothing sensitive to leak even
// if this component is exported to PNG/PDF or printed.
const ProductCustomerPrice = forwardRef<HTMLDivElement, Props>(
  ({ product, company, quantity, quote }, ref) => {
    const tiers = sortTiers(product.price_tiers || []);
    const specRows: [string, string][] = [];
    if (product.size_spec) specRows.push(["O'lcham", product.size_spec]);
    if (product.material) specRows.push(["Material", product.material]);
    if (product.print_type) specRows.push(["Bosma turi", product.print_type]);
    if (product.paper_weight) specRows.push(["Qog'oz qalinligi", product.paper_weight]);
    if (product.lamination) specRows.push(["Laminatsiya", product.lamination]);
    if (product.packaging) specRows.push(["Qadoqlash", product.packaging]);

    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return (
      <div
        ref={ref}
        className="force-light mx-auto bg-white text-ink-900"
        style={{ width: 794, minHeight: 1000, padding: 48 }}
      >
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="" className="h-14 w-14 rounded object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-700 font-display text-lg font-bold text-white">
                {(company?.name || "VP").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-display text-2xl font-extrabold text-brand-700">
                {company?.name || "Vodiy Print"}
              </div>
              <div className="text-sm text-ink-500">Narx taklifi</div>
            </div>
          </div>
          <div className="text-right text-sm text-ink-600">{formatDate(new Date().toISOString())}</div>
        </header>
        <div className="mt-4 h-[3px] w-full bg-brand-700" />

        <div className="mt-6 flex items-start gap-5">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink-100 text-ink-400">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-8 w-8" />
            )}
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-ink-900">{product.name}</div>
            {product.description && (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {product.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">
              {product.min_order_qty > 0 && (
                <span>
                  Minimal tiraj: <b>{product.min_order_qty} {product.unit || "dona"}</b>
                </span>
              )}
              {product.lead_time_days > 0 && (
                <span>
                  Tayyor bo'lish muddati: <b>{product.lead_time_days} ish kuni</b>
                </span>
              )}
            </div>
          </div>
        </div>

        {specRows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-ink-50 p-4 text-sm sm:grid-cols-3">
            {specRows.map(([label, value]) => (
              <div key={label}>
                <span className="text-ink-500">{label}: </span>
                <span className="font-semibold text-ink-800">{value}</span>
              </div>
            ))}
          </div>
        )}

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-700 text-white">
              <th className="rounded-l-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">
                Tiraj
              </th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">
                Dona narxi
              </th>
              <th className="rounded-r-lg px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">
                Umumiy summa
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.min_qty} className="bg-brand-50/70">
                <td className="px-3 py-3 align-top font-medium">
                  {t.min_qty}+ {product.unit || "dona"}
                </td>
                <td className="px-3 py-3 align-top text-right font-semibold">{formatMoney(t.price)}</td>
                <td className="px-3 py-3 align-top text-right font-bold">
                  {formatMoney(t.price * t.min_qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {quantity > 0 && quote && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-600 p-5 text-white">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                {quantity} {product.unit || "dona"} uchun
              </div>
              <div className="text-sm opacity-90">1 {product.unit || "dona"}: {formatMoney(quote.unitPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Jami</div>
              <div className="font-display text-2xl font-extrabold">{formatMoney(quote.totalPrice)}</div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-lg border-l-4 border-rose-600 bg-rose-50/50 p-4">
          <div className="text-sm font-bold text-rose-600">ESLATMA!</div>
          <div className="mt-1 text-sm text-ink-700">
            Ushbu narxlar {formatDate(validUntil)}gacha amal qiladi.
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-ink-200 pt-4 text-xs text-ink-600">
          {company?.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-rose-600" /> {company.phone}
            </span>
          )}
          {company?.telegram && (
            <span className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-brand-600" /> {company.telegram}
            </span>
          )}
          {company?.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-ink-500" /> {company.email}
            </span>
          )}
          {company?.address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-rose-600" /> {company.address}
            </span>
          )}
        </div>
      </div>
    );
  },
);

ProductCustomerPrice.displayName = "ProductCustomerPrice";

export default ProductCustomerPrice;
