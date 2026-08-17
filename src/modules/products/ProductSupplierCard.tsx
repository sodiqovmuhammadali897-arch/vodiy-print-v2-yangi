import { useEffect, useMemo, useState } from "react";
import { Factory, Phone, Plus, Send, Star, Trash2 } from "lucide-react";
import type { ProductionCompany, ProductVendor } from "../../lib/types";
import { deleteOne, insertOne, listAll, listWhere, updateOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  productId: string;
  canEdit: boolean;
  onPrimaryChange?: (vendor: ProductVendor | null) => void;
};

type FormState = {
  companyId: string;
  newCompanyName: string;
  newCompanyCity: string;
  newCompanyPhone: string;
  newCompanyTelegram: string;
  newCompanyInternal: boolean;
  leadTimeDays: number;
  isPrimary: boolean;
  note: string;
};

const emptyForm = (): FormState => ({
  companyId: "",
  newCompanyName: "",
  newCompanyCity: "",
  newCompanyPhone: "",
  newCompanyTelegram: "",
  newCompanyInternal: false,
  leadTimeDays: 0,
  isPrimary: false,
  note: "",
});

export default function ProductSupplierCard({ productId, canEdit, onPrimaryChange }: Props) {
  const { isAdmin } = useAuth();
  const [vendors, setVendors] = useState<ProductVendor[]>([]);
  const [companies, setCompanies] = useState<ProductionCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [v, c] = await Promise.all([
      listWhere<ProductVendor>("product_vendors", "product_id", productId, {
        orderBy: ["created_at", "asc"],
      }),
      listAll<ProductionCompany>("production_companies", { orderBy: ["name", "asc"] }),
    ]);
    setVendors(v);
    setCompanies(c);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const primary = useMemo(() => vendors.find((v) => v.is_primary) || vendors[0] || null, [vendors]);

  useEffect(() => {
    onPrimaryChange?.(primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary?.id]);

  const openNew = () => {
    setForm(emptyForm());
    setCreatingCompany(companies.length === 0 && isAdmin);
    setError(null);
    setModalOpen(true);
  };

  const submit = async () => {
    setError(null);
    let companyId = form.companyId;
    let companyName = companies.find((c) => c.id === companyId)?.name || "";

    if (creatingCompany) {
      if (!form.newCompanyName.trim()) return setError("Kompaniya nomini kiriting");
      const created = await insertOne<Omit<ProductionCompany, "id" | "created_at">>(
        "production_companies",
        {
          name: form.newCompanyName.trim(),
          city: form.newCompanyCity.trim(),
          phone: form.newCompanyPhone.trim(),
          telegram: form.newCompanyTelegram.trim(),
          is_internal: form.newCompanyInternal,
          note: "",
        },
      );
      companyId = created.id;
      companyName = created.name;
    } else if (!companyId) {
      return setError("Kompaniyani tanlang");
    }

    setSaving(true);
    try {
      if (form.isPrimary) {
        await Promise.all(
          vendors.filter((v) => v.is_primary).map((v) => updateOne("product_vendors", v.id, { is_primary: false })),
        );
      }
      await insertOne<Omit<ProductVendor, "id" | "created_at">>("product_vendors", {
        product_id: productId,
        company_id: companyId,
        company_name: companyName,
        is_primary: form.isPrimary || vendors.length === 0,
        lead_time_days: form.leadTimeDays,
        note: form.note.trim(),
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    }
    setSaving(false);
  };

  const setPrimary = async (v: ProductVendor) => {
    await Promise.all([
      updateOne("product_vendors", v.id, { is_primary: true }),
      ...vendors.filter((x) => x.id !== v.id && x.is_primary).map((x) => updateOne("product_vendors", x.id, { is_primary: false })),
    ]);
    await load();
  };

  const remove = async (v: ProductVendor) => {
    if (!confirm(`"${v.company_name}" ushbu mahsulot autrosslari ro'yxatidan o'chirilsinmi?`)) return;
    await deleteOne("product_vendors", v.id);
    await load();
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-ink-500" />
          <h2 className="font-display text-base font-bold text-ink-900">Autsors kompaniyalar</h2>
        </div>
        {canEdit && (
          <button className="btn-ghost text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Qo'shish
          </button>
        )}
      </div>

      {!loading && vendors.length === 0 && (
        <p className="py-4 text-center text-sm text-ink-400">
          Bu mahsulot uchun hali autsors kompaniya biriktirilmagan
        </p>
      )}

      <div className="space-y-2">
        {vendors.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50/40 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {v.is_primary && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                <span className="truncate text-sm font-semibold text-ink-900">{v.company_name}</span>
              </div>
              <CompanyMeta companies={companies} companyId={v.company_id} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="chip bg-brand-100 text-brand-700">
                {v.lead_time_days ? `${v.lead_time_days} kun` : "muddat yo'q"}
              </span>
              {canEdit && !v.is_primary && (
                <button className="btn-ghost !p-1.5" title="Asosiy qilish" onClick={() => setPrimary(v)}>
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              {canEdit && (
                <button
                  className="btn-ghost !p-1.5 text-rose-600 hover:bg-rose-50"
                  onClick={() => remove(v)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Autsors kompaniya biriktirish"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>
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
        <div className="space-y-4">
          {companies.length > 0 && (
            <div className="flex gap-2">
              <button
                className={`chip ${!creatingCompany ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"}`}
                onClick={() => setCreatingCompany(false)}
              >
                Mavjud kompaniya
              </button>
              {isAdmin && (
                <button
                  className={`chip ${creatingCompany ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"}`}
                  onClick={() => setCreatingCompany(true)}
                >
                  Yangi kompaniya
                </button>
              )}
            </div>
          )}

          {creatingCompany ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Kompaniya nomi *</label>
                <input
                  className="input"
                  value={form.newCompanyName}
                  onChange={(e) => setForm((f) => ({ ...f, newCompanyName: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Shahar</label>
                <input
                  className="input"
                  value={form.newCompanyCity}
                  onChange={(e) => setForm((f) => ({ ...f, newCompanyCity: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input
                  className="input"
                  value={form.newCompanyPhone}
                  onChange={(e) => setForm((f) => ({ ...f, newCompanyPhone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Telegram</label>
                <input
                  className="input"
                  placeholder="@username"
                  value={form.newCompanyTelegram}
                  onChange={(e) => setForm((f) => ({ ...f, newCompanyTelegram: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.newCompanyInternal}
                    onChange={(e) => setForm((f) => ({ ...f, newCompanyInternal: e.target.checked }))}
                  />
                  Ichki (Vodiy Print)
                </label>
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Kompaniya *</label>
              <select
                className="input"
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
              >
                <option value="">-- tanlang --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_internal ? "(Ichki)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tayyor bo'lish muddati (kun)</label>
              <input
                type="number"
                className="input"
                value={form.leadTimeDays || ""}
                onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isPrimary}
                  onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                />
                Asosiy autros sifatida belgilash
              </label>
            </div>
          </div>
          <div>
            <label className="label">Izoh</label>
            <textarea
              className="input min-h-[60px]"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CompanyMeta({ companies, companyId }: { companies: ProductionCompany[]; companyId: string }) {
  const c = companies.find((x) => x.id === companyId);
  if (!c) return null;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
      {c.city && <span>{c.city}</span>}
      {c.phone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3" /> {c.phone}
        </span>
      )}
      {c.telegram && (
        <a
          href={`https://t.me/${c.telegram.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-brand-700 hover:underline"
        >
          <Send className="h-3 w-3" /> {c.telegram}
        </a>
      )}
    </div>
  );
}
