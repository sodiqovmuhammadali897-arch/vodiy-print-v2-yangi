import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Power,
  Shirt,
  Phone,
  Send,
  MapPin,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { TextileCompany } from "../../lib/types";
import { nextTextileCompanyNumber } from "../../lib/numbering";
import Modal from "../../components/ui/Modal";
import AsyncState from "../../components/ui/AsyncState";

type FormState = {
  name: string;
  contact_person: string;
  phone: string;
  telegram: string;
  address: string;
  note: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  contact_person: "",
  phone: "",
  telegram: "",
  address: "",
  note: "",
  is_active: true,
});

export default function TextileCompaniesPanel() {
  const [rows, setRows] = useState<TextileCompany[]>([]);
  const [usageCount, setUsageCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TextileCompany | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, o] = await Promise.all([
      supabase
        .from("textile_companies")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("textile_company_id")
        .not("textile_company_id", "is", null),
    ]);
    setRows((c.data as TextileCompany[]) || []);
    const counts: Record<string, number> = {};
    ((o.data as { textile_company_id: string }[]) || []).forEach((r) => {
      counts[r.textile_company_id] = (counts[r.textile_company_id] || 0) + 1;
    });
    setUsageCount(counts);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.company_number, r.name, r.contact_person, r.phone, r.telegram, r.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: TextileCompany) => {
    setEditing(c);
    setForm({
      name: c.name,
      contact_person: c.contact_person,
      phone: c.phone,
      telegram: c.telegram,
      address: c.address,
      note: c.note,
      is_active: c.is_active,
    });
    setError(null);
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Kompaniya nomini kiriting");
      return;
    }
    setSaving(true);
    setError(null);
    if (editing) {
      const { error: err } = await supabase
        .from("textile_companies")
        .update(form)
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        await supabase
          .from("orders")
          .update({ textile_company_name: form.name })
          .eq("textile_company_id", editing.id);
        setModalOpen(false);
        await load();
      }
    } else {
      const number = await nextTextileCompanyNumber();
      const { error: err } = await supabase
        .from("textile_companies")
        .insert({ ...form, company_number: number });
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        await load();
      }
    }
    setSaving(false);
  };

  const toggleActive = async (c: TextileCompany) => {
    await supabase
      .from("textile_companies")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    await load();
  };

  const remove = async (c: TextileCompany) => {
    const used = usageCount[c.id] || 0;
    if (used > 0) {
      alert(
        `Bu kompaniya ${used} ta buyurtmada ishlatilgan — o'chirib bo'lmaydi. Uni "Nofaol" qiling.`,
      );
      return;
    }
    if (!confirm(`"${c.name}" kompaniyasi o'chirilsinmi?`)) return;
    await supabase.from("textile_companies").delete().eq("id", c.id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Textil kompaniyalari
            </h2>
            <p className="text-xs text-ink-500">
              Textil buyurtmalari uchun ishlatiladigan tashqi ishlab chiqaruvchilar
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, telefon, mas'ul..."
                className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
              />
            </div>
            <button className="btn-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> Yangi kompaniya
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Textil kompaniyalari qo'shilmagan"
          emptyDescription="Birinchi kompaniyani qo'shing va uni buyurtmalarda tanlashingiz mumkin"
          emptyIcon={<Shirt className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">ID</th>
                  <th className="table-th">Kompaniya</th>
                  <th className="table-th">Mas'ul</th>
                  <th className="table-th">Aloqa</th>
                  <th className="table-th">Manzil</th>
                  <th className="table-th">Buyurtmalar</th>
                  <th className="table-th">Holati</th>
                  <th className="table-th text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => {
                  const used = usageCount[c.id] || 0;
                  return (
                    <tr key={c.id} className="hover:bg-ink-50/50">
                      <td className="table-td">
                        <span className="font-display font-bold text-brand-700">
                          {c.company_number || "-"}
                        </span>
                      </td>
                      <td className="table-td">
                        <div className="font-semibold text-ink-900">{c.name}</div>
                        {c.note && (
                          <div className="max-w-[220px] truncate text-xs text-ink-500">
                            {c.note}
                          </div>
                        )}
                      </td>
                      <td className="table-td text-ink-700">
                        {c.contact_person || "-"}
                      </td>
                      <td className="table-td">
                        <div className="text-xs text-ink-700">{c.phone || "-"}</div>
                        {c.telegram && (
                          <a
                            target="_blank"
                            rel="noreferrer"
                            href={`https://t.me/${c.telegram.replace(/^@/, "")}`}
                            className="text-xs text-brand-700 hover:underline"
                          >
                            {c.telegram}
                          </a>
                        )}
                      </td>
                      <td className="table-td max-w-[200px] truncate text-ink-700">
                        {c.address || "-"}
                      </td>
                      <td className="table-td text-ink-700">
                        {used > 0 ? `${used} ta` : "-"}
                      </td>
                      <td className="table-td">
                        {c.is_active ? (
                          <span className="chip bg-emerald-100 text-emerald-700">
                            Faol
                          </span>
                        ) : (
                          <span className="chip bg-ink-200 text-ink-700">
                            Nofaol
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => toggleActive(c)}
                            className={`btn-ghost ${
                              c.is_active
                                ? "text-ink-600 hover:bg-ink-100"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={c.is_active ? "Nofaol qilish" : "Faol qilish"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="btn-ghost text-ink-600 hover:bg-ink-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(c)}
                            disabled={used > 0}
                            className="btn-ghost text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            title={
                              used > 0
                                ? "Buyurtmalarda ishlatilgan"
                                : "O'chirish"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Kompaniyani tahrirlash" : "Yangi textil kompaniyasi"}
        size="lg"
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
          <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Kompaniya nomi *</label>
            <div className="relative">
              <Shirt className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Mas'ul shaxs</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                value={form.contact_person}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_person: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Telefon</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Telegram</label>
            <div className="relative">
              <Send className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                placeholder="@username"
                value={form.telegram}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telegram: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Manzil</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Izoh</label>
            <textarea
              className="input min-h-[70px]"
              value={form.note}
              onChange={(e) =>
                setForm((f) => ({ ...f, note: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              Faol — buyurtma yaratishda dropdown'da ko'rinadi
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
