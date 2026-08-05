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
  onSaved: () => void;
};

type TierRow = { min_qty: number; price: number; cost_price: number };

const emptyTiers: TierRow[] = [{ min_qty: 1, price: 0, cost_price: 0 }];

export default function ProductFormModal({ open, onClose, product, onSaved }: Props) {
  const { isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [unit, setUnit] = useState("dona");
  const [tiers, setTiers] = useState<TierRow[]>(emptyTiers);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTextile = category === "Textil";

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setCategory(product.category || PRODUCT_CATEGORIES[0]);
      setUnit(product.unit || "dona");
      setSizes(product.sizes || []);
      setColors(product.colors || []);
      const priceTiers = product.price_tiers?.length
        ? product.price_tiers
        : [{ min_qty: 1, price: 0 }];

      if (isAdmin) {
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
      setName("");
      setCategory(PRODUCT_CATEGORIES[0]);
      setUnit("dona");
      setTiers(emptyTiers);
      setSizes([]);
      setColors([]);
    }
    setError(null);
  }, [product, open, isAdmin]);

  const toggleSize = (size: string) =>
    setSizes((s) => (s.includes(size) ? s.filter((x) => x !== size) : [...s, size]));
  const toggleColor = (color: string) =>
    setColors((c) => (c.includes(color) ? c.filter((x) => x !== color) : [...c, color]));

  const updateTier = (i: number, patch: Partial<TierRow>) =>
    setTiers((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addTier = () => setTiers((t) => [...t, { min_qty: 0, price: 0, cost_price: 0 }]);
  const removeTier = (i: number) =>
    setTiers((t) => (t.length === 1 ? t : t.filter((_, idx) => idx !== i)));

  const submit = async () => {
    if (!name.trim()) return setError("Mahsulot nomi kiritilishi shart");
    const validRows = sortTiers(tiers.filter((t) => t.min_qty > 0 && t.price >= 0));
    if (validRows.length === 0) {
      return setError("Kamida bitta narx pog'onasi to'g'ri kiritilishi kerak");
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category,
        unit,
        price_tiers: validRows.map(({ min_qty, price }) => ({ min_qty, price })),
        base_price: validRows[0].price,
        sizes: isTextile ? sizes : [],
        colors: isTextile ? colors : [],
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
      title={product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
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
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label">Mahsulot nomi *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">O'lchov birligi</label>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Kategoriya</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isTextile && (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Razmerlar</label>
            <div className="flex flex-wrap gap-1.5">
              {TEXTILE_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`chip ${
                    sizes.includes(s)
                      ? "bg-brand-600 text-white"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  }`}
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
                  className={`chip ${
                    colors.includes(c)
                      ? "bg-brand-600 text-white"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
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
                <label className="label">Narxi (1 {unit || "dona"})</label>
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
                    <Lock className="h-3 w-3" /> Tan narx (1 {unit || "dona"})
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
                <button
                  className="btn-ghost text-rose-600 hover:bg-rose-50"
                  onClick={() => removeTier(i)}
                  disabled={tiers.length === 1}
                >
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
            Tan narx faqat sizga (admin) ko'rinadi — har bir pog'ona uchun alohida, chunki
            miqdor ko'p bo'lsa ta'minotchidan tan narx ham pasayishi mumkin.
          </p>
        )}
      </div>
    </Modal>
  );
}
