import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Gift, Image as ImageIcon, Save } from "lucide-react";
import { getOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { CompanySettings, Customer, Proposal, ProposalGiftbox } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import { offerNote, priceFor, printableItems, type GiftboxItem, type GiftboxType } from "../../lib/giftbox";
import GiftboxOfferPreview from "./GiftboxOfferPreview";
import { exportProposalPdf, exportProposalPng } from "./exportProposal";

// A gift box offer for a customer (the owner's request, 2026-11-10): the
// manager picks the box and its items, types the quantity and when it is
// ready; the price comes from «Gift box narxi» and the note writes itself.
// Saved as a proposal with `giftbox`, so it sits in the Tijorat taklifi list.

const genNumber = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `GB-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function GiftboxOfferEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const auth = useAuth();
  const canPrice = canGiftbox(auth, "edit");
  const previewRef = useRef<HTMLDivElement>(null);

  const [types, setTypes] = useState<GiftboxType[]>([]);
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
    giftbox: { type_id: "", type_name: "", items: [], quantity: 0, unit_price: 0, ready_in: "" },
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
          listAll<GiftboxType>("giftbox_types"),
          listAll<Customer>("customers", { orderBy: ["first_name", "asc"] }).catch(() => [] as Customer[]),
          getOne<CompanySettings>("company_settings", "main"),
        ]);
        setTypes(t);
        setCustomers(c);
        setCompany(cs);
        if (!isNew && id) {
          const data = await getOne<Proposal>("proposals", id);
          if (data?.giftbox) setProposal({ ...data, recipient_name: data.recipient_name || "" });
        }
      } catch (e) {
        setError(e instanceof Error ? `Ma'lumotlarni yuklab bo'lmadi: ${e.message}` : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
  }, [id, isNew]);

  const g = proposal.giftbox!;
  const type = types.find((t) => t.id === g.type_id) || null;
  const active = types.filter((t) => t.active !== false || t.id === g.type_id);
  const options = useMemo(
    () => (type ? Array.from(new Set([...type.items.map((i) => i.name), ...printableItems(type).map(cap)].map((n) => n.trim()).filter(Boolean))) : []),
    [type],
  );
  const tablePrice = type ? priceFor(type, g.quantity || 1, g.items) : null;

  // Every change goes through here: price, total and (until edited) the note.
  const apply = (patch: Partial<ProposalGiftbox>, opts: { manual?: boolean } = {}) =>
    setProposal((p) => {
      const next = { ...p.giftbox!, ...patch };
      const t = types.find((x) => x.id === next.type_id) || null;
      const manual = opts.manual ?? priceManual;
      if (!manual && t) next.unit_price = priceFor(t, next.quantity || 1, next.items) ?? 0;
      const total = Number(next.unit_price || 0) * Number(next.quantity || 0);
      return {
        ...p,
        giftbox: next,
        items: [{ name: `Gift box «${next.type_name}»`, unit: "dona", quantity: next.quantity, price: next.unit_price, total }],
        subtotal: total,
        total,
        note: noteTouched ? p.note : offerNote(next.items),
      };
    });

  const pickType = (typeId: string) => {
    const t = types.find((x) => x.id === typeId);
    if (!t) return;
    setPriceManual(false);
    apply({ type_id: t.id, type_name: t.name, items: t.items.map((i) => ({ ...i })) }, { manual: false });
  };
  const has = (n: string) => g.items.find((i) => same(i.name, n));
  const setItems = (items: GiftboxItem[]) => apply({ items });

  const save = async () => {
    if (!g.type_id) return setError("Gift box turini tanlang");
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
      const fileBase = `${proposal.number}-${proposal.recipient_name || "giftbox"}`.replace(/\s+/g, "-");
      if (format === "pdf") await exportProposalPdf(previewRef.current, fileBase);
      else await exportProposalPng(previewRef.current, fileBase);
    } finally {
      setExporting(false);
    }
  };

  if (!auth.can("proposals", "edit")) return <Navigate to="/proposals" replace />;
  const ready = Boolean(g.type_id && g.quantity > 0 && g.unit_price > 0);

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
            <p className="mt-1 text-sm text-ink-500">Mijozga PNG qilib yuboriladi. Narx «Gift box narxi» jadvalidan soniga qarab chiqadi.</p>

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

              <div className="sm:col-span-2">
                <label className="label">Gift box turi</label>
                <select className="input" value={g.type_id} onChange={(e) => pickType(e.target.value)}>
                  <option value="">— turini tanlang —</option>
                  {active.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {!types.length && <p className="mt-1 text-xs text-amber-700">Gift box turlari hali kiritilmagan — rahbar «Gift box narxi» sahifasida qo'shadi.</p>}
              </div>

              {type && (
                <div className="sm:col-span-2">
                  <label className="label">Ichida nimalar bor (1 box'da)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((n) => {
                      const it = has(n);
                      return (
                        <span key={n} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm ${it ? "border-violet-500 bg-surface text-ink-900" : "border-ink-200 text-ink-500"}`}>
                          <button type="button" onClick={() => setItems(it ? g.items.filter((x) => x !== it) : [...g.items, { name: n, qty: 1 }])}>
                            {it ? "☑" : "☐"} {n}
                          </button>
                          {it && (
                            <input
                              className="w-10 rounded border border-ink-200 bg-surface px-1 text-center text-xs"
                              inputMode="numeric"
                              aria-label={`${n} soni`}
                              value={it.qty}
                              onChange={(e) => setItems(g.items.map((x) => (x === it ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Soni</label>
                <input className="input" inputMode="numeric" value={g.quantity || ""} onChange={(e) => apply({ quantity: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
              </div>
              <div>
                <label className="label">Tayyor bo'ladi</label>
                <input className="input" placeholder="masalan: 5 kunda" value={g.ready_in} onChange={(e) => apply({ ready_in: e.target.value })} />
              </div>

              <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                {!type ? (
                  "Turini tanlang — narx o'zi chiqadi."
                ) : tablePrice === null && !priceManual ? (
                  <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar «Gift box narxi»da ustamani kiritsin.</span>
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
                {canPrice && type && (
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
            <button className="btn-primary" onClick={() => void save()} disabled={saving || !g.type_id}>
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
