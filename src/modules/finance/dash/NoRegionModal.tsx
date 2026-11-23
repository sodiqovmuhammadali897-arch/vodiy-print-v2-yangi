import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import type { Customer, Order } from "../../../lib/types";
import { UZBEKISTAN_REGIONS } from "../../../lib/orderConstants";
import { updateOne } from "../../../lib/firestoreDb";
import { formatMoneyShort } from "../../../lib/format";
import { salesOf, type Span } from "../../../lib/financeDash";
import { saleDay } from "../../../lib/salesPeriod";
import { useAuth } from "../../../lib/AuthContext";

// «N ta mijozda viloyat yo'q → Tuzatish» opens exactly those customers with
// their orders of the period (the owner, 2026-11-23: «umumiy zakazlarga
// o'tyapti, ashi zakazlar ko'rinsin»). A region is picked right here.
export default function NoRegionModal({
  ids,
  customers,
  orders,
  span,
  onChanged,
  onClose,
}: {
  ids: string[];
  customers: Map<string, Customer>;
  orders: Order[];
  span: Span;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { can } = useAuth();
  const canEdit = can("customers", "edit");
  const sales = useMemo(() => salesOf(orders, span, ids), [orders, span, ids]);
  const [set, setSet] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const done = Object.keys(set).length;

  const save = async (id: string, region: string) => {
    if (!region) return;
    setBusy(id);
    setError("");
    try {
      await updateOne("customers", id, { region });
      setSet((s) => ({ ...s, [id]: region }));
    } catch {
      setError("Saqlanmadi — mijozni tahrirlash huquqi kerak (Mijozlar → Tahrirlash).");
    }
    setBusy("");
  };

  const close = () => {
    if (done) onChanged();
    onClose();
  };

  return (
    <Modal
      open
      onClose={close}
      title={`Viloyati yo'q mijozlar: ${ids.length}`}
      description={`Shu davrda buyurtma bergan, lekin viloyati yozilmagan mijozlar va ularning buyurtmalari.${canEdit ? " Viloyatni shu yerda tanlang — darhol saqlanadi." : ""}`}
      size="lg"
    >
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="divide-y divide-ink-100">
        {ids.map((id) => {
          const c = customers.get(id);
          const list = sales.get(id) || [];
          const name = c ? [c.company, `${c.first_name || ""} ${c.last_name || ""}`.trim()].filter(Boolean).join(" · ") : "Mijoz";
          return (
            <div key={id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <Link to={`/customers/${id}`} className="inline-flex items-center gap-1 font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                    {name || "Mijoz"} <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </Link>
                  <div className="text-xs text-ink-500">{[c?.customer_number, c?.phone, c?.manager_name].filter(Boolean).join(" · ")}</div>
                </div>
                {set[id] ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> {set[id]}
                  </span>
                ) : canEdit ? (
                  <select className="input w-full py-1.5 text-sm sm:w-auto" value="" disabled={busy === id} onChange={(e) => void save(id, e.target.value)}>
                    <option value="">Viloyatni tanlang…</option>
                    {UZBEKISTAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {list.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {list.map((o) => (
                    <Link
                      key={o.id}
                      to={`/orders/${o.id}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                      title={o.title}
                    >
                      <span className="shrink-0 font-bold text-brand-700">{o.order_number || "—"}</span>
                      <span className="max-w-[160px] truncate">{o.title}</span>
                      <span className="shrink-0 text-ink-500">{saleDay(o)} · {formatMoneyShort(Number(o.total_amount || 0))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
