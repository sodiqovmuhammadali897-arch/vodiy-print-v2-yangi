import { forwardRef } from "react";
import { Clock, PencilLine, Stamp } from "lucide-react";
import type { CompanySettings, Proposal } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { ProposalFooter, isoDate } from "./ProposalPreview";

// The souvenir offer the manager sends the customer as a PNG — the same look
// as the gift box offer and the commercial proposal. Margins, not gap, where
// html2canvas would mishandle it.
type Props = { proposal: Proposal; company: CompanySettings | null };

const SouvenirOfferPreview = forwardRef<HTMLDivElement, Props>(({ proposal, company }, ref) => {
  const sv = proposal.souvenir;
  const rows = (sv?.rows || []).filter((r) => r.name && r.qty > 0);
  const companyName = company?.name || "Kompaniya";
  const customerName = proposal.recipient_name?.trim();
  const notes = (proposal.note || "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div ref={ref} className="force-light mx-auto bg-white text-ink-900" style={{ width: 794, minHeight: 1123, padding: 48 }}>
      <header className="flex items-start justify-between">
        <div>
          <div className="font-display text-4xl font-extrabold text-emerald-600">{companyName}</div>
          <div className="mt-2 text-sm text-ink-500">Suvenir taklifi · {isoDate(proposal.created_at)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-ink-900">Sana</div>
          <div className="text-sm text-ink-700">{isoDate(proposal.created_at)}</div>
        </div>
      </header>
      <div className="mt-4 h-[3px] w-full bg-emerald-600" />

      <div className="mt-6 text-xl font-bold leading-snug text-ink-900">
        <span className="text-emerald-600">{companyName}</span>
        {customerName ? <>dan {customerName} uchun suvenir taklifi</> : <> suvenir taklifi</>}
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="rounded-l-lg px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">No</th>
            <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide">Suvenir</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Soni</th>
            <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Dona narxi</th>
            <th className="rounded-r-lg px-3 py-3 text-right text-xs font-bold uppercase tracking-wide">Umumiy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="bg-emerald-50/70">
              <td className="px-3 py-4 align-top text-ink-500">{i + 1}</td>
              <td className="px-3 py-4 align-top">
                <div className="flex items-center font-semibold">
                  <Stamp className="mr-2 h-4 w-4 text-emerald-600" />
                  {r.name}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-emerald-700">{r.logo ? "logo bilan" : "logosiz"}</div>
              </td>
              <td className="px-3 py-4 align-top text-right">{Number(r.qty).toLocaleString("uz-UZ")}</td>
              <td className="px-3 py-4 align-top text-right font-semibold">{formatMoney(r.unit_price)}</td>
              <td className="px-3 py-4 align-top text-right font-bold">{formatMoney(r.unit_price * r.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-stretch">
        {sv?.ready_in?.trim() ? (
          <div className="mr-4 flex-1 rounded-2xl border-2 border-emerald-600 px-5 py-4">
            <div className="flex items-center text-xs font-extrabold uppercase tracking-wide text-emerald-700">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Tayyor bo'ladi
            </div>
            <div className="mt-0.5 font-display text-xl font-extrabold">{sv.ready_in.trim()}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="w-[280px] shrink-0 rounded-2xl bg-emerald-600 px-5 py-4 text-white">
          <div className="text-xs font-bold uppercase tracking-wide opacity-90">Umumiy</div>
          <div className="mt-0.5 font-display text-2xl font-extrabold">{formatMoney(proposal.total)}</div>
        </div>
      </div>

      {notes.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center">
            <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <PencilLine className="h-4 w-4" />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-700">Izoh</span>
            <span className="ml-3 h-px flex-1 bg-emerald-200" />
          </div>
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-4 py-1">
            {notes.map((l, i) => (
              <div key={i} className={`flex items-start py-3 text-sm leading-relaxed text-ink-700 ${i ? "border-t border-emerald-100" : ""}`}>
                <span className="mr-3 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0">{l}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {proposal.valid_until && (
        <div className="mt-4 rounded-lg border-l-4 border-rose-600 bg-rose-50/50 p-4">
          <div className="text-sm font-bold text-rose-600">ESLATMA!</div>
          <div className="mt-1 text-sm text-ink-700">Ushbu narxlar {isoDate(proposal.valid_until)}gacha amal qiladi!</div>
        </div>
      )}

      <ProposalFooter company={company} />
    </div>
  );
});

SouvenirOfferPreview.displayName = "SouvenirOfferPreview";

export default SouvenirOfferPreview;
