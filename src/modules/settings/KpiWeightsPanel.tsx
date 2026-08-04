import { useEffect, useState } from "react";
import { Gauge, Save } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type KpiSettings, type KpiWeights } from "../../lib/types";

const SINGLETON_ID = "default";

const FIELDS: { key: keyof KpiWeights; label: string }[] = [
  { key: "attendance", label: "Davomat" },
  { key: "punctuality", label: "Vaqtida kelish" },
  { key: "hoursWorked", label: "Ishlangan soat" },
  { key: "tasksCompleted", label: "Bajarilgan vazifalar" },
  { key: "onTimeOrders", label: "Buyurtmalarni vaqtida tugatish" },
  { key: "reworkRate", label: "Xato/qayta ishlash (kamaytiruvchi)" },
  { key: "managerScore", label: "Rahbar bahosi" },
];

export default function KpiWeightsPanel() {
  const [weights, setWeights] = useState<KpiWeights>(DEFAULT_KPI_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const doc = await getOne<KpiSettings>("kpi_settings", SINGLETON_ID);
      if (doc?.weights) setWeights(doc.weights);
      setLoading(false);
    })();
  }, []);

  const total = FIELDS.reduce((sum, f) => sum + (Number(weights[f.key]) || 0), 0);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await upsertOne("kpi_settings", SINGLETON_ID, {
        weights,
        updatedAt: new Date().toISOString(),
      });
      setMessage("Saqlandi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-ink-500">Yuklanmoqda...</div>;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-bold text-ink-900">KPI og'irliklari (%)</h2>
      </div>
      <p className="mb-4 text-sm text-ink-500">
        Har bir ko'rsatkichning umumiy KPI balliga qo'shadigan ulushi. Yig'indi 100% bo'lishi
        tavsiya etiladi (hozir: {total}%).
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              type="number"
              className="input"
              value={weights[f.key] || ""}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) || 0 }))
              }
            />
          </div>
        ))}
      </div>
      {message && (
        <div className="mt-3 rounded-xl bg-sky-50 px-4 py-2 text-sm text-sky-800">{message}</div>
      )}
      <button className="btn-primary mt-4" onClick={save} disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </div>
  );
}
