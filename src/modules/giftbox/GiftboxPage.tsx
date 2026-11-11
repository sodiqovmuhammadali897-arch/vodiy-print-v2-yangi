import { useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, Package, Save, Stamp, Trash2, TrendingUp } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import { DEFAULT_ROUND, priceFor, publicPrices, sortTiers, souvenirPrice, unitCost, type GiftboxPrint, type GiftboxSettings, type MarkupTier } from "../../lib/giftbox";

// Gift box va suvenir narxi: per item what it costs us and its logo print,
// the gift box markup and the souvenir markup by quantity
// (giftbox_settings/main). Saving also writes the managers' price table
// (giftbox_prices/main, lib/giftbox.ts). The manager types each box's name
// and market price on the order or the offer, or picks a souvenir.
const num = (v: string) => Number(String(v).replace(/\s/g, "")) || 0;

export default function GiftboxPage() {
  // «Ko'rish» only: the page shows the numbers, Saqlash is hidden.
  const canEdit = canGiftbox(useAuth(), "edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prints, setPrints] = useState<GiftboxPrint[]>([]);
  const [tiers, setTiers] = useState<MarkupTier[]>([]);
  const [svTiers, setSvTiers] = useState<MarkupTier[]>([]);
  const [round, setRound] = useState(DEFAULT_ROUND);
  const [example, setExample] = useState(170000);
  useEffect(() => {
    void (async () => {
      try {
        const settings = await getOne<GiftboxSettings>("giftbox_settings", "main");
        setPrints(settings?.prints?.length ? settings.prints : [{ name: "Ruchka", cost: 0 }, { name: "Koja bloknot", cost: 0 }, { name: "Bakal", cost: 0 }]);
        setTiers(settings?.tiers?.length ? settings.tiers : [{ min: 1, markup: 0 }, { min: 10, markup: 0 }, { min: 21, markup: 0 }, { min: 51, markup: 0 }]);
        setSvTiers(settings?.souvenir_tiers?.length ? settings.souvenir_tiers : [{ min: 1, markup: 0 }, { min: 50, markup: 0 }, { min: 200, markup: 0 }]);
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
  const cleanSv = useMemo(() => sortTiers(svTiers), [svTiers]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      const items = cleanPrints.map((p) => ({ name: p.name.trim(), cost: Number(p.cost) || 0, buy: Number(p.buy) || 0 }));
      await upsertOne("giftbox_settings", "main", { prints: items, tiers: cleanTiers, souvenir_tiers: cleanSv, round, updated_at: now });
      await upsertOne("giftbox_prices", "main", { ...publicPrices(items, cleanTiers, round, cleanSv), updated_at: now });
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
          <h1 className="font-display text-2xl font-bold text-ink-900">Gift box va suvenir narxi</h1>
          <p className="text-sm text-ink-500">Har bir narsa: tannarxi + logo urish. Gift box: bozordagi narx + ichidagi narsalar, ustiga gift box ustamasi. Alohida suvenir: narsa (+ logo), ustiga suvenir ustamasi. Menejer faqat tayyor narxni ko'radi.</p>
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

      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
          <Package className="h-4 w-4" /> Narsalar — tannarx va pechat
        </h2>
        <p className="mb-3 text-xs text-ink-500">Tannarxi — narsani o'zi necha pul turadi (biz sotib olamiz). Pechat — logo urish (UV). Gift box ichida o'zi bilan kelsa, tannarxiga 0 yozing.</p>
        <div className="hidden grid-cols-[28px_1fr_130px_130px_110px_36px] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500 sm:grid">
          <span />
          <span>Narsa</span>
          <span className="text-right">Tannarxi</span>
          <span className="text-right">Pechat</span>
          <span className="text-right">Jami</span>
          <span />
        </div>
        <div className="space-y-2">
          {prints.map((p, i) => {
            const set = (patch: Partial<GiftboxPrint>) => setPrints(prints.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="grid grid-cols-[28px_1fr_36px] items-center gap-2 sm:grid-cols-[28px_1fr_130px_130px_110px_36px]">
                <span className="text-right text-xs text-ink-400">{i + 1}.</span>
                <input className="input" placeholder="Narsa (koja bloknot, termos …)" value={p.name} onChange={(e) => set({ name: e.target.value })} />
                <button type="button" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-rose-600 sm:order-last" onClick={() => setPrints(prints.filter((_, j) => j !== i))} aria-label="O'chirish">
                  <Trash2 className="h-4 w-4" />
                </button>
                <input className="input col-start-2 text-right sm:col-start-auto" inputMode="numeric" placeholder="tannarxi" aria-label="Tannarxi" value={p.buy || ""} onChange={(e) => set({ buy: num(e.target.value) })} />
                <input className="input col-start-2 text-right sm:col-start-auto" inputMode="numeric" placeholder="pechat" aria-label="Pechat" value={p.cost || ""} onChange={(e) => set({ cost: num(e.target.value) })} />
                <span className="col-start-2 text-right text-sm font-semibold tabular-nums text-ink-900 sm:col-start-auto">{formatMoney((Number(p.buy) || 0) + (Number(p.cost) || 0))}</span>
              </div>
            );
          })}
        </div>
        <button type="button" className="mt-3 text-sm font-semibold text-brand-600" onClick={() => setPrints([...prints, { name: "", cost: 0, buy: 0 }])}>
          + Narsa qo'shish
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TiersCard title="Ustama — gift box" tiers={tiers} setTiers={setTiers}>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            Yaxlitlash
            <select className="input w-auto py-1.5" value={round} onChange={(e) => setRound(Number(e.target.value))}>
              <option value={1000}>1 000 so'm</option>
              <option value={500}>500 so'm</option>
              <option value={100}>100 so'm</option>
              <option value={0}>yo'q</option>
            </select>
          </label>
        </TiersCard>
        <TiersCard title="Ustama — alohida suvenir" tiers={svTiers} setTiers={setSvTiers} />
      </div>

      <ExampleCard prints={cleanPrints} tiers={cleanTiers} round={round} example={example} setExample={setExample} />
      <SouvenirTable prints={cleanPrints} tiers={cleanSv} round={round} />
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

// One markup table: «from N pieces +X%».
function TiersCard({ title, tiers, setTiers, children }: { title: string; tiers: MarkupTier[]; setTiers: (t: MarkupTier[]) => void; children?: React.ReactNode }) {
  const set = sortTiers(tiers).some((t) => t.markup > 0);
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
        <TrendingUp className="h-4 w-4" /> {title}
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
        {children}
      </div>
      {!set && <p className="mt-2 text-xs font-semibold text-amber-700">Foizlar hali 0 — menejerda narx tannarxga teng chiqadi. Foizlarni yozing.</p>}
    </section>
  );
}

// What a manager gets for each souvenir on its own, per quantity tier.
function SouvenirTable({ prints, tiers, round }: { prints: GiftboxPrint[]; tiers: MarkupTier[]; round: number }) {
  const table = publicPrices(prints, [], round, tiers);
  const rows = table.souvenir || [];
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-ink-900">
        <Stamp className="h-4 w-4" /> Alohida suvenir — menejerga chiqadigan narx (logo bilan)
      </h2>
      <p className="mb-3 text-xs text-ink-500">Buyurtmada kategoriya «Suvenir» → narsa → soni. Logosiz tanlansa — pechatsiz hisoblanadi.</p>
      {!rows.length ? (
        <div className="text-sm text-amber-700">Suvenir ustamasi qatorlari yo'q — narx chiqmaydi.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="py-1.5 pr-3">Narsa</th>
                <th className="py-1.5 pr-3 text-right">Tannarx</th>
                {rows.map((r, i) => (
                  <th key={r.min} className="py-1.5 pr-3 text-right">
                    {r.min}
                    {rows[i + 1] ? `–${rows[i + 1].min - 1}` : "+"} dona
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {prints.map((p) => (
                <tr key={p.name}>
                  <td className="py-1.5 pr-3 text-ink-800">{p.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink-500">{formatMoney((Number(p.buy) || 0) + (Number(p.cost) || 0))}</td>
                  {rows.map((r) => {
                    const v = souvenirPrice(table, r.min, { name: p.name, logo: true });
                    return (
                      <td key={r.min} className="py-1.5 pr-3 text-right font-semibold tabular-nums text-ink-900">
                        {v === null ? <span className="font-normal text-ink-400">—</span> : formatMoney(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
