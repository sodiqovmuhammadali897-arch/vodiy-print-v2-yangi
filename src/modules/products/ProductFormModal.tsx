import { useEffect, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { getOne, insertOne, updateOne, upsertOne } from "../../lib/firestoreDb";
import { PRODUCT_CATEGORIES, TEXTILE_COLORS, TEXTILE_SIZES } from "../../lib/orderConstants";
import { sortTiers } from "../../lib/priceTiers";
import type { Product, ProductCost } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  duplicateFrom?: Product | null;
  allProducts: Product[];
  onSaved: () => void;
};

type TierRow = { min_qty: number; price: number; cost_price: number };

const emptyTiers: TierRow[] = [{ min_qty: 1, price: 0, cost_price: 0 }];

type FormState = {
  name: string;
  category: string;
  unit: string;
  productCode: string;
  imageUrl: string;
  minOrderQty: number;
  leadTimeDays: number;
  isActive: boolean;
  sizeSpec: string;
  material: string;
  printType: string;
  paperWeight: string;
  lamination: string;
  packaging: string;
  specNote: string;
  sizes: string[];
  colors: string[];
  description: string;
  advantages: string;
  recommendedFor: string;
  salesNotes: string;
  managerTip: string;
  upsellIds: string[];
};

const emptyForm = (): FormState => ({
  name: "",
  category: PRODUCT_CATEGORIES[0],
  unit: "dona",
  productCode: "",
  imageUrl: "",
  minOrderQty: 0,
  leadTimeDays: 0,
  isActive: true,
  sizeSpec: "",
  material: "",
  printType: "",
  paperWeight: "",
  lamination: "",
  packaging: "",
  specNote: "",
  sizes: [],
  colors: [],
  description: "",
  advantages: "",
  recommendedFor: "",
  salesNotes: "",
  managerTip: "",
  upsellIds: [],
});

const TABS = ["Asosiy", "Xususiyat", "Narx", "Tavsif"] as const;
type Tab = (typeof TABS)[number];

