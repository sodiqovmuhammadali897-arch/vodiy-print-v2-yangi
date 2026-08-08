import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import type { Customer } from "../../lib/types";
import Modal from "../../components/ui/Modal";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import CustomerFormModal from "../customers/CustomerFormModal";

type Props = {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  onSelected: (customer: Customer) => void;
};

// Shown when a manager tries to mark an order "Yetkazildi" but it has no
// linked customer yet — delivery is the natural checkpoint to make sure
// every completed sale actually has a customer record behind it.
export default function RequireCustomerModal({
  open,
  onClose,
  customers,
  onSelected,
}: Props) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.phone} ${c.company}`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <>
      <Modal
        open={open && !createOpen}
        onClose={onClose}
        title="Mijozni tanlang"
        description="Buyurtmani 'Yetkazildi' deb belgilashdan oldin mijoz bazaga bog'lanishi kerak"
        size="lg"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mijozni qidirish..."
              className="w-full bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          <button className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> Yangi mijoz
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-100">
          {filtered.length === 0 && (
            <div className="p-4 text-center text-sm text-ink-400">Mijoz topilmadi</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelected(c)}
              className="flex w-full items-center justify-between border-b border-ink-50 px-4 py-3 text-left last:border-b-0 hover:bg-ink-50"
            >
              <div>
                <div className="font-medium text-ink-900">
                  {c.first_name} {c.last_name}
                </div>
                <div className="text-xs text-ink-500">
                  {c.phone} {c.company ? `· ${c.company}` : ""}
                </div>
              </div>
              <CustomerTypeBadge type={c.customer_type} />
            </button>
          ))}
        </div>
      </Modal>

      <CustomerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customer={null}
        onSaved={(c) => {
          setCreateOpen(false);
          onSelected(c);
        }}
      />
    </>
  );
}
