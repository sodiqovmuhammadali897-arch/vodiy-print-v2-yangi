import { forwardRef } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { Brand, CompanySettings, Customer, Proposal } from "../../lib/types";
import { formatMoney } from "../../lib/format";

// A plain "YYYY-MM-DD" date, matching the reference design exactly —
// formatDate()'s localized "20-avg, 2026" style doesn't match it.
const isoDate = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "-");

type Props = {
  proposal: Proposal;
  company: CompanySettings | null;
  customer: Customer | null;
  brand: Brand | null;
};

const ProposalPreview = forwardRef<HTMLDivElement, Props>(
  ({ proposal, company, customer, brand }, ref) => {
    const companyName = company?.name || "Kompaniya";
    // The recipient is free text (may not match a saved Customer record at
    // all), so it always wins over the linked customer's name.
    const customerName =
      proposal.recipient_name?.trim() ||
      (customer ? `${customer.first_name} ${customer.last_name}`.trim() : "");

    return (
      <div
        ref={ref}
        className="mx-auto bg-white text-ink-900"
        style={{ width: 794, minHeight: 1123, padding: 48 }}
      >
        <header className="flex items-start justify-between">
          <div>
            <div className="font-display text-4xl font-extrabold text-emerald-600">
              {companyName}
            </div>
            <div className="mt-1 text-sm text-ink-500">
              Tijorat taklifi · {isoDate(proposal.created_at)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-ink-900">Sana</div>
            <div className="text-sm text-ink-700">{isoDate(proposal.created_at)}</div>
          </div>
        </header>
        <div className="mt-4 h-[3px] w-full bg-emerald-600" />

        <div className="mt-6 text-xl font-bold leading-snug text-ink-900">
          <span className="text-emerald-600">{companyName}</span>
          {customerName ? (
            <>
              {" "}dan <span>{customerName}</span>
              {brand && <span> ({brand.name})</span>} uchun tijorat taklifi
            </>
          ) : (
            <> tijorat taklifi</>
          )}
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-700 text-white">
              <th className="rounded-l-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">
                NO
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">
                Mahsulot
              </th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">
                Soni
              </th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">
                Dona narxi
              </th>
              <th className="rounded-r-lg px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">
                Umumiy
              </th>
            </tr>
          </thead>
          <tbody>
            {proposal.items.map((it, i) => (
              <tr key={i} className="bg-emerald-50/70">
                <td className="px-3 py-4 align-top text-ink-500">{i + 1}</td>
                <td className="px-3 py-4 align-top font-medium">{it.name || "-"}</td>
                <td className="px-3 py-4 align-top text-right">
                  {Number(it.quantity).toLocaleString("uz-UZ")}
                </td>
                <td className="px-3 py-4 align-top text-right font-semibold">
                  {formatMoney(it.price)}
                </td>
                <td className="px-3 py-4 align-top text-right font-bold">
                  {formatMoney(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-sm font-bold text-emerald-700">To'lov rekvizitlari</div>
            {company?.bank_name && (
              <div className="mt-2 text-sm text-ink-600">Bank: {company.bank_name}</div>
            )}
            {company?.bank_account && (
              <div className="text-sm text-ink-600">Hisob/INN: {company.bank_account}</div>
            )}
          </div>
          <div className="rounded-xl bg-emerald-600 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Umumiy
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold">
              {formatMoney(proposal.total)}
            </div>
            {proposal.discount > 0 && (
              <div className="mt-1 text-xs opacity-90">
                Chegirma: {formatMoney(proposal.discount)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-base font-bold text-ink-900">Buyurtma uchun rahmat!</div>

        {proposal.note && (
          <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
            <div className="whitespace-pre-line">{proposal.note}</div>
          </div>
        )}

        {proposal.valid_until && (
          <div className="mt-4 rounded-lg border-l-4 border-rose-600 bg-rose-50/50 p-4">
            <div className="text-sm font-bold text-rose-600">ESLATMA!</div>
            <div className="mt-1 text-sm text-ink-700">
              Ushbu belgilangan narxlar {isoDate(proposal.valid_until)}gacha amal qiladi!
            </div>
          </div>
        )}

        <div className="mt-8 h-[2px] w-full bg-emerald-600" />

        <div className="mt-4 flex items-end justify-end gap-3">
          {company?.stamp_url && (
            <img src={company.stamp_url} alt="" className="h-16 w-16 object-contain opacity-80" />
          )}
          <div className="text-right">
            {company?.signature_url && (
              <img src={company.signature_url} alt="" className="ml-auto h-12 object-contain" />
            )}
            <div className="font-bold text-ink-900">
              {company?.director_name || "—"} — Rahbar
            </div>
            <div className="mt-1 text-xs text-ink-400">Imzo</div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-ink-200 pt-4 text-xs text-ink-600">
          {company?.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-rose-600" /> {company.phone}
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

ProposalPreview.displayName = "ProposalPreview";

export default ProposalPreview;
