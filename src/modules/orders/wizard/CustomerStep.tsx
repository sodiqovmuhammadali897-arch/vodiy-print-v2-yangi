import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import type { Brand, Customer } from "../../../lib/types";
import type { OrderPayload } from "../../../lib/orderService";
import { CUSTOMER_SOURCES } from "../../../lib/orderConstants";
import CustomerTypeBadge from "../../../components/ui/CustomerTypeBadge";
import CustomerFormModal from "../../customers/CustomerFormModal";

type Props = {
  customers: Customer[];
  brands: Brand[];
  payload: OrderPayload;
  onPayloadChange: (patch: Partial<OrderPayload>) => void;
  onCustomerCreated: (customer: Customer) => void;
  managerNames: string[];
};

export default function CustomerStep({
  customers,
  brands,
  payload,
  onPayloadChange,
  onCustomerCreated,
  managerNames,
}: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.phone} ${c.company}`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const selectedCustomer = customers.find((c) => c.id === payload.customer_id) || null;
  const customerBrands = brands.filter((b) => b.customer_id === payload.customer_id);

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">Mijoz</h2>
          <button className="btn-ghost" onClick={() => setModalOpen(true)}>
            <UserPlus className="h-4 w-4" /> Yangi mijoz
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mijozni qidirish..."
            className="w-full bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-100">
          {filteredCustomers.length === 0 && (
            <div className="p-4 text-center text-sm text-ink-400">Mijoz topilmadi</div>
          )}
          {filteredCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => onPayloadChange({ customer_id: c.id, brand_id: null })}
              className={`flex w-full items-center justify-between border-b border-ink-50 px-4 py-3 text-left last:border-b-0 hover:bg-ink-50 ${
                payload.customer_id === c.id ? "bg-brand-50" : ""
              }`}
            >
              <div>
                <div className="font-medium text-ink-900">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-ink-500">{c.phone} {c.company ? `· ${c.company}` : ""}</div>
              </div>
              <CustomerTypeBadge type={c.customer_type} />
            </button>
          ))}
        </div>

        {selectedCustomer && customerBrands.length > 0 && (
          <div className="mt-4">
            <label className="label">Brend</label>
            <select
              className="input"
              value={payload.brand_id || ""}
              onChange={(e) => onPayloadChange({ brand_id: e.target.value || null })}
            >
              <option value="">-- brendsiz --</option>
              {customerBrands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Buyurtma haqida</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Sarlavha</label>
            <input
              className="input"
              value={payload.title}
              onChange={(e) => onPayloadChange({ title: e.target.value })}
              placeholder="Masalan: 100 dona futbolka"
            />
          </div>
          <div>
            <label className="label">Menejer</label>
            <select className="input" value={payload.manager_name} onChange={(e) => onPayloadChange({ manager_name: e.target.value })}>
              <option value="">-- tanlang --</option>
              {managerNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Manba</label>
            <select className="input" value={payload.customer_source} onChange={(e) => onPayloadChange({ customer_source: e.target.value })}>
              <option value="">-- tanlang --</option>
              {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Buyurtma sanasi</label>
            <input type="date" className="input" value={payload.order_date || ""} onChange={(e) => onPayloadChange({ order_date: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" value={payload.deadline || ""} onChange={(e) => onPayloadChange({ deadline: e.target.value || null })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Tavsif</label>
            <textarea className="input min-h-[70px]" value={payload.description} onChange={(e) => onPayloadChange({ description: e.target.value })} />
          </div>
        </div>
      </div>

      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customer={null}
        onSaved={(c) => {
          onCustomerCreated(c);
          onPayloadChange({ customer_id: c.id, brand_id: null });
          setModalOpen(false);
        }}
      />
    </div>
  );
}