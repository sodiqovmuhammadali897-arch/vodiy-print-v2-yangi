import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Coins, Download, Lock, Percent, Search, TrendingUp, Wallet, Wand2 } from "lucide-react";
import { deleteOne, listAll, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { canViewMargin } from "../../lib/rolePermissions";
import { exportCsv } from "../../lib/exportCsv";
import { formatMoney, formatMoneyShort } from "../../lib/format";
import { buildMarginRows, catalogCostLookup, isSaleOrder, summarize, type MarginRow } from "../../lib/margin";
import type { Customer, Order, OrderCost, OrderProduct, Product, ProductCost } from "../../lib/types";
import StatCard from "../../components/ui/StatCard";
import AsyncState from "../../components/ui/AsyncState";

type View = "orders" | "products" | "managers";
type Filter = "all" | "missing" | "costed" | "low" | "loss";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const thisMonth = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const prevMonth = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, "0")}`;
};
const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString("ru-RU", { maximumFractionDigits: digits }).replace(/,/g, ".");
const parseNum = (s: string): number | null => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const orderDay = (o: Order) => String(o.order_date || o.created_at || "").slice(0, 10);
const marginChip = (m: number | null) =>
  m === null ? "text-ink-400" : m < 15 ? "bg-rose-50 text-rose-700" : m < 25 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";

export default function MarginPage() {
  const auth = useAuth();
  const allowed = canViewMargin(auth);
  const [month, setMonth] = useState(thisMonth());
  const [manager, setManager] = useState("");
  const [view, setView] = useState<View>("orders");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<OrderProduct[]>([]);
  const [costs, setCosts] = useState<Map<string, OrderCost>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [customers, setCustomers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [filling, setFilling] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const [o, l, c, p, pc, cu] = await Promise.all([
          listAll<Order>("orders"),
          listAll<OrderProduct>("order_products"),
          listAll<OrderCost>("order_costs"),
          listAll<Product>("products"),
          listAll<ProductCost>("product_costs"),
          listAll<Customer>("customers").catch(() => [] as Customer[]),
        ]);
        setCustomers(new Map(cu.map((x) => [x.id, [x.first_name, x.last_name].filter(Boolean).join(" ") || x.company || x.phone || ""])));
        setOrders(o.filter(isSaleOrder));
        setLines(l);
        setCosts(new Map(c.map((x) => [x.id, x])));
        setProducts(p);
        setProductCosts(pc);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ma'lumotlarni yuklab bo'lmadi");
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  const lookup = useMemo(() => catalogCostLookup(products, productCosts), [products, productCosts]);
  const managers = useMemo(() => Array.from(new Set(orders.map((o) => o.manager_name).filter(Boolean))).sort(), [orders]);
  const rowsFor = (m: string) =>
    buildMarginRows(
      orders.filter((o) => orderDay(o).startsWith(m) && (!manager || o.manager_name === manager)).sort((a, b) => orderDay(a).localeCompare(orderDay(b))),
      lines,
      costs,
      lookup,
    );
  const rows = useMemo(() => rowsFor(month), [orders, lines, costs, lookup, month, manager]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarize(rows), [rows]);
  const prevSummary = useMemo(() => summarize(rowsFor(prevMonth(month))), [orders, lines, costs, lookup, month, manager]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerOf = (o: Order) => (o.customer_id && customers.get(o.customer_id)) || "";
  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === "missing" && r.cost !== null) return false;
    if (filter === "costed" && r.cost === null) return false;
    if (filter === "low" && !(r.margin !== null && r.margin < 15)) return false;
    if (filter === "loss" && !((r.profit ?? 0) < 0)) return false;
    if (!q) return true;
    return [r.name, r.order.order_number, customerOf(r.order), r.order.manager_name].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const fillable = shown.filter((r) => r.cost === null && r.suggestion !== null && r.line);

  const save = async (r: MarginRow, total: number | null, source: OrderCost["source"] = "manual") => {
    setSaving((s) => new Set(s).add(r.key));
    try {
      if (total === null) {
        await deleteOne("order_costs", r.key);
        setCosts((m) => {
          const next = new Map(m);
          next.delete(r.key);
          return next;
        });
      } else {
        const doc: OrderCost = {
          id: r.key,
          order_id: r.order.id,
          total_cost: Math.round(total),
          unit_cost: r.quantity > 0 ? total / r.quantity : total,
          source,
          updated_by: auth.user?.email || "",
          updated_at: new Date().toISOString(),
        };
        await upsertOne("order_costs", r.key, doc);
        setCosts((m) => new Map(m).set(r.key, doc));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(r.key);
        return next;
      });
    }
  };

  const fillFromCatalog = async () => {
    setFilling(true);
    for (const r of fillable) await save(r, (r.suggestion || 0) * r.quantity, "catalog");
    setFilling(false);
  };

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; costedRevenue: number; costedQty: number; cost: number; missing: number }>();
    for (const r of rows) {
      const name = (r.line?.product_name || r.name).trim();
      const a = map.get(name.toLowerCase()) || { name, qty: 0, revenue: 0, costedRevenue: 0, costedQty: 0, cost: 0, missing: 0 };
      a.qty += r.quantity;
      a.revenue += r.revenue;
      if (r.cost === null) a.missing++;
      else {
        a.cost += r.cost;
        a.costedRevenue += r.revenue;
        a.costedQty += r.quantity;
      }
      map.set(name.toLowerCase(), a);
    }
    return [...map.values()].sort((x, y) => y.revenue - x.revenue);
  }, [rows]);

  const byManager = useMemo(() => {
    const map = new Map<string, MarginRow[]>();
    for (const r of rows) map.set(r.order.manager_name || "—", [...(map.get(r.order.manager_name || "—") || []), r]);
    return [...map.entries()].map(([name, rs]) => ({ name, ...summarize(rs) })).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const exportRows = () =>
    exportCsv(
      `marja-${month}`,
      ["Sana", "Buyurtma", "Mijoz", "Menejer", "Mahsulot", "Soni", "Sotuv (dona)", "Summa", "Tannarx (dona)", "Tannarx jami", "Foyda", "Marja %"],
      rows.map((r) => [
        orderDay(r.order),
        r.order.order_number || "",
        customerOf(r.order),
        r.order.manager_name || "",
        r.name,
        r.quantity,
        Math.round(r.unitPrice),
        Math.round(r.revenue),
        r.unitCost === null ? "" : Math.round(r.unitCost * 100) / 100,
        r.cost === null ? "" : Math.round(r.cost),
        r.profit === null ? "" : Math.round(r.profit),
        r.margin === null ? "" : Math.round(r.margin * 10) / 10,
      ]),
    );

  if (!allowed) {
    return (
      <div className="card flex items-center gap-3 p-6 text-sm text-ink-600">
        <Lock className="h-5 w-5 text-ink-400" /> Marja va tannarx faqat adminga ko'rinadi.
      </div>
    );
  }

  const coverage = summary.lines ? Math.round((summary.costedLines / summary.lines) * 100) : 0;
  let lastOrder = "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Marja</h1>
          <p className="text-sm text-ink-500">Har bir sotilgan mahsulotning tannarxi va foydasi · faqat admin ko'radi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" className="input w-auto" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Oy" />
          <select className="input w-auto" value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Menejer">
            <option value="">Barcha menejerlar</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={exportRows} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Aylanma" value={formatMoneyShort(summary.revenue)} hint={`${new Set(rows.map((r) => r.order.id)).size} buyurtma · ${summary.lines} qator`} tone="sky" icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Tannarx" value={formatMoneyShort(summary.cost)} hint={`kiritilgan: ${summary.costedLines} / ${summary.lines} qator`} tone="violet" icon={<Coins className="h-5 w-5" />} progress={coverage} progressLabel={`${coverage}% to'ldirilgan`} />
        <StatCard title="Yalpi foyda (marja)" value={formatMoneyShort(summary.profit)} hint="tannarxi kiritilgan qatorlardan" tone={summary.profit < 0 ? "rose" : "emerald"} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard
          title="O'rtacha marja"
          value={summary.margin === null ? "—" : `${summary.margin.toFixed(1)}%`}
          hint={prevSummary.margin === null ? `${monthLabel(prevMonth(month))}: —` : `${monthLabel(prevMonth(month))}: ${prevSummary.margin.toFixed(1)}%`}
          tone="brand"
          icon={<Percent className="h-5 w-5" />}
        />
        <StatCard
          title="Tannarxsiz"
          value={`${summary.missingLines} qator`}
          hint={summary.missingLines ? `${formatMoneyShort(summary.missingRevenue)} aylanma hisobga kirmadi` : "hammasi to'ldirilgan ✓"}
          tone={summary.missingLines ? "amber" : "emerald"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-ink-100 p-1">
          {(
            [
              ["orders", "Buyurtmalar bo'yicha"],
              ["products", "Mahsulotlar bo'yicha"],
              ["managers", "Menejerlar bo'yicha"],
            ] as [View, string][]
          ).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>
              {label}
            </button>
          ))}
        </div>
        {view === "orders" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex max-w-full gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-ink-100 p-1">
              {(
                [
                  ["all", `Hammasi (${rows.length})`],
                  ["missing", `Tannarxsiz (${summary.missingLines})`],
                  ["costed", `Kiritilgan (${summary.costedLines})`],
                  ["low", `Past marja <15% (${summary.lowMargin})`],
                  ...(summary.loss ? ([["loss", `Zarar (${summary.loss})`]] as [Filter, string][]) : []),
                ] as [Filter, string][]
              ).map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
              <input className="input w-56 pl-8" placeholder="Mahsulot, buyurtma, mijoz…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {view === "orders" && summary.loss > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>
            ⚠️ <b>{summary.loss} ta qatorda</b> tannarx sotuv summasidan katta (zarar). Ko'pincha jami summa "dona" katagiga yozilganda shunday bo'ladi — tekshirib
            chiqing.
          </span>
          <button className="btn-secondary" onClick={() => setFilter("loss")}>
            Ko'rsatish ({summary.loss})
          </button>
        </div>
      )}

      {view === "orders" && fillable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            💡 Ko'rinib turgan tannarxsiz qatorlardan <b>{fillable.length} tasi</b> uchun katalogda tannarx bor — bir bosishda to'ldirasiz, keyin kerakligini qo'lda
            o'zgartirasiz.
          </span>
          <button className="btn-primary" onClick={fillFromCatalog} disabled={filling}>
            <Wand2 className="h-4 w-4" /> {filling ? "To'ldirilmoqda…" : `Katalogdan to'ldirish (${fillable.length})`}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <AsyncState loading={loading} empty={!loading && rows.length === 0} emptyLabel={`${monthLabel(month)} oyida buyurtma yo'q`} emptyIcon={<Wallet className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            {view === "orders" && (
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60">
                  <tr>
                    <th className="table-th">Mahsulot</th>
                    <th className="table-th text-right">Soni</th>
                    <th className="table-th text-right">Sotuv (dona)</th>
                    <th className="table-th text-right">Summa</th>
                    <th className="table-th text-right">Tannarx (dona)</th>
                    <th className="table-th text-right">Tannarx jami</th>
                    <th className="table-th text-right">Foyda</th>
                    <th className="table-th text-right">Marja</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {shown.map((r) => {
                    const head =
                      r.order.id !== lastOrder ? (
                        <tr key={`h-${r.order.id}`} className="bg-ink-50/70">
                          <td colSpan={8} className="px-4 py-2 text-xs font-bold text-ink-700">
                            <Link to={`/orders/${r.order.id}`} className="hover:text-brand-700">
                              {r.order.order_number || "Buyurtma"}
                            </Link>{" "}
                            · {orderDay(r.order).slice(8, 10)}.{orderDay(r.order).slice(5, 7)} · {customerOf(r.order) || r.order.title || "—"}
                            {r.order.manager_name && <span className="font-medium text-ink-500"> · {r.order.manager_name}</span>}
                          </td>
                        </tr>
                      ) : null;
                    lastOrder = r.order.id;
                    return [
                      head,
                      <tr key={r.key} className={`border-b border-ink-100 ${(r.profit ?? 0) < 0 ? "bg-rose-50/70" : "hover:bg-ink-50/40"}`}>
                        <td className="table-td">
                          <div className="font-medium text-ink-800">{r.name}</div>
                          {!r.line && <div className="text-[11px] text-ink-400">qatorlarsiz buyurtma</div>}
                        </td>
                        <td className="table-td text-right">{num(r.quantity)}</td>
                        <td className="table-td text-right">{num(r.unitPrice, 2)}</td>
                        <td className="table-td text-right">{num(Math.round(r.revenue))}</td>
                        <td className="table-td text-right">
                          <CostInput
                            value={r.unitCost}
                            digits={2}
                            busy={saving.has(r.key)}
                            onSave={(v) => save(r, v === null ? null : v * r.quantity)}
                            label={`${r.name} tannarxi (dona)`}
                          />
                          {r.cost === null &&
                            (r.suggestion !== null ? (
                              <button className="mt-1 block w-full text-right text-[11px] font-semibold text-brand-600 hover:underline" onClick={() => save(r, (r.suggestion || 0) * r.quantity, "catalog")}>
                                katalog: {num(r.suggestion, 2)} → qo'yish
                              </button>
                            ) : (
                              r.line && <div className="mt-1 text-[11px] text-ink-400">katalogda yo'q</div>
                            ))}
                        </td>
                        <td className="table-td text-right">
                          <CostInput value={r.cost} busy={saving.has(r.key)} onSave={(v) => save(r, v)} label={`${r.name} tannarxi (jami)`} wide />
                        </td>
                        <td className={`table-td text-right font-semibold ${r.profit !== null && r.profit < 0 ? "text-rose-600" : "text-ink-800"}`}>{num(r.profit === null ? null : Math.round(r.profit))}</td>
                        <td className="table-td text-right">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${marginChip(r.margin)}`}>{r.margin === null ? "—" : `${r.margin.toFixed(1)}%`}</span>
                        </td>
                      </tr>,
                    ];
                  })}
                </tbody>
                {shown.length > 0 && (
                  <tfoot>
                    <FooterRow rows={shown} />
                  </tfoot>
                )}
              </table>
            )}

            {view === "products" && (
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60">
                  <tr>
                    <th className="table-th">Mahsulot</th>
                    <th className="table-th text-right">Sotildi</th>
                    <th className="table-th text-right">Aylanma</th>
                    <th className="table-th text-right">O'rt. narx</th>
                    <th className="table-th text-right">O'rt. tannarx</th>
                    <th className="table-th text-right">Foyda</th>
                    <th className="table-th text-right">Marja</th>
                    <th className="table-th text-right">Tannarxsiz</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {byProduct.map((p) => {
                    const profit = p.costedRevenue - p.cost;
                    const m = p.costedRevenue > 0 ? (profit / p.costedRevenue) * 100 : null;
                    return (
                      <tr key={p.name} className="border-b border-ink-100">
                        <td className="table-td font-medium text-ink-800">{p.name}</td>
                        <td className="table-td text-right">{num(p.qty)}</td>
                        <td className="table-td text-right">{formatMoneyShort(p.revenue)}</td>
                        <td className="table-td text-right">{num(p.qty ? p.revenue / p.qty : null, 1)}</td>
                        <td className="table-td text-right">{num(p.costedQty ? p.cost / p.costedQty : null, 1)}</td>
                        <td className="table-td text-right font-semibold">{p.costedRevenue ? formatMoneyShort(profit) : "—"}</td>
                        <td className="table-td text-right">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${marginChip(m)}`}>{m === null ? "—" : `${m.toFixed(1)}%`}</span>
                        </td>
                        <td className="table-td text-right text-xs text-amber-700">{p.missing ? `${p.missing} qator` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {view === "managers" && (
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60">
                  <tr>
                    <th className="table-th">Menejer</th>
                    <th className="table-th text-right">Aylanma</th>
                    <th className="table-th text-right">Tannarx</th>
                    <th className="table-th text-right">Yalpi foyda</th>
                    <th className="table-th text-right">Marja</th>
                    <th className="table-th text-right">Tannarxsiz</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {byManager.map((m) => (
                    <tr key={m.name} className="border-b border-ink-100">
                      <td className="table-td font-medium text-ink-800">{m.name}</td>
                      <td className="table-td text-right">{formatMoney(m.revenue)}</td>
                      <td className="table-td text-right">{formatMoney(m.cost)}</td>
                      <td className="table-td text-right font-semibold">{formatMoney(m.profit)}</td>
                      <td className="table-td text-right">
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${marginChip(m.margin)}`}>{m.margin === null ? "—" : `${m.margin.toFixed(1)}%`}</span>
                      </td>
                      <td className="table-td text-right text-xs text-amber-700">{m.missingLines ? `${m.missingLines} qator` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </AsyncState>
      </div>

      <p className="text-xs text-ink-500">
        Tannarxni dona uchun yoki jami summa bilan yozing — biri yozilsa, ikkinchisi hisoblanadi; Enter yoki boshqa joyni bosganda o'zi saqlanadi, o'chirsangiz
        tannarx olib tashlanadi. Buyurtmadagi umumiy chegirma qatorlarga summasiga qarab bo'linadi. Katalog tannarxi keyin o'zgarsa, kiritilganlari o'zgarmaydi.
      </p>
    </div>
  );
}

function FooterRow({ rows }: { rows: MarginRow[] }) {
  const s = summarize(rows);
  return (
    <tr className="bg-ink-50/70 font-bold tabular-nums">
      <td className="table-td">Jami (ko'rinib turgan)</td>
      <td className="table-td" />
      <td className="table-td" />
      <td className="table-td text-right">{num(Math.round(s.revenue))}</td>
      <td className="table-td" />
      <td className="table-td text-right">{num(Math.round(s.cost))}</td>
      <td className="table-td text-right">{num(Math.round(s.profit))}</td>
      <td className="table-td text-right">{s.margin === null ? "—" : `${s.margin.toFixed(1)}%`}</td>
    </tr>
  );
}

// A number box that saves on Enter / blur; empty removes the cost.
function CostInput({ value, onSave, busy, label, digits = 0, wide = false }: { value: number | null; onSave: (v: number | null) => void; busy: boolean; label: string; digits?: number; wide?: boolean }) {
  const shown = value === null ? "" : num(value, digits);
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    if (text === shown) return;
    const v = parseNum(text);
    if (Number.isNaN(v)) return setBad(true);
    setBad(false);
    onSave(v);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className={`${wide ? "w-28" : "w-24"} rounded-lg border px-2 py-1 text-right font-semibold tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
        bad ? "border-rose-400 bg-rose-50" : value === null ? "border-amber-300 bg-amber-50/60" : "border-ink-200 bg-white"
      } ${busy ? "opacity-60" : ""}`}
      value={text}
      placeholder="—"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setText(shown);
          setBad(false);
        }
      }}
    />
  );
}
