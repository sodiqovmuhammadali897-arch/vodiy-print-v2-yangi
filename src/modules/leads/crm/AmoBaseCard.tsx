import { useEffect, useState } from "react";
import { Archive, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { subscribeOne } from "../../../lib/firestoreDb";

// Mijozlar bazasi → «amoCRM arxivini ko'chirish» (the owner only): amoCRM's
// closed deals (won and lost) into the base, one customer per phone
// (meta-webhook/crmBase.js). «Oldin ko'rish» counts, «Ko'chirish» writes;
// pressing again later adds the deals closed since. amoCRM is only read.
type Preview = { calls?: number; recorded?: number; notes?: number; deals: number; withPhone: number; noPhone: number; customers: number; won: number; lost: number; inBase: number; groups: Record<string, number>; at: string };
type BaseImportDoc = {
  state?: "running" | "done" | "error";
  preview?: Preview | null;
  progress?: { done: number; total: number };
  result?: { customers: number; deals: number; noPhone: number; won: number; lost: number; calls?: number; recorded?: number; notes?: number };
  previewing?: boolean;
  finished_at?: string;
  by?: string;
  error?: string | null;
};
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const GROUP_LABEL: Record<string, string> = { price: "Narx qimmat", competitor: "Raqobatchi", no_answer: "Aloqa yo'q", wrong_number: "Xato raqam", cancelled: "Bekor bo'ldi", other: "Boshqa sabab", none: "Sababsiz", won: "Yutilgan" };

export default function AmoBaseCard({ empty, onDone }: { empty: boolean; onDone: () => void }) {
  const { user } = useAuth();
  const [doc, setDoc] = useState<BaseImportDoc>({});
  const [open, setOpen] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeOne<BaseImportDoc>("crm_meta", "amo_base", (d) => setDoc(d || {})), []);
  const finished = doc.state === "done" ? doc.finished_at : "";
  useEffect(() => {
    if (finished) onDone();
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (what: "preview" | "run") => {
    setBusy(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/webhooks/crm/amo-base/${what}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bo'lmadi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };
  const p = doc.preview;
  const running = doc.state === "running" || !!doc.previewing;
  const pr = doc.progress;
  const run = () => {
    if (!window.confirm(`amoCRM'dagi ${p ? p.withPhone : "yopilgan"} ta bitim Mijozlar bazasiga ko'chirilsinmi? amoCRM'ning o'zi o'zgarmaydi.`)) return;
    void call("run");
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/10">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <Archive className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">amoCRM arxivini ko'chirish</span>
          <span className="block truncate text-xs text-ink-600">
            {doc.previewing
              ? "Sanalmoqda… qo'ng'iroqlar ko'p, bir necha daqiqa"
              : running
              ? `Ko'chirilmoqda… ${pr && pr.total ? `${pr.done} / ${pr.total}` : "amoCRM o'qilmoqda"}`
              : doc.state === "done" && doc.result
                ? `Oxirgisi ${when(doc.finished_at)}: ${doc.result.customers} mijoz, ${doc.result.deals} bitim`
                : "amoCRM'dagi yopilgan hamma bitimlar (yo'qotilgan va yutilgan) bazaga o'tadi"}
          </span>
        </span>
        {running && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
        <ChevronDown className={`h-4 w-4 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-emerald-200 px-4 py-3 text-sm dark:border-emerald-800">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-ink-600">
            <li>«Oldin ko'rish» — nechta bitim va mijoz o'tishini sanaydi, hech narsa yozilmaydi.</li>
            <li>«Ko'chirish» — bir telefondagi hamma bitimlar bitta mijozga yig'iladi: sabab, kim yopgan, qachon, hamma maydonlar, teglar, izohlar va qo'ng'iroqlar (yozuvi bilan).</li>
            <li>Keyin yana bossangiz, yangi yopilganlar qo'shiladi, takrorlanmaydi. amoCRM'ning o'zi o'zgarmaydi.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary py-1.5" disabled={busy || running} onClick={() => void call("preview")}>
              {busy && !running ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Oldin ko'rish
            </button>
            <button type="button" className="btn-primary py-1.5" disabled={busy || running || !p || !p.withPhone} onClick={run}>
              Ko'chirish{p ? ` (${p.customers} mijoz)` : ""}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {doc.state === "error" && doc.error && <p className="text-xs text-rose-600">Oxirgi urinish xato bilan tugadi: {doc.error}</p>}
          {running && pr && pr.total > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(pr.done / pr.total) * 100}%` }} />
            </div>
          )}
          {doc.state === "done" && doc.result && !p && (
            <p className="rounded-xl bg-emerald-100/70 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
              ✅ {when(doc.finished_at)} · {doc.by}: {doc.result.customers} mijoz, {doc.result.deals} bitim (yo'qotilgan {doc.result.lost}, yutilgan {doc.result.won}){doc.result.calls !== undefined ? `, ${doc.result.calls} qo'ng'iroq (${doc.result.recorded} tasida yozuv), ${doc.result.notes} izoh` : ""}; {doc.result.noPhone} tasida telefon yo'q edi.
            </p>
          )}
          {p && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Yopilgan bitim", p.deals],
                  ["Mijoz bo'ladi", p.customers],
                  ["Yo'qotilgan / yutilgan", `${p.lost} / ${p.won}`],
                  ["Qo'ng'iroq (yozuvli)", p.calls !== undefined ? `${p.calls} (${p.recorded})` : "—"],
                ].map(([label, n]) => (
                  <div key={String(label)} className="rounded-xl border border-ink-100 bg-surface px-3 py-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
                    <div className="font-display text-xl font-extrabold text-ink-900">{n}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-600">
                {Object.entries(p.groups)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => `${GROUP_LABEL[k] || k} ${n}`)
                  .join(" · ")}{" "}
                · {p.notes ?? 0} izoh · {p.noPhone} bitimda telefon yo'q · bazada hozir {p.inBase} mijoz · {when(p.at)} holati
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
