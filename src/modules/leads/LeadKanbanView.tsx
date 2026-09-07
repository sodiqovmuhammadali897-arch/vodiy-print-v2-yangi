import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { LEAD_STATUSES, columnForLead, type LeadColumnKey } from "../../lib/orderConstants";
import { formatMoneyShort } from "../../lib/format";
import type { Lead, LeadStatus, Order } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import LeadCard from "./LeadCard";

type Props = {
  leads: Lead[];
  orders: Record<string, Order>;
  loading: boolean;
  canEdit: boolean;
  onOpen: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onAddTask: (lead: Lead) => void;
  onDrop: (lead: Lead, columnKey: LeadStatus | "cancelled") => void;
};

export default function LeadKanbanView({ leads, orders, loading, canEdit, onOpen, onEdit, onAddTask, onDrop }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<LeadColumnKey | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<LeadColumnKey, Lead[]>();
    for (const s of LEAD_STATUSES) map.set(s.key, []);
    for (const l of leads) map.get(columnForLead(l, orders))?.push(l);
    return map;
  }, [leads, orders]);

  return (
    <AsyncState
      loading={loading}
      empty={leads.length === 0}
      emptyLabel="Lidlar mavjud emas"
      emptyDescription="Yuqoridagi tugma orqali birinchi lidingizni qo'shing"
      emptyIcon={<Target className="h-5 w-5" />}
    >
      <div className="flex flex-1 gap-3.5 overflow-x-auto pb-2">
        {LEAD_STATUSES.map((col) => {
          const rows = byColumn.get(col.key) || [];
          const sum = rows.reduce((s, l) => s + Number(l.estimated_amount || 0), 0);
          return (
            <div
              key={col.key}
              className={`flex w-64 shrink-0 flex-col rounded-2xl bg-ink-50/70 p-3 ${dragOverCol === col.key ? "ring-2 ring-brand-400" : ""}`}
              onDragOver={(e) => {
                if (!canEdit || col.key === "cancelled") return;
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                if (!canEdit || col.key === "cancelled" || !draggingId) return;
                const lead = leads.find((l) => l.id === draggingId);
                if (lead) onDrop(lead, col.key as LeadStatus | "cancelled");
                setDraggingId(null);
              }}
            >
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-700">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
                  {col.label}
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-500">{rows.length}</span>
              </div>
              {sum > 0 && <div className="mb-2 px-1 text-[11px] font-bold text-ink-500">{formatMoneyShort(sum)} so'm</div>}
              <div className="flex flex-col gap-2.5 overflow-y-auto">
                {rows.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    draggable={canEdit && lead.status !== "lost"}
                    onDragStart={() => setDraggingId(lead.id)}
                    onOpen={() => onOpen(lead)}
                    onEdit={() => onEdit(lead)}
                    onAddTask={() => onAddTask(lead)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AsyncState>
  );
}
