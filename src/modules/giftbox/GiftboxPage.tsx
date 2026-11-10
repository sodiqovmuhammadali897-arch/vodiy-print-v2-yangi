import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, Printer, Save, Trash2, TrendingUp } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import { DEFAULT_ROUND, priceFor, publicPrices, sortTiers, unitCost, type GiftboxPrint, type GiftboxSettings, type MarkupTier } from "../../lib/giftbox";

// Gift box narxi: the owner's print prices and markup by quantity
// (giftbox_settings/main). Saving also writes the managers' price table
// (giftbox_prices/main, lib/giftbox.ts). The manager types each box's name
// and market price on the order or the offer — there are no types here.
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
  const [example, setExample] = useState(170000);
  useEffect(() => {
    void (async () => {
      try {
        const settings = await getOne<GiftboxSettings>("giftbox_settings", "main");
        setPrints(settings?.prints?.length ? settings.prints : [{ name: "Ruchka", cost: 0 }, { name: "Koja bloknot", cost: 0 }, { name: "Bakal", cost: 0 }]);
        setTiers(settings?.tiers?.length ? settings.tiers : [{ min: 1, markup: 0 }, { min: 10, markup: 0 }, { min: 21, markup: 0 }, { min: 51, markup: 0 }]);
        setRound(settings?.round ?? DEFAULT_ROUND);
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
      await upsertOne("giftbox_prices", "main", { ...publicPrices(cleanPrints, cleanTiers, round), updated_at: now });
      setMessage("Saqlandi — menejerlar yangi narxlarni darhol ko'radi");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

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
          <p className="text-sm text-ink-500">Menejer gift box nomini, bozordagi narxini va ichidagi narsalarni yozadi. Tizim: tannarx = bozordagi narx + logo urish, narx = tannarx + ustama (soniga qarab). Menejer faqat tayyor narxni ko'radi.</p>
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

      <ExampleCard prints={cleanPrints} tiers={cleanTiers} round={round} example={example} setExample={setExample} />
      <p className="text-xs text-ink-500">O'zgarishlar «Saqlash» bosilganda kuchga kiradi. Oldin olingan buyurtmalarning narxi o'zgarmaydi.</p>
    </div>
  );
}

// «Misol»: what a manager would see for a box at this market price with
// every item inside — so the owner checks the numbers before saving.
function ExampleCard({ prints, tiers, round, example, setExample }: { prints: GiftboxPrint[]; tiers: MarkupTier[]; round: number; example: number; setExample: (v: number) => void }) {
  const items = prints.map((p) => ({ name: p.name, qty: 1 }));
  const cost = unitCost(example, items, prints);
  const table = publicPrices(prints, tiers, round);
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
        <Calculator className="h-4 w-4" /> Misol — tekshirib ko'ring
      </h2>
      <p className="mb-3 text-xs text-ink-500">Bozordagi narx shu bo'lsa va ichida hamma narsa bitta-bittadan bo'lsa, menejerga qancha chiqadi.</p>
      <label className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
        Bozordagi narxi
        <input className="input w-40 text-right font-semibold" inputMode="numeric" value={example || ""} onChange={(e) => setExample(num(e.target.value))} />
        so'm
      </label>
      <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-600">Tannarx (1 dona): {prints.map((p) => p.name).join(" + ") || "—"}</span>
          <b className="tabular-nums text-ink-900">{formatMoney(cost)}</b>
        </div>
        {table.rows.map((row, i) => {
          const next = table.rows[i + 1];
          const price = priceFor(table, row.min, example, items) || 0;
          return (
            <div key={row.min} className="flex justify-between text-ink-600">
              <span>
                {row.min}
                {next ? `–${next.min - 1}` : "+"} dona · +{tiers[i].markup}%
              </span>
              <span className="tabular-nums">
                {formatMoney(price)} <span className="text-emerald-700">(+{formatMoney(price - cost).replace(" so'm", "")})</span>
              </span>
            </div>
          );
        })}
        {!table.rows.length && <div className="text-amber-700">Ustama qatorlari yo'q — narx chiqmaydi.</div>}
      </div>
    </section>
  );
}