export default function ProductFormModal({
  open,
  onClose,
  product,
  duplicateFrom,
  allProducts,
  onSaved,
}: Props) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("Asosiy");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [tiers, setTiers] = useState<TierRow[]>(emptyTiers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTextile = form.category === "Textil";

  useEffect(() => {
    if (!open) return;
    setTab("Asosiy");
    setError(null);
    const source = product || duplicateFrom || null;

    if (source) {
      setForm({
        name: product ? source.name : `${source.name} (nusxa)`,
        category: source.category || PRODUCT_CATEGORIES[0],
        unit: source.unit || "dona",
        productCode: product ? source.product_code || "" : "",
        imageUrl: source.image_url || "",
        minOrderQty: source.min_order_qty || 0,
        leadTimeDays: source.lead_time_days || 0,
        isActive: source.is_active !== false,
        sizeSpec: source.size_spec || "",
        material: source.material || "",
        printType: source.print_type || "",
        paperWeight: source.paper_weight || "",
        lamination: source.lamination || "",
        packaging: source.packaging || "",
        specNote: source.spec_note || "",
        sizes: source.sizes || [],
        colors: source.colors || [],
        description: source.description || "",
        advantages: (source.advantages || []).join("\n"),
        recommendedFor: (source.recommended_for || []).join("\n"),
        salesNotes: source.sales_notes || "",
        managerTip: source.manager_tip || "",
        upsellIds: source.upsell_product_ids || [],
      });

      const priceTiers = source.price_tiers?.length ? source.price_tiers : [{ min_qty: 1, price: 0 }];
      if (isAdmin && product) {
        void getOne<ProductCost>("product_costs", product.id).then((c) => {
          const costByQty = new Map((c?.cost_tiers || []).map((t) => [t.min_qty, t.cost_price]));
          setTiers(
            priceTiers.map((t) => ({
              min_qty: t.min_qty,
              price: t.price,
              cost_price: costByQty.get(t.min_qty) ?? 0,
            })),
          );
        });
      } else {
        setTiers(priceTiers.map((t) => ({ ...t, cost_price: 0 })));
      }
    } else {
      setForm(emptyForm());
      setTiers(emptyTiers);
    }
  }, [product, duplicateFrom, open, isAdmin]);

  const toggleSize = (size: string) =>
    setForm((f) => ({ ...f, sizes: f.sizes.includes(size) ? f.sizes.filter((x) => x !== size) : [...f.sizes, size] }));
  const toggleColor = (color: string) =>
    setForm((f) => ({
      ...f,
      colors: f.colors.includes(color) ? f.colors.filter((x) => x !== color) : [...f.colors, color],
    }));
  const toggleUpsell = (id: string) =>
    setForm((f) => ({
      ...f,
      upsellIds: f.upsellIds.includes(id) ? f.upsellIds.filter((x) => x !== id) : [...f.upsellIds, id],
    }));

  const updateTier = (i: number, patch: Partial<TierRow>) =>
    setTiers((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addTier = () => setTiers((t) => [...t, { min_qty: 0, price: 0, cost_price: 0 }]);
  const removeTier = (i: number) => setTiers((t) => (t.length === 1 ? t : t.filter((_, idx) => idx !== i)));

  const submit = async () => {
    if (!form.name.trim()) {
      setTab("Asosiy");
      return setError("Mahsulot nomi kiritilishi shart");
    }
    const validRows = sortTiers(tiers.filter((t) => t.min_qty > 0 && t.price >= 0));
    if (validRows.length === 0) {
      setTab("Narx");
      return setError("Kamida bitta narx pog'onasi to'g'ri kiritilishi kerak");
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        price_tiers: validRows.map(({ min_qty, price }) => ({ min_qty, price })),
        base_price: validRows[0].price,
        sizes: isTextile ? form.sizes : [],
        colors: isTextile ? form.colors : [],
        product_code: form.productCode.trim(),
        image_url: form.imageUrl.trim(),
        min_order_qty: form.minOrderQty,
        lead_time_days: form.leadTimeDays,
        is_active: form.isActive,
        size_spec: form.sizeSpec.trim(),
        material: form.material.trim(),
        print_type: form.printType.trim(),
        paper_weight: form.paperWeight.trim(),
        lamination: form.lamination.trim(),
        packaging: form.packaging.trim(),
        spec_note: form.specNote.trim(),
        description: form.description.trim(),
        advantages: form.advantages.split("\n").map((s) => s.trim()).filter(Boolean),
        recommended_for: form.recommendedFor.split("\n").map((s) => s.trim()).filter(Boolean),
        sales_notes: form.salesNotes.trim(),
        manager_tip: form.managerTip.trim(),
        upsell_product_ids: form.upsellIds,
      };
      let productId = product?.id;
      if (product) {
        await updateOne("products", product.id, payload);
      } else {
        const created = await insertOne("products", payload);
        productId = created.id;
      }
      if (isAdmin && productId) {
        await upsertOne("product_costs", productId, {
          cost_tiers: validRows.map(({ min_qty, cost_price }) => ({ min_qty, cost_price })),
          updated_at: new Date().toISOString(),
        });
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Mahsulotni tahrirlash" : duplicateFrom ? "Nusxadan yangi mahsulot" : "Yangi mahsulot"}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="mb-4 flex gap-1 border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Asosiy" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="label">Mahsulot nomi *</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">O'lchov birligi</label>
            <input className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mahsulot turi</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mahsulot kodi</label>
            <input
              className="input"
              placeholder="VP-FLY-01"
              value={form.productCode}
              onChange={(e) => setForm((f) => ({ ...f, productCode: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Rasm URL</label>
            <input
              className="input"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Minimal tiraj</label>
            <input
              type="number"
              className="input"
              value={form.minOrderQty || ""}
              onChange={(e) => setForm((f) => ({ ...f, minOrderQty: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="label">Tayyor bo'lish muddati (kun)</label>
            <input
              type="number"
              className="input"
              value={form.leadTimeDays || ""}
              onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex items-end md:col-span-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Faol — mahsulotlar ro'yxatida "Faol" sifatida ko'rinadi
            </label>
          </div>
        </div>
      )}

      {tab === "Xususiyat" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">O'lcham</label>
              <input
                className="input"
                placeholder="A5 (148x210mm)"
                value={form.sizeSpec}
                onChange={(e) => setForm((f) => ({ ...f, sizeSpec: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Material</label>
              <input className="input" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} />
            </div>
            <div>
              <label className="label">Bosma turi</label>
              <input
                className="input"
                placeholder="4+0 rangli (bir tomonlama)"
                value={form.printType}
                onChange={(e) => setForm((f) => ({ ...f, printType: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Qog'oz qalinligi</label>
              <input
                className="input"
                placeholder="130 gr"
                value={form.paperWeight}
                onChange={(e) => setForm((f) => ({ ...f, paperWeight: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Laminatsiya</label>
              <input className="input" value={form.lamination} onChange={(e) => setForm((f) => ({ ...f, lamination: e.target.value }))} />
            </div>
            <div>
              <label className="label">Qadoqlash</label>
              <input className="input" value={form.packaging} onChange={(e) => setForm((f) => ({ ...f, packaging: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Izoh</label>
            <textarea
              className="input min-h-[60px]"
              value={form.specNote}
              onChange={(e) => setForm((f) => ({ ...f, specNote: e.target.value }))}
            />
          </div>

          {isTextile && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">Razmerlar</label>
                <div className="flex flex-wrap gap-1.5">
                  {TEXTILE_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={`chip ${form.sizes.includes(s) ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Ranglar</label>
                <div className="flex flex-wrap gap-1.5">
                  {TEXTILE_COLORS.filter((c) => c !== "Boshqa").map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleColor(c)}
                      className={`chip ${form.colors.includes(c) ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Narx" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Narx pog'onasi (miqdorga qarab narx)</label>
            <button className="btn-ghost text-xs" onClick={addTier}>
              <Plus className="h-3.5 w-3.5" /> Pog'ona qo'shish
            </button>
          </div>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2">
                <div className={isAdmin ? "col-span-3" : "col-span-5"}>
                  <label className="label">Nechtadan boshlab</label>
                  <input
                    type="number"
                    className="input"
                    value={t.min_qty || ""}
                    onChange={(e) => updateTier(i, { min_qty: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className={isAdmin ? "col-span-3" : "col-span-5"}>
                  <label className="label">Narxi (1 {form.unit || "dona"})</label>
                  <input
                    type="number"
                    className="input"
                    value={t.price || ""}
                    onChange={(e) => updateTier(i, { price: Number(e.target.value) || 0 })}
                  />
                </div>
                {isAdmin && (
                  <div className="col-span-4">
                    <label className="label flex items-center gap-1 text-amber-700">
                      <Lock className="h-3 w-3" /> Tan narx (1 {form.unit || "dona"})
                    </label>
                    <input
                      type="number"
                      className="input border-amber-200 bg-amber-50"
                      value={t.cost_price || ""}
                      onChange={(e) => updateTier(i, { cost_price: Number(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div className="col-span-2 flex justify-end pb-1">
                  <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => removeTier(i)} disabled={tiers.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Masalan: 1 dan → 5000 so'm, 10 dan → 4500 so'm, 100 dan → 4000 so'm
          </p>
          {isAdmin && (
            <p className="mt-1 text-xs text-amber-700">
              Tan narx faqat sizga (admin) ko'rinadi — har bir pog'ona uchun alohida, chunki miqdor ko'p bo'lsa
              ta'minotchidan tan narx ham pasayishi mumkin.
            </p>
          )}
        </div>
      )}

      {tab === "Tavsif" && (
        <div className="space-y-4">
          <div>
            <label className="label">Mahsulot tavsifi</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="130 gr melovka qog'oz. Bir yoki ikki tomonlama rangli bosma..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Afzalliklari (har qatorda bittadan)</label>
              <textarea
                className="input min-h-[90px]"
                value={form.advantages}
                onChange={(e) => setForm((f) => ({ ...f, advantages: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Tavsiya etiladigan sohalar (har qatorda bittadan)</label>
              <textarea
                className="input min-h-[90px]"
                value={form.recommendedFor}
                onChange={(e) => setForm((f) => ({ ...f, recommendedFor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Muhim sotuv izohlari</label>
            <textarea
              className="input min-h-[60px]"
              value={form.salesNotes}
              onChange={(e) => setForm((f) => ({ ...f, salesNotes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Manager uchun tavsiya</label>
            <textarea
              className="input min-h-[60px]"
              value={form.managerTip}
              onChange={(e) => setForm((f) => ({ ...f, managerTip: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Upsell mahsulotlar</label>
            <div className="flex flex-wrap gap-1.5">
              {allProducts
                .filter((p) => p.id !== product?.id)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleUpsell(p.id)}
                    className={`chip ${form.upsellIds.includes(p.id) ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
                  >
                    {p.name}
                  </button>
                ))}
              {allProducts.length === 0 && <span className="text-xs text-ink-400">Boshqa mahsulot yo'q</span>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
