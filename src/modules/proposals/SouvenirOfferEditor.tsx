import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Image as ImageIcon, Plus, Save, Settings2, Stamp, Trash2 } from "lucide-react";
import { getOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { CompanySettings, Customer, Proposal, ProposalSouvenir } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";
import { souvenirNote, souvenirPrice, type GiftboxPrices } from "../../lib/giftbox";
import SouvenirOfferPreview from "./SouvenirOfferPreview";
import { exportProposalPdf, exportProposalPng } from "./exportProposal";

// A souvenir offer for a customer (the owner's request, 2026-11-11): the
// manager adds souvenirs (item, logo or not, how many) and when it is ready;
// each price comes from the owner's souvenir table («Gift box va suvenir
// narxi») and the note writes itself. Saved as a proposal with `souvenir`,
// so it sits in the Tijorat taklifi list.

type Row = ProposalSouvenir["rows"][number];
const genNumber = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `SV-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};
const num = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;
const emptyRow = (): Row => ({ name: "", logo: true, qty: 0, unit_price: 0 });

export default function SouvenirOfferEditor() {
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
    title: "Suvenir taklifi",
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    show_total: true,
    valid_until: null,
    note: "",
    created_at: new Date().toISOString(),
    souvenir: { rows: [emptyRow()], ready_in: "" },
  });
  const [noteTouched, setNoteTouched] = useState(!isNew);
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
          if (data?.souvenir) setProposal({ ...data, recipient_name: data.recipient_name || "" });
        }
      } catch (e) {
        setError(e instanceof Error ? `Ma'lumotlarni yuklab bo'lmadi: ${e.message}` : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
  }, [id, isNew]);

  const sv = proposal.souvenir!;
  const names = prices?.names || [];
  const priced = Boolean(prices?.souvenir?.length);

  // Every change goes through here: prices, totals and (until edited) the note.
  const apply = (patch: Partial<ProposalSouvenir>) =>
    setProposal((p) => {
      const next = { ...p.souvenir!, ...patch };
      next.rows = next.rows.map((r) => (r.manual || !r.name ? r : { ...r, unit_price: souvenirPrice(prices, r.qty || 1, r) ?? 0 }));
      const filled = next.rows.filter((r) => r.name && r.qty > 0);
      const total = filled.reduce((s, r) => s + r.unit_price * r.qty, 0);
      return {
        ...p,
        souvenir: next,
        items: filled.map((r) => ({ name: `${r.name}${r.logo ? " (logo bilan)" : ""}`, unit: "dona", quantity: r.qty, price: r.unit_price, total: r.unit_price * r.qty })),
        subtotal: total,
        total,
        note: noteTouched ? p.note : souvenirNote(next.rows),
      };
    });
  const setRow = (i: number, patch: Partial<Row>) => apply({ rows: sv.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const save = async () => {
    if (!sv.rows.some((r) => r.name && r.qty > 0)) return setError("Kamida bitta suvenir va sonini yozing");
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
        souvenir: { ...sv, rows: sv.rows.filter((r) => r.name) },
      }),
    );
    try {
      if (isNew) {
        const created = await insertOne("proposals", payload);
        navigate(`/proposals/suvenir/${created.id}`, { replace: true });
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
      const fileBase = `${proposal.number}-${proposal.recipient_name || "suvenir"}`.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+$/, "");
      if (format === "pdf") await exportProposalPdf(previewRef.current, fileBase);
      else await exportProposalPng(previewRef.current, fileBase);
    } finally {
      setExporting(false);
    }
  };

  if (!auth.can("proposals", "edit")) return <Navigate to="/proposals" replace />;
  const filled = sv.rows.filter((r) => r.name && r.qty > 0);
  const ready = filled.length > 0 && filled.every((r) => r.unit_price > 0);

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
              <Stamp className="h-5 w-5 text-teal-700" /> Suvenir taklifi
            </h2>
            <p className="mt-1 text-sm text-ink-500">Mijozga PNG qilib yuboriladi. Har bir suvenir narxi soniga qarab o'zi chiqadi.</p>
            {canGiftbox(auth, "view") && (
              <Link to="/giftbox" className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <Settings2 className="h-4 w-4" />
                {priced ? "Tannarx va suvenir ustamasini o'zgartirish →" : "Avval tannarx va suvenir ustamasini kiriting →"}
                <span className="ml-auto text-xs font-normal opacity-75">faqat sizga ko'rinadi</span>
              </Link>
            )}

            <div className="mt-4">
              <label className="label">Mijoz ismi</label>
              <input
                className="input"
                list="souvenir-customers"
                placeholder="Ro'yxatdan tanlang yoki qo'lda yozing..."
                value={proposal.recipient_name}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = customers.find((c) => `${c.first_name} ${c.last_name}`.trim() === name.trim());
                  setProposal((p) => ({ ...p, recipient_name: name, customer_id: match ? match.id : null }));
                }}
              />
              <datalist id="souvenir-customers">
                {customers.map((c) => (
                  <option key={c.id} value={`${c.first_name} ${c.last_name}`.trim()} />
                ))}
              </datalist>
            </div>

            <div className="mt-4">
              <label className="label">Suvenirlar</label>
              <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
                {sv.rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[22px_minmax(150px,1fr)_auto_72px_96px_28px]">
                    <span className="text-right text-xs text-ink-400">{i + 1}.</span>
                    <select className="input py-1.5" value={r.name} onChange={(e) => setRow(i, { name: e.target.value, manual: false })}>
                      <option value="">— suvenirni tanlang —</option>
                      {Array.from(new Set([...names, ...(r.name ? [r.name] : [])])).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-rose-600 sm:order-last" onClick={() => apply({ rows: sv.rows.filter((_, j) => j !== i) })} aria-label="O'chirish">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <label className="col-start-2 flex items-center gap-1.5 text-sm text-ink-700 sm:col-start-auto">
                      <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={r.logo} onChange={(e) => setRow(i, { logo: e.target.checked, manual: false })} />
                      logo
                    </label>
                    <input className="input col-start-2 py-1.5 sm:col-start-auto" inputMode="numeric" placeholder="soni" aria-label="Soni" value={r.qty || ""} onChange={(e) => setRow(i, { qty: num(e.target.value) })} />
                    {canPrice ? (
                      <input
                        className="input col-start-2 py-1.5 text-right font-semibold sm:col-start-auto"
                        inputMode="numeric"
                        aria-label="Dona narxi"
                        title="Narxni qo'lda o'zgartirish (faqat sizga)"
                        value={r.unit_price || ""}
                        onChange={(e) => setRow(i, { unit_price: num(e.target.value), manual: true })}
                      />
                    ) : (
                      <span className="col-start-2 text-right text-sm font-semibold tabular-nums text-ink-900 sm:col-start-auto">
                        {r.name ? (r.unit_price ? formatMoney(r.unit_price) : <span className="text-xs font-normal text-amber-700">narx yo'q</span>) : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600" onClick={() => apply({ rows: [...sv.rows, emptyRow()] })}>
                <Plus className="h-4 w-4" /> Suvenir qo'shish
              </button>
              {!priced && <p className="mt-1 text-xs font-semibold text-amber-700">Narx hali sozlanmagan — rahbar «Gift box va suvenir narxi»da tannarx va suvenir ustamasini kiritsin.</p>}
            </div>

            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
              Jami: <b className="text-base">{formatMoney(proposal.total)}</b>
              {filled.length > 0 && <span className="text-emerald-800"> · {filled.length} xil suvenir</span>}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Tayyor bo'ladi</label>
                <input className="input" placeholder="masalan: 5 kunda" value={sv.ready_in} onChange={(e) => apply({ ready_in: e.target.value })} />
              </div>
              <div>
                <label className="label">Narx amal qiladi (ixtiyoriy)</label>
                <input type="date" className="input" value={proposal.valid_until || ""} onChange={(e) => setProposal((p) => ({ ...p, valid_until: e.target.value || null }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Izoh (o'zi yoziladi, o'zgartirsa bo'ladi)</label>
                <textarea
                  className="input min-h-[80px]"
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
                      setProposal((p) => ({ ...p, note: souvenirNote(p.souvenir?.rows || []) }));
                    }}
                  >
                    Izohni qaytadan yozish
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => void save()} disabled={saving}>
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
            <SouvenirOfferPreview ref={previewRef} proposal={proposal} company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}
