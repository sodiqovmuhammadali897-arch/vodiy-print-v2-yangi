import { Phone, Send, Pencil, ClipboardPlus, Clock } from "lucide-react";
import { formatMoneyShort, initialsOf } from "../../lib/format";
import { contactTone, formatShortDate } from "../../lib/leadContactStatus";
import type { Lead } from "../../lib/types";

type Props = {
  lead: Lead;
  draggable: boolean;
  onDragStart: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onAddTask: () => void;
};

const toneClass: Record<string, string> = {
  overdue: "bg-rose-50 text-rose-700",
  today: "bg-amber-50 text-amber-800",
  upcoming: "bg-ink-100 text-ink-500",
};

export default function LeadCard({ lead, draggable, onDragStart, onOpen, onEdit, onAddTask }: Props) {
  const tone = contactTone(lead.next_contact_at);
  const isLost = lead.status === "lost";

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="cursor-pointer rounded-xl border border-ink-100 bg-surface p-3 shadow-sm hover:border-brand-300"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink-900">{lead.full_name}</div>
          {lead.brand && <div className="truncate text-[11px] text-ink-400">{lead.brand}</div>}
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-ink-400">{lead.lead_number}</span>
      </div>
      <div className="mt-0.5 text-xs tabular-nums text-ink-500">{lead.phone}</div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lead.interested_product_name && (
          <span className="chip bg-brand-50 text-[10px] text-brand-700">{lead.interested_product_name}</span>
        )}
        {lead.source && <span className="chip bg-ink-100 text-[10px] text-ink-600">{lead.source}</span>}
      </div>

      {isLost && lead.lost_reason && (
        <div className="mt-1.5 text-[11px] text-rose-600">Sabab: {lead.lost_reason}</div>
      )}

      {!isLost && tone && (
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-bold ${toneClass[tone]}`}>
          <Clock className="h-3 w-3" />
          {tone === "overdue" ? "Kechikkan" : "Aloqa"}: {formatShortDate(lead.next_contact_at as string)}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs font-extrabold text-ink-900">
          {lead.estimated_amount ? formatMoneyShort(lead.estimated_amount) + " so'm" : "—"}
        </span>
        <span
          className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-[9px] font-bold text-white"
          title={lead.assigned_to_name}
        >
          {lead.assigned_to_name ? initialsOf(lead.assigned_to_name) : "-"}
        </span>
      </div>

      {!isLost && (
        <div className="mt-2.5 flex gap-1">
          <a
            href={lead.phone ? `tel:${lead.phone.replace(/\s/g, "")}` : undefined}
            onClick={stop}
            className="flex h-6.5 flex-1 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-ink-500 hover:text-brand-600"
          >
            <Phone className="h-3 w-3" />
          </a>
          <a
            href={lead.telegram ? `https://t.me/${lead.telegram.replace(/^@/, "")}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            className="flex h-6.5 flex-1 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-ink-500 hover:text-brand-600"
          >
            <Send className="h-3 w-3" />
          </a>
          <button
            onClick={(e) => {
              stop(e);
              onEdit();
            }}
            className="flex h-6.5 flex-1 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-ink-500 hover:text-brand-600"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              stop(e);
              onAddTask();
            }}
            className="flex h-6.5 flex-1 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 text-ink-500 hover:text-brand-600"
          >
            <ClipboardPlus className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
