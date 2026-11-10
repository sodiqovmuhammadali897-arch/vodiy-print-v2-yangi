import { forwardRef } from "react";
import { Check, Clock, Gift, PencilLine } from "lucide-react";
import type { CompanySettings, Proposal } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { ProposalFooter, isoDate } from "./ProposalPreview";

// The gift box offer the manager sends the customer as a PNG — the same
// look as the commercial proposal (green, signature, contacts). Margins,
// not gap, where html2canvas would mishandle it.
type Props = { proposal: Proposal; company: CompanySettings | null };

const GiftboxOfferPreview = forwardRef<HTMLDivElement, Props>(({ proposal, company }, ref) => {
  const g = proposal.giftbox;
  const companyName = company?.name || "Kompaniya";
  const customerName = proposal.recipient_name?.trim();
  const items = (g?.items || []).filter((i) => i.name.trim() && i.qty > 0);
  const notes = (proposal.note || "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div ref={ref} className="force-light mx-auto bg-white text-ink-900" style={{ width: 794, minHeight: 1123, padding: 48 }}>
      <header className="flex items-start justify-between">
        <div>
          <div className="font-display text-4xl font-extrabold text-emerald-600">{companyName}</div>
          <div className="mt-2 text-sm text-ink-500">Gift box taklifi · {isoDate(proposal.created_at)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-ink-900">Sana</div>
          <div className="text-sm text-ink-700">{isoDate(proposal.created_at)}</div>
        </div>
      </header>
      <div className="mt-4 h-[3px] w-full bg-emerald-600" />

      <div className="mt-6 text-xl font-bold leading-snug text-ink-900">
        <span className="text-emerald-600">{companyName}</span>
        {customerName ? <>dan {customerName} uchun gift box taklifi</> : <> gift box taklifi</>}
      </div>

      <div className="mt-6 flex items-stretch">
        <div className="mr-5 flex-1 rounded-2xl bg-emerald-50 px-6 py-5">
          <div className="flex items-center text-xs font-extrabold uppercase tracking-wider text-emerald-700">
            <Gift className="mr-1.5 h-4 w-4" /> Gift box
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold">{g?.type_name || "—"}</div>
          <div className="mt-3">
            {items.map((it, i) => (
              <div key={i} className={`flex items-center py-2 text-[15px] ${i ? "border-t border-emerald-100" : ""}`}>
                <span className="mr-2.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span>
                  {it.name}
                  {it.qty > 1 && <span className="text-ink-500"> × {it.qty}</span>}
                </span>
                <span className="ml-auto text-sm font-bold text-emerald-700">logo bilan</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[250px] shrink-0 flex-col">
          <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-white">
            <div className="text-xs font-bold uppercase tracking-wide opacity-90">1 dona narxi</div>
            <div className="mt-0.5 font-display text-2xl font-extrabold">{formatMoney(g?.unit_price || 0)}</div>
            <div className="mt-1.5 text-[13px] opacity-90">
              {Number(g?.quantity || 0).toLocaleString("uz-UZ")} dona · jami <b>{formatMoney(proposal.total)}</b>
            </div>
          </div>
          {g?.ready_in?.trim() && (
            <div className="mt-3 rounded-2xl border-2 border-emerald-600 px-5 py-3.5">
              <div className="flex items-center text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Tayyor bo'ladi
              </div>
              <div className="mt-0.5 font-display text-xl font-extrabold">{g.ready_in.trim()}</div>
            </div>
          )}
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
          <div className="mt-1 text-sm text-ink-700">Ushbu narx {isoDate(proposal.valid_until)}gacha amal qiladi!</div>
        </div>
      )}

      <ProposalFooter company={company} />
    </div>
  );
});

GiftboxOfferPreview.displayName = "GiftboxOfferPreview";

export default GiftboxOfferPreview;
