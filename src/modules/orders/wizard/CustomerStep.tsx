import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Send, Phone, Copy, MessageCircle } from "lucide-react";
import type { Brand, Customer, Manager } from "../../../lib/types";
import type { OrderPayload } from "../../../lib/orderService";
import { CUSTOMER_SOURCES } from "../../../lib/orderConstants";
import CustomerTypeBadge from "../../../components/ui/CustomerTypeBadge";
import { formatMoney } from "../../../lib/format";
import Modal from "../../../components/ui/Modal";
import { listWhere } from "../../../lib/firestoreDb";

type Props = {
  payload: OrderPayload;
  set: <K extends keyof OrderPayload>(key: K, v: OrderPayload[K]) => void;
  customers: Customer[];
  brands: Brand[];
  managers: Manager[];
  linkedCustomer: Customer | null;
  onSelectCustomer: (c: Customer | null) => void;
  onSelectBrand: (b: Brand | null) => void;
  onCreateCustomer: (data: Partial<Customer>) => void;
  onCreateBrand: (name: string) => void;
};

type Stats = {
  ordersCount: number;
  revenue: number;
  debt: number;
  lastDate: string | null;
};

export default function CustomerStep({
  payload,
  set,
  customers,
  brands,
  managers,
  linkedCustomer,
  onSelectCustomer,
  onSelectBrand,
  onCreateCustomer,
  onCreateBrand,
}: Props) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [newBrand, setNewBrand] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [nc, setNc] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    extra_phone: "",
    telegram: "",
    company: "",
    address: "",
    note: "",
    source: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const cbrands = brands
          .filter((b) => b.customer_id === c.id)
          .map((b) => b.name)
          .join(" ");
        return [
          c.customer_number,
          c.first_name,
          c.last_name,
          c.phone,
          c.extra_phone,
          c.telegram,
          c.company,
          cbrands,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 12);
  }, [customers, brands, search]);

  const customerBrands = useMemo(
    () =>
      linkedCustomer
        ? brands.filter((b) => b.customer_id === linkedCustomer.id)
        : [],
    [brands, linkedCustomer],
  );

  useEffect(() => {
    const loadStats = async () => {
      if (!linkedCustomer) {
        setStats(null);
        return;
      }
      const rows = await listWhere<{
        total_amount: number;
        paid_amount: number;
        created_at: string;
      }>("orders", "customer_id", linkedCustomer.id, {
        orderBy: ["created_at", "desc"],
      });
      const revenue = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const debt = rows.reduce(
        (s, r) =>
          s + Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0)),
        0,
      );
      setStats({
        ordersCount: rows.length,
        revenue,
        debt,
        lastDate: rows[0]?.created_at || null,
      });
    };
    void loadStats();
  }, [linkedCustomer]);

  const copyPhone = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      /* ignored */
    }
  };

  const checkDuplicate = () => {
    const phone = nc.phone.trim();
    const tg = nc.telegram.trim().replace(/^@/, "");
    if (!phone && !tg) return null;
    const dup = customers.find(
      (c) =>
        (phone && c.phone.replace(/\s+/g, "") === phone.replace(/\s+/g, "")) ||
        (tg && c.telegram.replace(/^@/, "") === tg),
    );
    return dup ? `Bu mijoz bazada mavjud: ${dup.first_name} ${dup.last_name}` : null;
  };

  useEffect(() => {
    setDuplicateWarning(checkDuplicate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nc.phone, nc.telegram]);

  const submitNewCustomer = () => {
    if (!nc.first_name.trim()) return;
    const dup = checkDuplicate();
    if (dup && !confirm(dup + "\n\nBaribir yaratilsinmi?")) return;
    onCreateCustomer({ ...nc, source: payload.customer_source || nc.source });
    setNewCustomer(false);
    setNc({
      first_name: "",
      last_name: "",
      phone: "",
      extra_phone: "",
      telegram: "",
      company: "",
      address: "",
      note: "",
      source: "",
    });
  };

  const submitNewBrand = () => {
    if (!brandName.trim()) return;
    onCreateBrand(brandName.trim());
    setBrandName("");
    setNewBrand(false);
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Buyurtmaning asosiy ma'lumotlari
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Menejer</label>
            <select
              className="input"
              value={payload.manager_id || ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const m = managers.find((x) => x.id === id);
                set("manager_id", id);
                set("manager_name", m?.name || "");
              }}
            >
              <option value="">-- tanlang --</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {payload.manager_id === null && payload.manager_name && (
              <input
                className="input mt-2"
                placeholder="Menejer ismi"
                value={payload.manager_name}
                onChange={(e) => set("manager_name", e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="label">Buyurtma sanasi</label>
            <input
              type="date"
              className="input"
              max={new Date().toISOString().slice(0, 10)}
              value={payload.order_date || ""}
              onChange={(e) => set("order_date", e.target.value || null)}
            />
          </div>
          <div>
            <label className="label">Buyurtma nomi</label>
            <input
              className="input"
              placeholder="Masalan: Ruchka va vizitkalar"
              value={payload.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">Mijoz</h2>
          <button className="btn-primary" onClick={() => setNewCustomer(true)}>
            <Plus className="h-4 w-4" /> Yangi mijoz
          </button>
        </div>

        <div className="relative mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder-ink-400"
              placeholder="ID, ism, telefon, Telegram yoki brend bo'yicha qidiring"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
          </div>
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCustomer(c);
                    setSearch("");
                    setShowDropdown(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-brand-700">
                        {c.customer_number || "—"}
                      </span>
                      <span className="font-semibold text-ink-900">
                        {c.first_name} {c.last_name}
                      </span>
                      <CustomerTypeBadge type={c.customer_type} />
                    </div>
                    <div className="text-xs text-ink-500">
                      {c.phone} {c.company ? `· ${c.company}` : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {linkedCustomer && (
          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-700">
                {linkedCustomer.customer_number || "—"}
              </span>
              <span className="font-display text-lg font-bold text-ink-900">
                {linkedCustomer.first_name} {linkedCustomer.last_name}
              </span>
              <CustomerTypeBadge type={linkedCustomer.customer_type} />
              <button
                className="ml-auto text-xs text-ink-500 hover:text-rose-600"
                onClick={() => onSelectCustomer(null)}
              >
                O'chirish
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-700 md:grid-cols-2">
              {linkedCustomer.company && <div>Kompaniya: {linkedCustomer.company}</div>}
              {linkedCustomer.address && <div>Manzil: {linkedCustomer.address}</div>}
              {linkedCustomer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {linkedCustomer.phone}
                  <button
                    className="ml-1 rounded p-0.5 hover:bg-white"
                    onClick={() => copyPhone(linkedCustomer.phone)}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <a
                    className="rounded p-0.5 hover:bg-white"
                    href={`tel:${linkedCustomer.phone}`}
                  >
                    <Phone className="h-3 w-3" />
                  </a>
                  <a
                    className="rounded p-0.5 hover:bg-white"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/${linkedCustomer.phone.replace(/[^\d]/g, "")}`}
                  >
                    <MessageCircle className="h-3 w-3" />
                  </a>
                </div>
              )}
              {linkedCustomer.telegram && (
                <div className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://t.me/${linkedCustomer.telegram.replace(/^@/, "")}`}
                    className="text-brand-700 hover:underline"
                  >
                    {linkedCustomer.telegram}
                  </a>
                </div>
              )}
            </div>
            {stats && stats.ordersCount > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-100 pt-3 text-xs md:grid-cols-4">
                <StatCell label="Buyurtmalar" value={String(stats.ordersCount)} />
                <StatCell label="Aylanma" value={formatMoney(stats.revenue)} />
                <StatCell
                  label="Qarz"
                  value={formatMoney(stats.debt)}
                  tone={stats.debt > 0 ? "rose" : "emerald"}
                />
                <StatCell
                  label="Oxirgi"
                  value={
                    stats.lastDate
                      ? new Date(stats.lastDate).toLocaleDateString("uz-UZ")
                      : "-"
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Brend</h2>
            <p className="text-xs text-ink-500">
              Brend tanlansa, mijoz ma'lumotlari avtomatik ishlatiladi
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setNewBrand(true)}
            disabled={!linkedCustomer}
          >
            <Plus className="h-4 w-4" /> Yangi brend
          </button>
        </div>
        <div className="mt-3">
          <select
            className="input"
            value={payload.brand_id || ""}
            onChange={(e) => {
              const b = brands.find((x) => x.id === e.target.value) || null;
              onSelectBrand(b);
            }}
          >
            <option value="">-- brend tanlang --</option>
            {(linkedCustomer ? customerBrands : brands).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Mijoz manbasi
        </h2>
        <p className="text-xs text-ink-500">
          Mijoz sizni qayerdan topgan — marketing hisobotlari uchun kerak
        </p>
        <div className="mt-3">
          <select
            className="input"
            value={payload.customer_source}
            onChange={(e) => set("customer_source", e.target.value)}
          >
            <option value="">-- tanlang --</option>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {payload.customer_source === "Boshqa" && (
            <input
              className="input mt-2"
              placeholder="Manba haqida qisqacha izoh"
              value={payload.customer_note}
              onChange={(e) => set("customer_note", e.target.value)}
            />
          )}
        </div>
      </div>

      <Modal
        open={newCustomer}
        onClose={() => setNewCustomer(false)}
        title="Yangi mijoz"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setNewCustomer(false)}>
              Bekor qilish
            </button>
            <button className="btn-primary" onClick={submitNewCustomer}>
              Yaratish
            </button>
          </>
        }
      >
        {duplicateWarning && (
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {duplicateWarning}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ism *</label>
            <input
              className="input"
              value={nc.first_name}
              onChange={(e) => setNc((f) => ({ ...f, first_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Familiya</label>
            <input
              className="input"
              value={nc.last_name}
              onChange={(e) => setNc((f) => ({ ...f, last_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              className="input"
              value={nc.phone}
              onChange={(e) => setNc((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Qo'shimcha telefon</label>
            <input
              className="input"
              value={nc.extra_phone}
              onChange={(e) => setNc((f) => ({ ...f, extra_phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Telegram</label>
            <input
              className="input"
              value={nc.telegram}
              onChange={(e) => setNc((f) => ({ ...f, telegram: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Kompaniya</label>
            <input
              className="input"
              value={nc.company}
              onChange={(e) => setNc((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Manzil</label>
            <input
              className="input"
              value={nc.address}
              onChange={(e) => setNc((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={newBrand}
        onClose={() => setNewBrand(false)}
        title="Yangi brend"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setNewBrand(false)}>
              Bekor qilish
            </button>
            <button className="btn-primary" onClick={submitNewBrand}>
              Yaratish
            </button>
          </>
        }
      >
        <label className="label">Brend nomi</label>
        <input
          className="input"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
        />
      </Modal>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-ink-900";
  return (
    <div className="rounded-lg bg-white/70 p-2">
      <div className="text-[10px] font-semibold uppercase text-ink-500">
        {label}
      </div>
      <div className={`text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}
