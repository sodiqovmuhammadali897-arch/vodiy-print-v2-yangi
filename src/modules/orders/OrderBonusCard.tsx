import { useEffect, useMemo, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { deleteOne, getOne, listAll, listWhere, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import type { Manager, Order, OrderCost, OrderProduct } from "../../lib/types";
import { buildMarginRows, summarize } from "../../lib/margin";
import { DEFAULT_BONUS_SETTINGS, monthLabel, monthOf, so, suggestPct, type BonusSettings, type KpiMonth, type OrderBonus } from "../../lib/managerBonus";
import { formatMoney } from "../../lib/format";

// Buyurtma → "Menejer bonusi" (admin only): the order's margin from the
// costs typed on the Marja page, a suggested share by that margin, and the
// amount the admin settles on — it goes into the manager's bonus fund for
// the order's month (KPI va bonus page).

const norm = (s: string | null | undefined) => String(s || "").trim().toLowerCase();

export default function OrderBonusCard({ order, products }: { order: Order; products: OrderProduct[] }) {
  const { user, isAdmin, isManagerAccount } = useAuth();
  const allowed = isAdmin && !isManagerAccount;
  const [costs, setCosts] = useState<Map<string, OrderCost> | null>(null);
  const [saved, setSaved] = useState<OrderBonus | null>(null);
  const [settings, setSettings] = useState<BonusSettings>(DEFAULT_BONUS_SETTINGS);
  const [manager, setManager] = useState<Manager | null>(null);
  const [month, setMonth] = useState<KpiMonth | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const orderMonth = monthOf(order);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void (async () => {
      const [c, b, s, managers] = await Promise.all([
        listWhere<OrderCost>("order_costs", "order_id", order.id).catch(() => [] as OrderCost[]),
        getOne<OrderBonus>("order_bonuses", order.id).catch(() => null),
        getOne<BonusSettings & { id: string }>("kpi_settings", "bonus").catch(() => null),
        listAll<Manager>("managers").catch(() => [] as Manager[]),
      ]);
      if (cancelled) return;
      const m = managers.find((x) => x.id === order.manager_id) || managers.find((x) => norm(x.name) === norm(order.manager_name)) || null;
      setCosts(new Map(c.map((x) => [x.id, x])));
      setSaved(b);
      if (s) setSettings({ ...DEFAULT_BONUS_SETTINGS, ...s });
      setManager(m);
      setAmount(b ? String(b.amount) : "");
      if (m) setMonth(await getOne<KpiMonth>("kpi_months", `${orderMonth}_${m.id}`).catch(() => null));
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, order.id, order.manager_id, order.manager_name, orderMonth]);

  const summary = useMemo(() => (costs ? summarize(buildMarginRows([order], products, costs)) : null), [costs, order, products]);
  if (!allowed) return null;

  const total = Number(order.total_amount || 0);
  const margin = summary && summary.costedLines === summary.lines && summary.lines > 0 ? summary.margin : null;
  const partly = summary && summary.costedLines > 0 && summary.costedLines < summary.lines;
  const suggested = suggestPct(margin, settings.tiers);
  const pcts = Array.from(new Set(settings.tiers.map((t) => t.pct))).sort((a, b) => a - b);
  const value = Number(amount.replace(/\s/g, "")) || 0;
  const locked = !!month && month.status !== "open";

  const pick = (pct: number) => {
    setDone(false);
    setAmount(String(Math.round((total * pct) / 100 / 100) * 100));
  };

  const save = async () => {
    if (!manager) return setError("Buyurtmada menejer tanlanmagan yoki Managerlar ro'yxatida yo'q");
    setBusy(true);
    setError(null);
    try {
      if (!value) {
        await deleteOne("order_bonuses", order.id);
        setSaved(null);
      } else {
        const pct = total ? Math.round((value / total) * 1000) / 10 : null;
        const doc: OrderBonus = {
          id: order.id,
          order_id: order.id,
          manager_id: manager.id,
          manager_name: manager.name,
          amount: Math.round(value),
          pct,
          margin: margin === null ? null : Math.round(margin * 10) / 10,
          order_total: total,
          month: orderMonth,
          updated_by: (user?.email || "").toLowerCase(),
          updated_at: new Date().toISOString(),
        };
        await upsertOne("order_bonuses", order.id, doc);
        setSaved(doc);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-amber-500" />
        <h2 className="font-display text-base font-bold text-ink-900">Menejer bonusi</h2>
        <span className="text-xs text-ink-400">· faqat admin ko'radi</span>
      </div>
      {!summary ? (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Buyurtma summasi" value={formatMoney(total)} />
            <Stat label="Tannarx (Marja sahifasidan)" value={summary.costedLines ? formatMoney(summary.cost) : "kiritilmagan"} />
            <Stat
              label="Marja"
              value={margin === null ? "—" : `${margin.toFixed(0)}%`}
              hint={margin === null ? (partly ? `${summary.costedLines}/${summary.lines} qator tannarxi bor` : "tannarxni Marja sahifasida kiriting") : `${formatMoney(total - summary.cost)} foyda`}
              tone={margin === null ? undefined : margin >= 20 ? "good" : "low"}
            />
          </div>

          <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            {manager ? `${manager.name}ga ajratiladi` : "Menejerga ajratiladi"} · {monthLabel(orderMonth)} bonus fondiga
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pcts.map((p) => (
              <button
                key={p}
                type="button"
                disabled={locked}
                onClick={() => pick(p)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  value && Math.round((total * p) / 100 / 100) * 100 === value ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-700 hover:bg-ink-50"
                }`}
              >
                {p}%{p === suggested ? " · tavsiya" : ""}
              </button>
            ))}
            <span className="mx-1 text-sm text-ink-500">yoki summa:</span>
            <input
              className="input w-40 font-bold tabular-nums"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              disabled={locked}
              onChange={(e) => {
                setDone(false);
                setAmount(e.target.value.replace(/[^\d\s]/g, ""));
              }}
              aria-label="Bonus summasi"
            />
            <button type="button" className="btn-primary" disabled={busy || locked || (!value && !saved)} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!value && saved ? "Olib tashlash" : "Saqlash"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {locked
              ? `${monthLabel(orderMonth)} tasdiqlangan — bonusni o'zgartirib bo'lmaydi.`
              : saved
                ? `Saqlangan: ${so(saved.amount)}${saved.pct !== null ? ` (${saved.pct}%)` : ""}${done ? " ✓" : ""}`
                : suggested !== null
                  ? `Marja ${margin!.toFixed(0)}% — tavsiya ${suggested}%: ${so((total * suggested) / 100)}`
                  : "Tannarx kiritilmagan — summani qo'lda yozing."}
          </p>
          {error && <p className="mt-1 text-sm font-semibold text-rose-600">{error}</p>}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "low" }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`font-display text-xl font-extrabold tabular-nums ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "low" ? "text-amber-600 dark:text-amber-400" : "text-ink-900"}`}>{value}</div>
      {hint && <div className="text-xs text-ink-500">{hint}</div>}
    </div>
  );
}
