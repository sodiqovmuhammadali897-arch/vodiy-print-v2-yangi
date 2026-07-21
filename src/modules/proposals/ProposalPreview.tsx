import { forwardRef } from "react";
import type { Brand, CompanySettings, Customer, Proposal } from "../../lib/types";
import { formatDate, formatMoney } from "../../lib/format";

type Props = {
  proposal: Proposal;
  company: CompanySettings | null;
  customer: Customer | null;
  brand: Brand | null;
};

const ProposalPreview = forwardRef<HTMLDivElement, Props>(
  ({ proposal, company, customer, brand }, ref) => {
    return (
      <div
        ref={ref}
        className="mx-auto bg-white text-ink-900 shadow-card"
        style={{ width: 794, minHeight: 1123, padding: 48 }}
      >
        <header className="flex items-start justify-between border-b border-ink-200 pb-5">
          <div className="flex items-start gap-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt=""
                className="h-14 w-14 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 font-display text-2xl font-extrabold text-white">
                {(company?.name || "P").charAt(0)}
              </div>
            )}
            <div>
              <div className="font-display text-xl font-bold">
                {company?.name || "Kompaniya"}
              </div>
              <div className="text-xs text-ink-500">
                {company?.address}
              </div>
              <div className="mt-1 space-x-2 text-xs text-ink-600">
                {company?.phone && <span>{company.phone}</span>}
                {company?.email && <span>· {company.email}</span>}
                {company?.website && <span>· {company.website}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Tijorat taklifi
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold text-brand-700">
              {proposal.number}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              Sana: {formatDate(proposal.created_at)}
            </div>
            {proposal.valid_until && (
              <div className="text-xs text-ink-500">
                Amal qiladi: {formatDate(proposal.valid_until)}
              </div>
            )}
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-ink-50 p-4">
            <div className="text-[11px] font-semibold uppercase text-ink-500">
              Kimga
            </div>
            <div className="mt-1 font-bold text-ink-900">
              {customer
                ? `${customer.first_name} ${customer.last_name}`
                : "—"}
            </div>
            {customer?.company && (
              <div className="text-sm text-ink-700">{customer.company}</div>
            )}
            {customer?.phone && (
              <div className="text-xs text-ink-600">{customer.phone}</div>
            )}
            {customer?.address && (
              <div className="text-xs text-ink-500">{customer.address}</div>
            )}
            {brand && (
              <div className="mt-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                Brend: {brand.name}
              </div>
            )}
          </div>
          <div className="rounded-xl bg-brand-50 p-4">
            <div className="text-[11px] font-semibold uppercase text-brand-700">
              {proposal.title || "Tijorat taklifi"}
            </div>
            <div className="mt-1 font-display text-lg font-bold text-brand-900">
              Umumiy summa
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold text-brand-800">
              {formatMoney(proposal.total)}
            </div>
            {proposal.discount > 0 && (
              <div className="text-xs text-ink-600">
                Chegirma: {formatMoney(proposal.discount)}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900 text-white">
                <th className="w-10 border border-ink-900 px-2 py-2 text-left">#</th>
                <th className="border border-ink-900 px-2 py-2 text-left">Mahsulot</th>
                <th className="w-20 border border-ink-900 px-2 py-2 text-center">
                  O'lchov
                </th>
                <th className="w-20 border border-ink-900 px-2 py-2 text-center">
                  Miqdor
                </th>
                <th className="w-28 border border-ink-900 px-2 py-2 text-right">
                  Narxi
                </th>
                <th className="w-32 border border-ink-900 px-2 py-2 text-right">
                  Jami
                </th>
              </tr>
            </thead>
            <tbody>
              {proposal.items.map((it, i) => (
                <tr key={i} className="odd:bg-white even:bg-ink-50">
                  <td className="border border-ink-200 px-2 py-2 text-ink-500">
                    {i + 1}
                  </td>
                  <td className="border border-ink-200 px-2 py-2 font-medium">
                    {it.name || "-"}
                  </td>
                  <td className="border border-ink-200 px-2 py-2 text-center">
                    {it.unit}
                  </td>
                  <td className="border border-ink-200 px-2 py-2 text-center">
                    {Number(it.quantity).toLocaleString("uz-UZ")}
                  </td>
                  <td className="border border-ink-200 px-2 py-2 text-right">
                    {formatMoney(it.price)}
                  </td>
                  <td className="border border-ink-200 px-2 py-2 text-right font-semibold">
                    {formatMoney(it.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-2 py-2 text-right text-sm text-ink-500">
                  Oraliq:
                </td>
                <td className="px-2 py-2 text-right font-semibold">
                  {formatMoney(proposal.subtotal)}
                </td>
              </tr>
              {proposal.discount > 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-1 text-right text-sm text-rose-600">
                    Chegirma:
                  </td>
                  <td className="px-2 py-1 text-right font-semibold text-rose-600">
                    -{formatMoney(proposal.discount)}
                  </td>
                </tr>
              )}
              <tr className="bg-brand-50">
                <td colSpan={5} className="px-2 py-2 text-right font-bold">
                  UMUMIY:
                </td>
                <td className="px-2 py-2 text-right font-display text-lg font-extrabold text-brand-800">
                  {formatMoney(proposal.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {proposal.note && (
          <section className="mt-6 rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
            <div className="mb-1 text-[11px] font-semibold uppercase text-ink-500">
              Izoh
            </div>
            <div className="whitespace-pre-line">{proposal.note}</div>
          </section>
        )}

        {(company?.requisites || company?.bank_account) && (
          <section className="mt-6 rounded-xl border border-ink-200 p-4 text-xs text-ink-700">
            <div className="mb-1 text-[11px] font-semibold uppercase text-ink-500">
              Rekvizitlar
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {company.bank_name && <div>Bank: {company.bank_name}</div>}
              {company.bank_account && <div>H/r: {company.bank_account}</div>}
              {company.mfo && <div>MFO: {company.mfo}</div>}
              {company.stir && <div>STIR: {company.stir}</div>}
            </div>
            {company.requisites && (
              <div className="mt-2 whitespace-pre-line">{company.requisites}</div>
            )}
          </section>
        )}

        <footer className="mt-8 flex items-end justify-between border-t border-ink-200 pt-5">
          <div>
            <div className="text-xs text-ink-500">Rahbar</div>
            <div className="font-semibold">{company?.director_name || "—"}</div>
            {company?.signature_url && (
              <img
                src={company.signature_url}
                alt=""
                className="mt-1 h-16 object-contain"
              />
            )}
          </div>
          {company?.stamp_url && (
            <img
              src={company.stamp_url}
              alt=""
              className="h-24 w-24 object-contain opacity-80"
            />
          )}
        </footer>
      </div>
    );
  },
);

ProposalPreview.displayName = "ProposalPreview";

export default ProposalPreview;
