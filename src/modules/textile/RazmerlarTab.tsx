import { useEffect, useState } from "react";
import { Plus, Save, Trash2, FileOutput } from "lucide-react";
import { deleteOne, getOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { CompanySettings, TextileSizeTemplate } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import AsyncState from "../../components/ui/AsyncState";
import TextileMatrixEditor from "../../components/textile/TextileMatrixEditor";
import TextileMatrixExport from "./TextileMatrixExport";
import {
  breakdownToMatrixRows,
  matrixRowsToBreakdown,
  pivotBreakdownEntries,
  type SizeMatrixRow,
} from "../../lib/textileMatrix";

const emptyRows: SizeMatrixRow[] = [];

export default function RazmerlarTab() {
  const { user, staff } = useAuth();
  const [templates, setTemplates] = useState<TextileSizeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanySettings | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [productName, setProductName] = useState("");
  const [clientName, setClientName] = useState("");
  const [rows, setRows] = useState<SizeMatrixRow[]>(emptyRows);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rows, cs] = await Promise.all([
      listAll<TextileSizeTemplate>("textile_size_templates", { orderBy: ["created_at", "desc"] }),
      getOne<CompanySettings>("company_settings", "main"),
    ]);
    setTemplates(rows);
    setCompany(cs);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const startNew = () => {
    setSelectedId(null);
    setName("");
    setProductName("");
    setClientName("");
    setRows([]);
  };

  const selectTemplate = (t: TextileSizeTemplate) => {
    setSelectedId(t.id);
    setName(t.name);
    setProductName(t.product_name);
    setClientName(t.client_name || "");
    setRows(breakdownToMatrixRows(t.size_breakdown));
  };

  const save = async () => {
    if (!name.trim()) {
      alert("Shablon nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        product_name: productName.trim(),
        client_name: clientName.trim(),
        size_breakdown: matrixRowsToBreakdown(rows),
        created_by: staff?.full_name || user?.email || "",
        created_at: new Date().toISOString(),
      };
      if (selectedId) {
        await updateOne("textile_size_templates", selectedId, payload);
      } else {
        const created = await insertOne("textile_size_templates", payload);
        setSelectedId(created.id);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: TextileSizeTemplate) => {
    if (!confirm(`"${t.name}" shablonini o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await deleteOne("textile_size_templates", t.id);
      if (selectedId === t.id) startNew();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    }
  };

  const matrix = pivotBreakdownEntries(matrixRowsToBreakdown(rows));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase text-ink-500">Saqlangan shablonlar</div>
          <button className="btn-secondary" onClick={startNew}>
            <Plus className="h-4 w-4" /> Yangi
          </button>
        </div>
        <AsyncState
          loading={loading}
          empty={templates.length === 0}
          emptyLabel="Hali shablon saqlanmagan"
        >
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
            {templates.map((t) => (
              <li key={t.id} className="group flex items-center gap-1">
                <button
                  onClick={() => selectTemplate(t)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
                    selectedId === t.id ? "bg-emerald-50 text-emerald-800" : "text-ink-700"
                  }`}
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-ink-500">
                    {t.product_name || "-"}
                    {t.client_name ? ` · ${t.client_name}` : ""}
                  </div>
                </button>
                <button
                  className="btn-ghost text-rose-600 opacity-0 hover:bg-rose-50 group-hover:opacity-100"
                  onClick={() => remove(t)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </AsyncState>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-ink-900">
            {selectedId ? "Shablonni tahrirlash" : "Yangi shablon"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => setExportOpen(true)}
              disabled={matrix.rows.length === 0}
            >
              <FileOutput className="h-4 w-4" /> Chop etish / Ulashish
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> Saqlash
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Shablon nomi</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alpha School - Futbolka"
            />
          </div>
          <div>
            <label className="label">Mahsulot</label>
            <input
              className="input"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Futbolka"
            />
          </div>
          <div>
            <label className="label">Klient (ixtiyoriy)</label>
            <input
              className="input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Alpha School"
            />
          </div>
        </div>

        <TextileMatrixEditor rows={rows} onChange={setRows} />

        {selectedId && (
          <div className="text-xs text-ink-400">
            Oxirgi saqlangan:{" "}
            {formatDateTime(templates.find((t) => t.id === selectedId)?.created_at || "")}
          </div>
        )}
      </div>

      <TextileMatrixExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        company={company}
        orderNumber={name}
        idLabel="Shablon"
        clientName={clientName}
        productName={productName}
        orderDate={new Date().toISOString()}
        matrix={matrix}
      />
    </div>
  );
}
