import { List } from "lucide-react";
import { columnForLead, leadStatusInfo } from "../../lib/orderConstants";
import { formatMoney } from "../../lib/format";
import { formatShortDate } from "../../lib/leadContactStatus";
import type { Lead, Order } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";

type Props = {
  leads: Lead[];
  orders: Record<string, Order>;
  loading: boolean;
  onOpen: (lead: Lead) => void;
};

export default function LeadListView({ leads, orders, loading, onOpen }: Props) {
  return (
    <AsyncState
      loading={loading}
      empty={leads.length === 0}
      emptyLabel="Lidlar mavjud emas"
      emptyDescription="Filtrlarni tekshiring yoki yangi lid qo'shing"
      emptyIcon={<List className="h-5 w-5" />}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">ID</th>
              <th className="table-th">Ism / brend</th>
              <th className="table-th">Telefon</th>
              <th className="table-th">Manba</th>
              <th className="table-th">Mahsulot</th>
              <th className="table-th">Manager</th>
              <th className="table-th">Status</th>
              <th className="table-th">Summa</th>
              <th className="table-th">Keyingi aloqa</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const info = leadStatusInfo(columnForLead(l, orders));
              return (
                <tr key={l.id} className="cursor-pointer border-t border-ink-100 hover:bg-ink-50" onClick={() => onOpen(l)}>
                  <td className="table-td font-semibold text-ink-500">{l.lead_number}</td>
                  <td className="table-td font-semibold text-ink-800">
                    {l.full_name}
                    {l.brand ? ` · ${l.brand}` : ""}
                  </td>
                  <td className="table-td tabular-nums">{l.phone}</td>
                  <td className="table-td">{l.source || "-"}</td>
                  <td className="table-td">{l.interested_product_name || "-"}</td>
                  <td className="table-td">{l.assigned_to_name || "-"}</td>
                  <td className="table-td">
                    <span className="chip" style={{ background: info.bg, color: info.text }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: info.dot }} />
                      {info.label}
                    </span>
                  </td>
                  <td className="table-td tabular-nums">{l.estimated_amount ? formatMoney(l.estimated_amount) : "-"}</td>
                  <td className="table-td">{l.next_contact_at ? formatShortDate(l.next_contact_at) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AsyncState>
  );
}
