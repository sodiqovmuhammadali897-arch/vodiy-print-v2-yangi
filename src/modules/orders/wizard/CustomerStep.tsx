import { useEffect, useMemo, useState } from "react";
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

// One pickable row per brand, plus a fallback row for customers who don't
// have a brand yet — so a bare-name search still finds them.
type PickRow = {
  key: string;
  customerId: string;
  brandId: string | null;
  primary: string;
  customer: Customer;
};

export default function CustomerStep({
  customers,
  brands,
  payload,
  onPayloadChange,
  onCustomerCreated,
  managerNames,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === payload.customer_id) || null;

  // Seed the display text once, when an existing order's customer loads in.
  useEffect(() => {
    if (!payload.customer_id || query) return;
    const c = customers.find((c) => c.id === payload.customer_id) || null;
    if (!c) return;
    const brand = payload.brand_id
      ? brands.find((b) => b.id === payload.brand_id)
      : brands.find((b) => b.customer_id === c.id);
    setQuery(brand?.name || `${c.first_name} ${c.last_name}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.customer_id]);

  const pickRows = useMemo<PickRow[]>(() => {
    const customersWithBrand = new Set(brands.map((b) => b.customer_id));
    const brandRows: PickRow[] = brands
      .map((b): PickRow | null => {
        const c = customers.find((c) => c.id === b.customer_id);
        return c ? { key: `brand-${b.id}`, customerId: c.id, brandId: b.id, primary: b.name, customer: c } : null;
      })
      .filter((r): r is PickRow => r !== null);
    const noBrandRows: PickRow[] = customers
      .filter((c) => !customersWithBrand.has(c.id))
      .map((c) => ({
        key: `customer-${c.id}`,
        customerId: c.id,
        brandId: null,
        primary: `${c.first_name} ${c.last_name}`.trim(),
        customer: c,
      }));
    return [...brandRows, ...noBrandRows];
  }, [brands, customers]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pickRows
      .filter((r) =>
        `${r.primary} ${r.customer.first_name} ${r.customer.last_name} ${r.customer.phone}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 20);
  }, [pickRows, query]);

  const selectRow = (row: PickRow) => {
    onPayloadChange({ customer_id: row.customerId, brand_id: row.brandId });
    setQuery(row.primary);
    setFocused(false);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (payload.customer_id) onPayloadChange({ customer_id: null, brand_id: null });
  };

  const showDropdown = focused && query.trim() !== "" && !selectedCustomer;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">Mijoz</h2>
          <button className="btn-ghost" onClick={() => setModalOpen(true)}>
            <UserPlus className="h-4 w-4" /> Yangi mijoz
          </button>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Brend nomini kiriting..."
              className="w-full bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>

          {showDropdown && (
            <div
              className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-100 bg-surface shadow-lg"
              // Keeps the input focused while tapping/clicking inside this
              // list, so it never blurs mid-interaction — without this, a
              // touch tap (which moves slightly, unlike a mouse click) can
              // register as blur-then-scroll instead of a row selection.
              onMouseDown={(e) => e.preventDefault()}
            >
              {filteredRows.length === 0 && (
                <div className="p-4 text-center text-sm text-ink-400">
                  Mos brend/mijoz topilmadi — "Yangi mijoz" tugmasi orqali qo'shing
                </div>
              )}
              {filteredRows.map((r) => (
                <button
                  key={r.key}
                  onClick={() => selectRow(r)}
                  className="flex w-full items-center justify-between border-b border-ink-50 px-4 py-3 text-left last:border-b-0 hover:bg-ink-50"
                >
                  <div>
                    <div className="font-medium text-ink-900">{r.primary}</div>
                    <div className="text-xs text-ink-500">
                      {r.customer.first_name} {r.customer.last_name} · {r.customer.phone}
                    </div>
                  </div>
                  <CustomerTypeBadge type={r.customer.customer_type} />
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <div className="font-medium text-ink-900">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </div>
              <div className="text-xs text-ink-500">
                {selectedCustomer.phone}
                {selectedCustomer.company ? ` · ${selectedCustomer.company}` : ""}
              </div>
            </div>
            <CustomerTypeBadge type={selectedCustomer.customer_type} />
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Buyurtma haqida</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        initialCompany={query}
        onSaved={(c) => {
          onCustomerCreated(c);
          onPayloadChange({ customer_id: c.id, brand_id: null });
          setQuery(c.company || `${c.first_name} ${c.last_name}`.trim());
          setModalOpen(false);
        }}
      />
    </div>
  );
}