import { useEffect, useMemo, useState } from "react";
import { Search, Shirt, FileOutput } from "lucide-react";
import { getOne, listAll, listWhere } from "../../lib/firestoreDb";
import type { CompanySettings, Customer, Order, OrderProduct, Product } from "../../lib/types";
import { formatMoney, formatDate } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";
import StatusBadge from "../../components/ui/StatusBadge";
import TextileMatrixTable from "../../components/textile/TextileMatrixTable";
import TextileMatrixExport from "./TextileMatrixExport";
import RazmerlarTab from "./RazmerlarTab";
import { pivotTextileBreakdown } from "../../lib/textileMatrix";

type TextileOrderSummary = {
  order: Order;
  customerName: string;
  productName: string;
};

export default function Textile() {
  const [tab, setTab] = useState<"catalog" | "orders" | "sizes">("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [orderSummaries, setOrderSummaries] = useState<TextileOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void listAll<Product>("products", { orderBy: ["name", "asc"] }).then((rows) => {
      setProducts(rows.filter((p) => p.category === "Textil"));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab !== "orders" || orderSummaries.length > 0) return;
    setOrdersLoading(true);
    void (async () => {
      const [textileLines, orders, customers, cs] = await Promise.all([
        listWhere<OrderProduct>("order_products", "category", "Textil"),
        listAll<Order>("orders", { orderBy: ["created_at", "desc"] }),
        listAll<Customer>("customers"),
        getOne<CompanySettings>("company_settings", "main"),
      ]);
      setCompany(cs);
      const withBreakdown = textileLines.filter(
        (p) => Array.isArray(p.size_breakdown) && p.size_breakdown.length > 0,
      );
      const byOrderId = new Map<string, OrderProduct[]>();
      for (const p of withBreakdown) {
        const arr = byOrderId.get(p.order_id) || [];
        arr.push(p);
        byOrderId.set(p.order_id, arr);
      }
      const customersMap = new Map(customers.map((c) => [c.id, c]));
      const ordersMap = new Map(orders.map((o) => [o.id, o]));
      const summaries: TextileOrderSummary[] = [];
      for (const [orderId, lines] of byOrderId) {
        const order = ordersMap.get(orderId);
        if (!order) continue;
        const cust = order.customer_id ? customersMap.get(order.customer_id) : undefined;
        summaries.push({
          order,
          customerName: cust ? `${cust.first_name} ${cust.last_name}`.trim() : "",
          productName: lines[0]?.product_name || "",
        });
      }
      summaries.sort(
        (a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime(),
      );
      setOrderSummaries(summaries);
      setOrdersLoading(false);
    })();
  }, [tab, orderSummaries.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const selected = orderSummaries.find((s) => s.order.id === selectedOrderId) || null;

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderProducts([]);
      return;
    }
    void listWhere<OrderProduct>("order_products", "order_id", selectedOrderId).then(
      setOrderProducts,
    );
  }, [selectedOrderId]);

  const matrix = useMemo(() => pivotTextileBreakdown(orderProducts), [orderProducts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <Shirt className="h-6 w-6 text-brand-600" /> Textil
          </h1>
          <p className="text-sm text-ink-500">
            {tab === "catalog"
              ? "Mahsulotlar katalogidagi Textil kategoriyali mahsulotlar"
              : tab === "orders"
              ? "Buyurtmalardagi razmer/rang taqsimoti"
              : "Buyurtmadan oldin razmer/rang taqsimotini tayyorlab, klentga tasdiqlatib qo'ying"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-ink-200 bg-surface p-1 shadow-sm">
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === "catalog" ? "bg-brand-600 text-white" : "text-ink-600"
              }`}
              onClick={() => setTab("catalog")}
            >
              Katalog
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === "orders" ? "bg-brand-600 text-white" : "text-ink-600"
              }`}
              onClick={() => setTab("orders")}
            >
              Buyurtmalar
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === "sizes" ? "bg-brand-600 text-white" : "text-ink-600"
              }`}
              onClick={() => setTab("sizes")}
            >
              Razmerlar
            </button>
          </div>
          {tab === "catalog" && (
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mahsulot qidirish..."
                className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
              />
            </div>
          )}
        </div>
      </div>

      {tab === "sizes" ? (
        <RazmerlarTab />
      ) : tab === "catalog" ? (
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Textil mahsulotlar mavjud emas"
          emptyDescription={`Mahsulotlar bo'limida kategoriyani "Textil" qilib mahsulot qo'shsangiz, u shu yerda avtomatik ko'rinadi`}
          emptyIcon={<Shirt className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.id} className="card space-y-3 p-4">
                <div className="font-display text-base font-bold text-ink-900">{p.name}</div>

                {p.sizes.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-ink-500">Razmerlar</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.sizes.map((s) => (
                        <span key={s} className="chip bg-ink-100 text-ink-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {p.colors.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-ink-500">Ranglar</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.colors.map((c) => (
                        <span key={c} className="chip bg-ink-100 text-ink-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-semibold uppercase text-ink-500">
                    Narx pog'onasi
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.price_tiers.map((t, i) => (
                      <span key={i} className="chip bg-emerald-50 text-emerald-800">
                        {t.min_qty}+ · {formatMoney(t.price)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AsyncState>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <div className="card p-4">
            <div className="mb-2 text-xs font-semibold uppercase text-ink-500">
              Razmer taqsimoti bor buyurtmalar
            </div>
            <AsyncState
              loading={ordersLoading}
              empty={orderSummaries.length === 0}
              emptyLabel="Hali razmer taqsimoti kiritilgan buyurtma yo'q"
              emptyIcon={<Shirt className="h-5 w-5" />}
            >
              <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
                {orderSummaries.map((s) => (
                  <li key={s.order.id}>
                    <button
                      onClick={() => setSelectedOrderId(s.order.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                        selectedOrderId === s.order.id ? "bg-brand-50 text-brand-700" : "text-ink-700"
                      }`}
                    >
                      <div className="font-semibold">{s.order.order_number || s.order.id}</div>
                      <div className="text-xs text-ink-500">
                        {s.customerName || "Mijoz yo'q"} · {s.productName}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </div>

          <div className="card p-5">
            {!selected ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-ink-400">
                Chapdan buyurtma tanlang
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-ink-500">ID</div>
                      <div className="font-display text-lg font-bold text-brand-700">
                        {selected.order.order_number || selected.order.id}
                      </div>
                    </div>
                    <StatusBadge status={selected.order.status} />
                  </div>
                  <button className="btn-secondary" onClick={() => setExportOpen(true)}>
                    <FileOutput className="h-4 w-4" /> Chop etish / Ulashish
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-ink-500">Mijoz</div>
                    <div className="font-medium text-ink-800">{selected.customerName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-ink-500">Mahsulot</div>
                    <div className="font-medium text-ink-800">{selected.productName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-ink-500">Jami soni</div>
                    <div className="font-medium text-ink-800">{matrix.grandTotal} dona</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-ink-500">Sana</div>
                    <div className="font-medium text-ink-800">
                      {formatDate(selected.order.order_date || selected.order.created_at)}
                    </div>
                  </div>
                </div>
                <TextileMatrixTable matrix={matrix} />
                {selected.order.textile_sizes_confirmed_at && (
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Klent bilan tasdiqlangan · {formatDate(selected.order.textile_sizes_confirmed_at)}
                  </div>
                )}
              </div>
            )}
          </div>

          {selected && (
            <TextileMatrixExport
              open={exportOpen}
              onClose={() => setExportOpen(false)}
              company={company}
              orderNumber={selected.order.order_number || ""}
              clientName={selected.customerName}
              productName={selected.productName}
              orderDate={selected.order.order_date || selected.order.created_at}
              matrix={matrix}
            />
          )}
        </div>
      )}
    </div>
  );
}
