import { useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Plus, Printer, Save, Trash2, TrendingUp } from "lucide-react";
import { getOne, listAll, upsertOne, deleteOne } from "../../lib/firestoreDb";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import {
  DEFAULT_ROUND,
  priceFor,
  priceTable,
  sortTiers,
  unitCost,
  type GiftboxCost,
  type GiftboxItem,
  type GiftboxPrint,
  type GiftboxSettings,
  type GiftboxType,
  type MarkupTier,
} from "../../lib/giftbox";

// Gift box narxi (admin only): print prices, the markup by quantity and
// the gift box types with their market price. Saving writes the owner's
// numbers to giftbox_settings / giftbox_costs and the managers' ready price
// tables to giftbox_types (lib/giftbox.ts).
type EditType = { id: string; name: string; box_cost: number; items: GiftboxItem[]; active: boolean; isNew?: boolean };
const newId = () => `gb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const num = (v: string) => Number(String(v).replace(/\s/g, "")) || 0;

export default function GiftboxPage() {
  // «Ko'rish» only: the page shows the numbers, Saqlash is hidden.
  const canEdit = canGiftbox(useAuth(), "edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prints, setPrints] = useState<GiftboxPrint[]>([]);
  const [tiers, setTiers] = useState<MarkupTier[]>([]);
  const [round, setRound] = useState(DEFAULT_ROUND);
  const [types, setTypes] = useState<EditType[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [settings, costs, typeDocs] = await Promise.all([
          getOne<GiftboxSettings>("giftbox_settings", "main"),
          listAll<GiftboxCost>("giftbox_costs"),
          listAll<GiftboxType>("giftbox_types"),
        ]);
        setPrints(settings?.prints?.length ? settings.prints : [{ name: "Ruchka", cost: 0 }, { name: "Koja bloknot", cost: 0 }, { name: "Bakal", cost: 0 }]);
        setTiers(settings?.tiers?.length ? settings.tiers : [{ min: 1, markup: 0 }, { min: 10, markup: 0 }, { min: 21, markup: 0 }, { min: 51, markup: 0 }]);
        setRound(settings?.round ?? DEFAULT_ROUND);
        const box = new Map(costs.map((c) => [c.id, Number(c.box_cost) || 0]));
        setTypes(typeDocs.map((t) => ({ id: t.id, name: t.name, box_cost: box.get(t.id) || 0, items: t.items || [], active: t.active !== false })));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Yuklab bo'lmadi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cleanPrints = useMemo(() => prints.filter((p) => p.name.trim()), [prints]);
  const cleanTiers = useMemo(() => sortTiers(tiers), [tiers]);
  const markupSet = cleanTiers.some((t) => t.markup > 0);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      await upsertOne("giftbox_settings", "main", { prints: cleanPrints, tiers: cleanTiers, round, updated_at: now });
      for (const t of types) {
        if (!t.name.trim()) continue;
        await upsertOne("giftbox_costs", t.id, { box_cost: t.box_cost, updated_at: now });
        await upsertOne("giftbox_types", t.id, {
          name: t.name.trim(),
          items: t.items.filter((i) => i.name.trim() && i.qty > 0),
          active: t.active,
          prices: priceTable(t.box_cost, cleanPrints, cleanTiers),
          round,
          updated_at: now,
        });
      }
      for (const id of removed) {
        await deleteOne("giftbox_types", id);
        await deleteOne("giftbox_costs", id);
      }
      setRemoved([]);
      setTypes((ts) => ts.map((t) => ({ ...t, isNew: false })));
      setMessage("Saqlandi — menejerlar yangi narxlarni darhol ko'radi");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const setType = (id: string, patch: Partial<EditType>) => setTypes((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  if (loading)
    return (
      <div className="flex justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Gift box narxi</h1>
          <p className="text-sm text-ink-500">Tannarx = bozordagi narx + logo urish. Narx = tannarx + ustama (soniga qarab). Menejer faqat tayyor narxni ko'radi.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
          </button>
        ) : (
          <span className="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">Faqat ko'rish</span>
        )}
      </div>
      {message && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
            <Printer className="h-4 w-4" /> Logo urish narxlari
          </h2>
          <p className="mb-3 text-xs text-ink-500">Bitta narsaga logo urish (UV) qancha turadi.</p>
          <div className="space-y-2">
            {prints.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                <input className="input" placeholder="Narsa (ruchka, bakal …)" value={p.name} onChange={(e) => setPrints(prints.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input text-right" inputMode="numeric" placeholder="so'm" value={p.cost || ""} onChange={(e) => setPrints(prints.map((x, j) => (j === i ? { ...x, cost: num(e.target.value) } : x)))} />
                <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-rose-600" onClick={() => setPrints(prints.filter((_, j) => j !== i))} aria-label="O'chirish">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 text-sm font-semibold text-brand-600" onClick={() => setPrints([...prints, { name: "", cost: 0 }])}>
            + Narsa qo'shish
          </button>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
            <TrendingUp className="h-4 w-4" /> Ustama — soniga qarab
          </h2>
          <p className="mb-3 text-xs text-ink-500">«Nechtadan boshlab» — shu sondan keyingi qatorgacha shu foiz qo'shiladi.</p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <input className="input text-right" inputMode="numeric" value={t.min || ""} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)))} />
                  donadan
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  +<input className="input text-right" inputMode="numeric" value={t.markup || ""} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, markup: num(e.target.value) } : x)))} />%
                </label>
                <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-rose-600" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="O'chirish">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setTiers([...tiers, { min: 0, markup: 0 }])}>
              + Qator qo'shish
            </button>
            <label className="flex items-center gap-2 text-sm text-ink-600">
              Yaxlitlash
              <select className="input w-auto py-1.5" value={round} onChange={(e) => setRound(Number(e.target.value))}>
                <option value={1000}>1 000 so'm</option>
                <option value={500}>500 so'm</option>
                <option value={100}>100 so'm</option>
                <option value={0}>yo'q</option>
              </select>
            </label>
          </div>
          {!markupSet && <p className="mt-2 text-xs font-semibold text-amber-700">Foizlar hali 0 — menejerda narx tannarxga teng chiqadi. Foizlarni yozing.</p>}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
            <Gift className="h-4 w-4" /> Gift box turlari
          </h2>
          <button type="button" className="btn-secondary" onClick={() => setTypes([...types, { id: newId(), name: "", box_cost: 0, items: [], active: true, isNew: true }])}>
            <Plus className="h-4 w-4" /> Tur qo'shish
          </button>
        </div>
        {!types.length && <div className="card p-6 text-sm text-ink-500">Hali tur yo'q. «Tur qo'shish» bilan masalan «Qora koja to'plam»ni qo'shing.</div>}
        <div className="grid gap-4 lg:grid-cols-2">
          {types.map((t) => {
            const cost = unitCost(t.box_cost, t.items, cleanPrints);
            const table = priceTable(t.box_cost, cleanPrints, cleanTiers);
            return (
              <div key={t.id} className={`card p-5 ${t.active ? "" : "opacity-60"}`}>
                <div className="grid grid-cols-[1fr_150px] gap-2">
                  <div>
                    <label className="label">Nomi</label>
                    <input className="input" placeholder="Qora koja to'plam" value={t.name} onChange={(e) => setType(t.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Bozordan narxi</label>
                    <input className="input text-right font-semibold" inputMode="numeric" value={t.box_cost || ""} onChange={(e) => setType(t.id, { box_cost: num(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Ichida logo uriladigan narsalar (odatda)</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {cleanPrints.map((p) => {
                    const it = t.items.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
                    return (
                      <span key={p.name} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${it ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 text-ink-600"}`}>
                        <button type="button" onClick={() => setType(t.id, { items: it ? t.items.filter((x) => x !== it) : [...t.items, { name: p.name, qty: 1 }] })}>
                          {it ? "☑" : "☐"} {p.name}
                        </button>
                        {it && (
                          <input
                            className="w-10 rounded border border-ink-200 bg-surface px-1 text-center text-xs"
                            inputMode="numeric"
                            value={it.qty}
                            onChange={(e) => setType(t.id, { items: t.items.map((x) => (x === it ? { ...x, qty: Math.max(1, num(e.target.value)) } : x)) })}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-600">Tannarx (1 dona)</span>
                    <b className="tabular-nums text-ink-900">{formatMoney(cost)}</b>
                  </div>
                  {table.map((row, i) => {
                    const next = table[i + 1];
                    const price = priceFor({ prices: [row], round }, row.min, t.items) || 0;
                    return (
                      <div key={row.min} className="flex justify-between text-ink-600">
                        <span>
                          {row.min}
                          {next ? `–${next.min - 1}` : "+"} dona · +{cleanTiers[i].markup}%
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(price)} <span className="text-emerald-700">(+{formatMoney(price - cost).replace(" so'm", "")})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-ink-600">
                    <input type="checkbox" checked={t.active} onChange={(e) => setType(t.id, { active: e.target.checked })} /> Menejerlarga ko'rinsin
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => {
                      if (!window.confirm("Bu turni o'chirasizmi?")) return;
                      setTypes(types.filter((x) => x.id !== t.id));
                      if (!t.isNew) setRemoved([...removed, t.id]);
                    }}
                  >
                    O'chirish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <p className="text-xs text-ink-500">O'zgarishlar «Saqlash» bosilganda kuchga kiradi. Oldin olingan buyurtmalarning narxi o'zgarmaydi.</p>
    </div>
  );
}
