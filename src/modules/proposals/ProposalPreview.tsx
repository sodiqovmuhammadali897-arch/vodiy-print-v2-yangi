import { forwardRef } from "react";
import { ClipboardList, Mail, MapPin, Phone } from "lucide-react";
import type { Brand, CompanySettings, Customer, Proposal } from "../../lib/types";
import { formatMoney } from "../../lib/format";

// A plain "YYYY-MM-DD" date, matching the reference design exactly —
// formatDate()'s localized "20-avg, 2026" style doesn't match it.
const isoDate = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "-");

// The note, line by line. "1) …" / "1. …" lines are numbered points; when
// the number matches a row of the table, that product's name heads the
// point so the customer sees which item it is about.
type NoteLine = { n: number | null; text: string };
const noteLines = (note: string): NoteLine[] =>
  note
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(\d{1,2})\s*[).]\s*(.*)$/.exec(l);
      return m ? { n: Number(m[1]), text: m[2] } : { n: null, text: l };
    });

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
        className="force-light mx-auto bg-white text-ink-900"
        style={{ width: 794, minHeight: 1123, padding: 48 }}
      >
        <header className="flex items-start justify-between">
          <div>
            <div className="font-display text-4xl font-extrabold text-emerald-600">
              {companyName}
            </div>
            <div className="mt-2 text-sm text-ink-500">
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

        <div className={`mt-6 grid gap-4 ${proposal.show_total !== false ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-sm font-bold text-emerald-700">To'lov rekvizitlari</div>
            {company?.bank_name && (
              <div className="mt-2 text-sm text-ink-600">Bank: {company.bank_name}</div>
            )}
            {company?.bank_account && (
              <div className="text-sm text-ink-600">Hisob/INN: {company.bank_account}</div>
            )}
          </div>
          {proposal.show_total !== false && (
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
          )}
        </div>

        {proposal.note?.trim() && (
          <section className="mt-7">
            {/* Margins, not gap — html2canvas (PNG/PDF export) mishandles gap. */}
            <div className="flex items-center">
              <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-700">Mahsulotlar haqida ma'lumot</span>
              <span className="ml-3 h-px flex-1 bg-emerald-200" />
            </div>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-4 py-1">
              {noteLines(proposal.note).map((l, i) => {
                const item = l.n !== null ? proposal.items[l.n - 1] : undefined;
                return (
                  <div key={i} className={`flex items-start py-3 ${i ? "border-t border-emerald-100" : ""}`}>
                    {l.n !== null ? (
                      <span className="mr-3 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                        {l.n}
                      </span>
                    ) : (
                      <span className="mr-3 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    )}
                    <div className="min-w-0 text-sm leading-relaxed">
                      {item?.name && <div className="font-bold text-ink-900">{item.name}</div>}
                      <div className="text-ink-700">{l.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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

        <div className="mt-4 flex items-end justify-between">
          <div className="pb-1">
            <div className="font-display text-xl font-extrabold text-emerald-600">Buyurtma uchun rahmat!</div>
            <div className="mt-1 text-xs text-ink-500">Hamkorligingizdan mamnunmiz</div>
          </div>
          <div className="flex items-end">
            {company?.stamp_url && (
              <img src={company.stamp_url} alt="" className="mr-3 h-16 w-16 object-contain opacity-80" />
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
