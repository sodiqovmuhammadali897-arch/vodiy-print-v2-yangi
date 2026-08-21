import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Building2,
  Phone,
  MapPin,
  Tag,
  Package,
  Plus,
  Pencil,
  ClipboardList,
  Wallet,
  CalendarClock,
  TrendingUp,
  FileDown,
  Briefcase,
  Archive,
} from "lucide-react";
import { getOne, listAll, listWhere } from "../../lib/firestoreDb";
import type { Brand, Customer, Order, OrderProduct } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import StatusBadge from "../../components/ui/StatusBadge";
import StatCard from "../../components/ui/StatCard";
import CustomerTypeBadge from "../../components/ui/CustomerTypeBadge";
import { formatDate, formatMoney, formatMoneyShort } from "../../lib/format";
import { exportNodeToPdf } from "../../lib/exportPdf";
import BrandFormModal from "../brands/BrandFormModal";
import CustomerFormModal from "./CustomerFormModal";
import HistoricalOrderModal from "./HistoricalOrderModal";
import { useAuth } from "../../lib/AuthContext";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("customers", "edit");
  const containerRef = useRef<HTMLDivElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandModal, setBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [historicalModal, setHistoricalModal] = useState(false);

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

    const orderIds = new Set(o.map((x) => x.id));
    const allProducts = await listAll<OrderProduct>("order_products");
    setProducts(allProducts.filter((p) => orderIds.has(p.order_id)));
  };

  useEffect(() => {
    void load();
  }, [id]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "cancelled"),
    [orders],
  );
  const lifetimeValue = activeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const currentDebt = activeOrders.reduce(
    (s, o) =>
      s +
      (Number(o.remaining_amount || 0) ||
        Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0))),
    0,
  );
  const lastOrder = orders[0] || null;

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    for (const p of products) {
      const name = p.product_name?.trim() || "Noma'lum";
      const cur = map.get(name) || { name, quantity: 0 };
      cur.quantity += Number(p.quantity || 0);
      map.set(name, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [products]);

  const exportPdf = async () => {
    if (containerRef.current) {
      await exportNodeToPdf(containerRef.current, `mijoz-${customer?.customer_number || id}`);
    }
  };

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
    <div className="space-y-5" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate("/customers")}
          className="btn-ghost -ml-2"
        >
          <ArrowLeft className="h-4 w-4" /> Mijozlar ro'yxati
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={exportPdf}>
            <FileDown className="h-4 w-4" /> PDF
          </button>
          {canEdit && (
            <>
              <button className="btn-secondary" onClick={() => setCustomerModal(true)}>
                <Pencil className="h-4 w-4" /> Tahrirlash
              </button>
              <button className="btn-secondary" onClick={() => setHistoricalModal(true)}>
                <Archive className="h-4 w-4" /> Eski buyurtma qo'shish
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate(`/orders/new?customer=${customer.id}`)}
              >
                <Plus className="h-4 w-4" /> Yangi buyurtma
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-700">
                {customer.customer_number}
              </span>
              <h1 className="font-display text-2xl font-bold text-ink-900">
                {customer.first_name} {customer.last_name}
              </h1>
              <CustomerTypeBadge type={customer.customer_type} />
            </div>
            {customer.position && (
              <p className="text-sm text-ink-500">{customer.position}</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {customer.company && (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Brend" value={customer.company} />
          )}
          {customer.industry && (
            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Soha" value={customer.industry} />
          )}
          {customer.phone && (
            <InfoRow
              icon={<Phone className="h-4 w-4" />}
              label="Telefon"
              value={
                <span className="flex items-center gap-2">
                  <a href={`tel:${customer.phone}`} className="hover:text-brand-700">
                    {customer.phone}
                  </a>
                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    WhatsApp
                  </a>
                </span>
              }
            />
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
          {customer.region && (
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Viloyat" value={customer.region} />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Umumiy buyurtmalar"
          value={activeOrders.length}
          tone="brand"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          title="Umumiy xarid"
          value={formatMoneyShort(lifetimeValue)}
          hint={formatMoney(lifetimeValue)}
          tone="emerald"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Oxirgi buyurtma"
          value={lastOrder ? formatDate(lastOrder.order_date || lastOrder.created_at) : "-"}
          tone="sky"
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <StatCard
          title="Joriy qarzdorlik"
          value={formatMoneyShort(currentDebt)}
          hint={formatMoney(currentDebt)}
          tone={currentDebt > 0 ? "rose" : "emerald"}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      {topProducts.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">
            Eng ko'p buyurtma qilingan mahsulotlar
          </h2>
          <div className="flex flex-wrap gap-2">
            {topProducts.map((p) => (
              <span
                key={p.name}
                className="chip bg-ink-100 text-ink-700"
              >
                {p.name} × {p.quantity}
              </span>
            ))}
          </div>
        </div>
      )}

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
          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditingBrand(null);
                setBrandModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi brend
            </button>
          )}
        </div>
        <AsyncState
          empty={brands.length === 0}
          emptyLabel="Brendlar hali qo'shilmagan"
          emptyIcon={<Tag className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <div
                key={b.id}
                className="group rounded-xl border border-ink-100 p-4 transition hover:border-brand-300"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-ink-900">{b.name}</div>
                      {b.note && <div className="text-xs text-ink-500">{b.note}</div>}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="btn-ghost opacity-0 transition group-hover:opacity-100"
                      onClick={() => {
                        setEditingBrand(b);
                        setBrandModal(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
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
                  <th className="table-th">Menejer</th>
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
                        className="inline-flex items-center gap-1.5 font-semibold text-ink-800 hover:text-brand-700"
                      >
                        {o.is_historical && (
                          <Archive className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        )}
                        {o.title}
                      </Link>
                    </td>
                    <td className="table-td">{formatDate(o.order_date || o.created_at)}</td>
                    <td className="table-td text-ink-600">{o.manager_name || "-"}</td>
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
        brand={editingBrand}
        defaultCustomerId={customer.id}
        onSaved={() => {
          setBrandModal(false);
          void load();
        }}
      />

      <CustomerFormModal
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        customer={customer}
        onSaved={() => {
          setCustomerModal(false);
          void load();
        }}
      />

      <HistoricalOrderModal
        open={historicalModal}
        onClose={() => setHistoricalModal(false)}
        customer={customer}
        onSaved={() => {
          setHistoricalModal(false);
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
