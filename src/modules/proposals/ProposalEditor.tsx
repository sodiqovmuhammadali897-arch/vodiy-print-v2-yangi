import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileDown,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { getOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type {
  Brand,
  CompanySettings,
  Customer,
  Product,
  Proposal,
  ProposalItem,
} from "../../lib/types";
import { formatMoney } from "../../lib/format";
import ProposalPreview from "./ProposalPreview";
import { exportProposalPdf, exportProposalPng } from "./exportProposal";

const genNumber = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `TT-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}`;
};

const emptyItem = (): ProposalItem => ({
  name: "",
  unit: "dona",
  quantity: 1,
  price: 0,
  total: 0,
});

export default function ProposalEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const previewRef = useRef<HTMLDivElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [proposal, setProposal] = useState<Proposal>({
    id: "",
    number: genNumber(),
    customer_id: null,
    brand_id: null,
    title: "Tijorat taklifi",
    items: [emptyItem()],
    subtotal: 0,
    discount: 0,
    total: 0,
    valid_until: null,
    note: "",
    created_at: new Date().toISOString(),
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [c, b, pr, cs] = await Promise.all([
        listAll<Customer>("customers", { orderBy: ["first_name", "asc"] }),
        listAll<Brand>("brands", { orderBy: ["name", "asc"] }),
        listAll<Product>("products", { orderBy: ["name", "asc"] }),
        getOne<CompanySettings>("company_settings", "main"),
      ]);
      setCustomers(c);
      setBrands(b);
      setProducts(pr);
      setCompany(cs);

      if (!isNew && id) {
        const data = await getOne<Proposal>("proposals", id);
        if (data) {
          const items = Array.isArray(data.items)
            ? (data.items as ProposalItem[])
            : [];
          setProposal({ ...data, items });
        }
      }
    };
    void load();
  }, [id, isNew]);

  const linkedCustomer = useMemo(() => {
    if (proposal.customer_id) {
      return customers.find((c) => c.id === proposal.customer_id) || null;
    }
    if (proposal.brand_id) {
      const b = brands.find((x) => x.id === proposal.brand_id);
      if (b) return customers.find((c) => c.id === b.customer_id) || null;
    }
    return null;
  }, [customers, brands, proposal]);
  const linkedBrand = useMemo(
    () => brands.find((b) => b.id === proposal.brand_id) || null,
    [brands, proposal.brand_id],
  );

  const setItem = (index: number, patch: Partial<ProposalItem>) => {
    setProposal((p) => {
      const items = p.items.map((it, i) =>
        i === index
          ? {
              ...it,
              ...patch,
              total:
                Number(patch.quantity ?? it.quantity) *
                Number(patch.price ?? it.price),
            }
          : it,
      );
      return recompute({ ...p, items });
    });
  };

  const recompute = (p: Proposal): Proposal => {
    const subtotal = p.items.reduce(
      (s, it) => s + Number(it.quantity || 0) * Number(it.price || 0),
      0,
    );
    const total = Math.max(0, subtotal - Number(p.discount || 0));
    return { ...p, subtotal, total };
  };

  const addItem = () =>
    setProposal((p) => recompute({ ...p, items: [...p.items, emptyItem()] }));
  const removeItem = (i: number) =>
    setProposal((p) =>
      recompute({ ...p, items: p.items.filter((_, idx) => idx !== i) }),
    );

  const pickProduct = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setItem(index, {
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit,
      price: Number(prod.base_price),
    });
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      number: proposal.number,
      customer_id: proposal.customer_id,
      brand_id: proposal.brand_id,
      title: proposal.title,
      items: proposal.items,
      subtotal: proposal.subtotal,
      discount: proposal.discount,
      total: proposal.total,
      valid_until: proposal.valid_until,
      note: proposal.note,
    };
    try {
      if (isNew) {
        const created = await insertOne("proposals", payload);
        setSaving(false);
        navigate(`/proposals/${created.id}`, { replace: true });
      } else {
        await updateOne("proposals", proposal.id, payload);
        setSaving(false);
        navigate("/proposals");
      }
    } catch (e) {
      setSaving(false);
      alert(e instanceof Error ? e.message : "Xatolik");
    }
  };

  const doExport = async (format: "pdf" | "png") => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const fileBase = `${proposal.number}${
        linkedCustomer ? "-" + linkedCustomer.first_name : ""
      }`.replace(/\s+/g, "-");
      if (format === "pdf") {
        await exportProposalPdf(previewRef.current, fileBase);
      } else {
        await exportProposalPng(previewRef.current, fileBase);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/proposals")} className="btn-ghost -ml-2">
        <ArrowLeft className="h-4 w-4" /> Takliflar
      </button>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display text-base font-bold text-ink-900">
              Asosiy ma'lumotlar
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Raqam</label>
                <input
                  className="input"
                  value={proposal.number}
                  onChange={(e) =>
                    setProposal((p) => ({ ...p, number: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Sarlavha</label>
                <input
                  className="input"
                  value={proposal.title}
                  onChange={(e) =>
                    setProposal((p) => ({ ...p, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Mijoz</label>
                <select
                  className="input"
                  value={proposal.customer_id || ""}
                  onChange={(e) =>
                    setProposal((p) => ({
                      ...p,
                      customer_id: e.target.value || null,
                    }))
                  }
                >
                  <option value="">-- tanlang --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.company ? ` (${c.company})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Brend</label>
                <select
                  className="input"
                  value={proposal.brand_id || ""}
                  onChange={(e) => {
                    const brand_id = e.target.value || null;
                    const b = brands.find((x) => x.id === brand_id);
                    setProposal((p) => ({
                      ...p,
                      brand_id,
                      customer_id: b ? b.customer_id : p.customer_id,
                    }));
                  }}
                >
                  <option value="">-- tanlang --</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amal qilish sanasi</label>
                <input
                  type="date"
                  className="input"
                  value={proposal.valid_until || ""}
                  onChange={(e) =>
                    setProposal((p) => ({
                      ...p,
                      valid_until: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Chegirma (so'm)</label>
                <input
                  type="number"
                  className="input"
                  value={proposal.discount || ""}
                  onChange={(e) =>
                    setProposal((p) =>
                      recompute({ ...p, discount: Number(e.target.value) || 0 }),
                    )
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Izoh</label>
                <textarea
                  className="input min-h-[70px]"
                  value={proposal.note}
                  onChange={(e) =>
                    setProposal((p) => ({ ...p, note: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink-900">
                Mahsulotlar
              </h2>
              <button className="btn-secondary" onClick={addItem}>
                <Plus className="h-4 w-4" /> Qator qo'shish
              </button>
            </div>
            <div className="space-y-3">
              {proposal.items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-3"
                >
                  <div className="col-span-12 md:col-span-4">
                    <label className="label">Mahsulot</label>
                    <input
                      className="input"
                      list={`products-list-${i}`}
                      value={it.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = products.find((p) => p.name === val);
                        if (found) {
                          pickProduct(i, found.id);
                        } else {
                          setItem(i, { name: val, product_id: undefined });
                        }
                      }}
                    />
                    <datalist id={`products-list-${i}`}>
                      {products.map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="label">O'lchov</label>
                    <input
                      className="input"
                      value={it.unit}
                      onChange={(e) => setItem(i, { unit: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="label">Miqdor</label>
                    <input
                      type="number"
                      className="input"
                      value={it.quantity}
                      onChange={(e) =>
                        setItem(i, { quantity: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <label className="label">Narxi</label>
                    <input
                      type="number"
                      className="input"
                      value={it.price}
                      onChange={(e) =>
                        setItem(i, { price: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                    <button
                      className="btn-ghost text-rose-600 hover:bg-rose-50"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs font-semibold text-ink-600">
                    Jami: {formatMoney(it.total)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col items-end gap-1 border-t border-ink-100 pt-4 text-sm">
              <div className="text-ink-500">
                Oraliq: <span className="font-semibold text-ink-800">{formatMoney(proposal.subtotal)}</span>
              </div>
              <div className="text-ink-500">
                Chegirma: <span className="font-semibold text-rose-600">-{formatMoney(proposal.discount)}</span>
              </div>
              <div className="text-lg font-bold text-ink-900">
                Umumiy: {formatMoney(proposal.total)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => doExport("pdf")}
              disabled={exporting}
            >
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button
              className="btn-secondary"
              onClick={() => doExport("png")}
              disabled={exporting}
            >
              <ImageIcon className="h-4 w-4" /> PNG
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Ko'rinishi (A4)
          </div>
          <div className="overflow-x-auto">
            <ProposalPreview
              ref={previewRef}
              proposal={proposal}
              company={company}
              customer={linkedCustomer}
              brand={linkedBrand}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
