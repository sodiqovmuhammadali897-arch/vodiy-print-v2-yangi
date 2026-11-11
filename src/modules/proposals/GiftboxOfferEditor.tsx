import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Gift, Image as ImageIcon, Save, Settings2 } from "lucide-react";
import { getOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { CompanySettings, Customer, Proposal, ProposalGiftbox } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import { offerNote, priceFor, type GiftboxItem, type GiftboxPrices } from "../../lib/giftbox";
import GiftboxOfferPreview from "./GiftboxOfferPreview";
import ItemsList from "../giftbox/ItemsList";
import { exportProposalPdf, exportProposalPng } from "./exportProposal";

// A gift box offer for a customer (the owner's request, 2026-11-10): the
// manager types the box's name and market price, ticks the items, types the
// quantity and when it is ready; the price comes from the owner's table
// («Gift box va suvenir narxi») and the note writes itself.
// Saved as a proposal with `giftbox`, so it sits in the Tijorat taklifi list.

const genNumber = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `GB-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};
const num = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;

export default function GiftboxOfferEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const auth = useAuth();
  const canPrice = canGiftbox(auth, "edit");
  const previewRef = useRef<HTMLDivElement>(null);

  const [prices, setPrices] = useState<GiftboxPrices | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [proposal, setProposal] = useState<Proposal>({
    id: "",
    number: genNumber(),
    customer_id: null,
    recipient_name: "",
    brand_id: null,
    title: "Gift box taklifi",
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    show_total: true,
    valid_until: null,
    note: "",
    created_at: new Date().toISOString(),
    giftbox: { name: "", box_cost: 0, items: [], quantity: 0, unit_price: 0, ready_in: "" },
  });
  // The note follows the items until the manager edits it by hand.
  const [noteTouched, setNoteTouched] = useState(!isNew);
  const [priceManual, setPriceManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [t, c, cs] = await Promise.all([
          getOne<GiftboxPrices>("giftbox_prices", "main").catch(() => null),
          listAll<Customer>("customers", { orderBy: ["first_name", "asc"] }).catch(() => [] as Customer[]),
          getOne<CompanySettings>("company_settings", "main"),
        ]);
        setPrices(t);
        setCustomers(c);
        setCompany(cs);
        if (!isNew && id) {
          const data = await getOne<Proposal>("proposals", id);
          if (data?.giftbox)
            setProposal({
              ...data,
              recipient_name: data.recipient_name || "",
              giftbox: { ...data.giftbox, name: data.giftbox.name || data.giftbox.type_name || "", box_cost: Number(data.giftbox.box_cost) || 0 },
            });
        }
      } catch (e) {
        setError(e instanceof Error ? `Ma'lumotlarni yuklab bo'lmadi: ${e.message}` : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
  }, [id, isNew]);

  const g = proposal.giftbox!;
  // Items with a print price, plus any already ticked.
  const options = useMemo(
    () => Array.from(new Set([...(prices?.names || []), ...g.items.map((i) => i.name)].map((n) => n.trim()).filter(Boolean))),
    [prices, g.items],
  );
  const tablePrice = g.box_cost > 0 ? priceFor(prices, g.quantity || 1, g.box_cost, g.items) : null;

  // Every change goes through here: price, total and (until edited) the note.
  const apply = (patch: Partial<ProposalGiftbox>, opts: { manual?: boolean } = {}) =>
    setProposal((p) => {
      const next = { ...p.giftbox!, ...patch };
      const manual = opts.manual ?? priceManual;
      if (!manual) next.unit_price = next.box_cost > 0 ? priceFor(prices, next.quantity || 1, next.box_cost, next.items) ?? 0 : 0;
      const total = Number(next.unit_price || 0) * Number(next.quantity || 0);
      return {
        ...p,
        giftbox: next,
        items: [{ name: `Gift box «${next.name.trim() || "—"}»`, unit: "dona", quantity: next.quantity, price: next.unit_price, total }],
        subtotal: total,
        total,
        note: noteTouched ? p.note : offerNote(next.items),
      };
    });

  const setItems = (items: GiftboxItem[]) => apply({ items });

  const save = async () => {
    if (!g.name.trim()) return setError("Gift box nomini yozing");
    setSaving(true);
    setError(null);
    const payload = JSON.parse(
      JSON.stringify({
        number: proposal.number,
        customer_id: proposal.customer_id,
        recipient_name: proposal.recipient_name,
        brand_id: null,
        title: proposal.title,
        items: proposal.items,
        subtotal: proposal.subtotal,
        discount: 0,
        total: proposal.total,
        show_total: true,
        valid_until: proposal.valid_until,
        note: proposal.note,
        giftbox: g,
      }),
    );
    try {
      if (isNew) {
        const created = await insertOne("proposals", payload);
        navigate(`/proposals/giftbox/${created.id}`, { replace: true });
      } else {
        await updateOne("proposals", proposal.id, payload);
        navigate("/proposals");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const doExport = async (format: "pdf" | "png") => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const fileBase = `${proposal.number}-${proposal.recipient_name || "giftbox"}`.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+$/, "");
      if (format === "pdf") await exportProposalPdf(previewRef.current, fileBase);
      else await exportProposalPng(previewRef.current, fileBase);
    } finally {
      setExporting(false);
    }
  };

  if (!auth.can("proposals", "edit")) return <Navigate to="/proposals" replace />;
  const ready = Boolean(g.name.trim() && g.quantity > 0 && g.unit_price > 0);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/proposals")} className="btn-ghost -ml-2">
        <ArrowLeft className="h-4 w-4" /> Takliflar
      </button>
      {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
              <Gift className="h-5 w-5 text-violet-600" /> Gift box taklifi
            </h2>
            <p className="mt-1 text-sm text-ink-500">Mijozga PNG qilib yuboriladi. Narx «Gift box va suvenir narxi» jadvalidan soniga qarab chiqadi.</p>
            {canGiftbox(auth, "view") && (
              // The owner: the way to the print prices and markup (managers never see this).
              <Link to="/giftbox" className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <Settings2 className="h-4 w-4" />
                {prices?.rows?.length ? "Pechat narxlari va ustamani o'zgartirish →" : "Avval pechat narxlari va ustamani kiriting →"}
                <span className="ml-auto text-xs font-normal opacity-75">faqat sizga ko'rinadi</span>
              </Link>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Mijoz ismi</label>
                <input
                  className="input"
                  list="giftbox-customers"
                  placeholder="Ro'yxatdan tanlang yoki qo'lda yozing..."
                  value={proposal.recipient_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const match = customers.find((c) => `${c.first_name} ${c.last_name}`.trim() === name.trim());
                    setProposal((p) => ({ ...p, recipient_name: name, customer_id: match ? match.id : null }));
                  }}
                />
                <datalist id="giftbox-customers">
                  {customers.map((c) => (
                    <option key={c.id} value={`${c.first_name} ${c.last_name}`.trim()} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label">Gift box nomi</label>
                <input className="input" placeholder="masalan: Qora koja to'plam" value={g.name} onChange={(e) => apply({ name: e.target.value })} />
              </div>
              <div>
                <label className="label">Bozordagi narxi (1 dona)</label>
                <input className="input text-right font-semibold" inputMode="numeric" placeholder="170 000" value={g.box_cost ? g.box_cost.toLocaleString("ru-RU") : ""} onChange={(e) => apply({ box_cost: num(e.target.value) })} />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Ichida nimalar bor (1 box'da)</label>
                {options.length ? (
                  <ItemsList options={options} items={g.items} onChange={setItems} />
                ) : (
                  <span className="text-xs text-amber-700">Narsalar ro'yxati bo'sh — rahbar «Gift box va suvenir narxi»da narsalarni kiritsin.</span>
                )}
              </div>

              <div>
                <label className="label">Soni</label>
                <input className="input" inputMode="numeric" value={g.quantity || ""} onChange={(e) => apply({ quantity: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
              </div>
              <div>
                <label className="label">Tayyor bo'ladi</label>
                <input className="input" placeholder="masalan: 5 kunda" value={g.ready_in} onChange={(e) => apply({ ready_in: e.target.value })} />
              </div>

              <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                {!prices?.rows?.length && !priceManual ? (
                  <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar «Gift box va suvenir narxi»da ustamani kiritsin.</span>
                ) : !g.box_cost && !priceManual ? (
                  "Bozordagi narxini yozing — narx o'zi chiqadi."
                ) : tablePrice === null && !priceManual ? (
                  <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar «Gift box va suvenir narxi»da ustamani kiritsin.</span>
                ) : (
                  <>
                    Narx: <b className="text-base">{formatMoney(g.unit_price)}</b> / dona
                    {g.quantity > 0 && (
                      <>
                        {" "}
                        · {g.quantity} dona jami <b className="text-base">{formatMoney(proposal.total)}</b>
                      </>
                    )}
                  </>
                )}
                {canPrice && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                    <span>Narxni qo'lda o'zgartirish (faqat sizga):</span>
                    <input
                      className="input w-32 py-1"
                      inputMode="numeric"
                      value={g.unit_price || ""}
                      onChange={(e) => {
                        setPriceManual(true);
                        apply({ unit_price: Number(e.target.value.replace(/\D/g, "")) || 0 }, { manual: true });
                      }}
                    />
                    {priceManual && (
                      <button
                        type="button"
                        className="text-brand-700 underline"
                        onClick={() => {
                          setPriceManual(false);
                          apply({}, { manual: false });
                        }}
                      >
                        jadval narxiga qaytarish
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Narx amal qiladi (ixtiyoriy)</label>
                <input type="date" className="input" value={proposal.valid_until || ""} onChange={(e) => setProposal((p) => ({ ...p, valid_until: e.target.value || null }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Izoh (o'zi yoziladi, o'zgartirsa bo'ladi)</label>
                <textarea
                  className="input min-h-[90px]"
                  value={proposal.note}
                  onChange={(e) => {
                    setNoteTouched(true);
                    setProposal((p) => ({ ...p, note: e.target.value }));
                  }}
                />
                {noteTouched && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-brand-700 underline"
                    onClick={() => {
                      setNoteTouched(false);
                      setProposal((p) => ({ ...p, note: offerNote(p.giftbox?.items || []) }));
                    }}
                  >
                    Izohni qaytadan yozish
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => void save()} disabled={saving || !g.name.trim()}>
              <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            <button className="btn-secondary" onClick={() => void doExport("png")} disabled={exporting || !ready}>
              <ImageIcon className="h-4 w-4" /> PNG
            </button>
            <button className="btn-secondary" onClick={() => void doExport("pdf")} disabled={exporting || !ready}>
              <FileDown className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Mijozga boradigan rasm (A4)</div>
          <div className="overflow-x-auto">
            <GiftboxOfferPreview ref={previewRef} proposal={proposal} company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}
