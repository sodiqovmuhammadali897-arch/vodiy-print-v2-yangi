import { useEffect, useState } from "react";
import { CircleCheck as CheckCircle, Database, Loader as Loader2 } from "lucide-react";
import { getOne, insertOne, listAll, upsertOne } from "../../lib/firestoreDb";
import { seedCompanySettings, seedManagers } from "../../lib/seedData";

type Status = "checking" | "seeded" | "empty" | "seeding" | "done" | "error";

export default function SeedPanel() {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState({ managers: 0, company: false });

  const check = async () => {
    try {
      const [managers, company] = await Promise.all([
        listAll<{ id: string }>("managers"),
        getOne("company_settings", "main"),
      ]);
      setDetail({ managers: managers.length, company: !!company });
      setStatus(managers.length > 0 && !!company ? "seeded" : "empty");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
      setStatus("error");
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const runSeed = async () => {
    setStatus("seeding");
    setError(null);
    try {
      const existingManagers = await listAll<{ id: string; name: string }>(
        "managers",
      );
      const existingNames = new Set(existingManagers.map((m) => m.name));
      for (const m of seedManagers) {
        if (!existingNames.has(m.name)) {
          await insertOne("managers", m);
        }
      }

      const existingCompany = await getOne("company_settings", "main");
      if (!existingCompany) {
        await upsertOne("company_settings", "main", seedCompanySettings);
      }

      setStatus("done");
      await check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
      setStatus("error");
    }
  };

  if (status === "seeded" || status === "done") {
    return (
      <div className="card flex items-center gap-3 border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle className="h-5 w-5" />
        <div className="text-sm">
          <div className="font-semibold">Boshlang'ich ma'lumotlar mavjud</div>
          <div className="text-xs text-emerald-700">
            Managerlar: {detail.managers} ta &middot; Kompaniya sozlamalari:{" "}
            {detail.company ? "bor" : "yo'q"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-base font-bold text-ink-900">
            Boshlang'ich ma'lumotlarni import qilish
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            3 ta manager va kompaniya sozlamalari Firestore'ga bir marta
            ko'chiriladi. Agar ma'lumot allaqachon mavjud bo'lsa, dublikat
            yaratilmaydi.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={runSeed}
        disabled={status === "seeding" || status === "checking"}
        className="btn-primary"
      >
        {status === "seeding" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "checking"
          ? "Tekshirilmoqda..."
          : status === "seeding"
            ? "Import qilinmoqda..."
            : "Import qilish"}
      </button>
    </div>
  );
}
