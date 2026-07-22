import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Building2, Phone, MapPin, Tag, Package, Plus } from "lucide-react";
import { getOne, listWhere } from "../../lib/firestoreDb";
import type { Brand, Customer, Order } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import BrandFormModal from "../brands/BrandFormModal";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandModal, setBrandModal] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [c, b, o] = await Promise.all([
      getOne<Customer>("customers", id),
      listWhere<Brand>("brands", "customer_id", id, {
        orderBy: ["created_at", "desc"],
      }),
      listWhere<Order>("orders", "customer_id", id, {
        orderBy: ["created_at", "desc"],
      }),
    ]);
    setCustomer(c);
    setBrands(b);
    setOrders(o);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500">Yuklanmoqda...</div>
    );
  }

  if (!customer) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-600">Mijoz topilmadi</p>
        <button className="btn-secondary mt-3" onClick={() => navigate("/customers")}>
          Ortga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate("/customers")}
        className="btn-ghost -ml-2"
      >
        <ArrowLeft className="h-4 w-4" /> Mijozlar ro'yxati
      </button>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {customer.first_name} {customer.last_name}
            </h1>
            {customer.position && (
              <p className="text-sm text-ink-500">{customer.position}</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {customer.company && (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Kompaniya" value={customer.company} />
          )}
          {customer.phone && (
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefon" value={customer.phone} />
          )}
          {customer.extra_phone && (
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Qo'shimcha telefon" value={customer.extra_phone} />
          )}
          {customer.telegram && (
            <InfoRow
              icon={<Send className="h-4 w-4" />}
              label="Telegram"
              value={
                <a
                  href={`https://t.me/${customer.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  {customer.telegram}
                </a>
              }
            />
          )}
          {customer.address && (
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Manzil" value={customer.address} />
          )}
        </div>
        {customer.note && (
          <p className="mt-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
            {customer.note}
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">
              Brendlar
            </h2>
            <p className="text-xs text-ink-500">
              Bu mijozga tegishli brendlar ({brands.length})
            </p>
          </div>
          <button className="btn-primary" onClick={() => setBrandModal(true)}>
            <Plus className="h-4 w-4" /> Yangi brend
          </button>
        </div>
        <AsyncState
          empty={brands.length === 0}
          emptyLabel="Brendlar hali qo'shilmagan"
          emptyIcon={<Tag className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <div key={b.id} className="rounded-xl border border-ink-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink-900">{b.name}</div>
                    {b.note && <div className="text-xs text-ink-500">{b.note}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AsyncState>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">
              Buyurtmalar tarixi
            </h2>
            <p className="text-xs text-ink-500">Barchasi ({orders.length})</p>
          </div>
        </div>
        <AsyncState
          empty={orders.length === 0}
          emptyLabel="Buyurtmalar mavjud emas"
          emptyIcon={<Package className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="table-th">Buyurtma</th>
                  <th className="table-th">Sana</th>
                  <th className="table-th">Summa</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-ink-50/50">
                    <td className="table-td">
                      <Link
                        to={`/orders/${o.id}`}
                        className="font-semibold text-ink-800 hover:text-brand-700"
                      >
                        {o.title}
                      </Link>
                    </td>
                    <td className="table-td">{formatDate(o.created_at)}</td>
                    <td className="table-td">{formatMoney(o.total_amount)}</td>
                    <td className="table-td">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <BrandFormModal
        open={brandModal}
        onClose={() => setBrandModal(false)}
        defaultCustomerId={customer.id}
        onSaved={() => {
          setBrandModal(false);
          void load();
        }}
      />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-ink-800">{value}</div>
    </div>
  );
}
