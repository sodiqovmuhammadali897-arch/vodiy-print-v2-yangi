import { useEffect, useState } from "react";
import { ArrowDownToLine, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { subscribeOne } from "../../../lib/firestoreDb";

// Sotuv bo'limi → Lidlar → «amoCRM'dan ko'chirish» (step 4, the owner only):
// first «Oldin ko'rish» (counts, nothing written), then «Ko'chirish» moves
// amoCRM's open deals into the ERP's leads (meta-webhook/amoImport.js).
// Pressing again later adds only the deals that came since.
type Count = { label: string; n: number };
type Preview = { total: number; create: number; link: number; already: number; noPhone: number; unassigned: number; tasks: number; byStage: Count[]; byUser: Count[]; at: string };
type ImportDoc = {
  state?: "running" | "done" | "error";
  preview?: Preview | null;
  progress?: { done: number; total: number };
  result?: { created: number; linked: number; already: number; tasks: number; orders: number };
  started_at?: string;
  finished_at?: string;
  by?: string;
  error?: string | null;
};

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function AmoImportCard() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<ImportDoc>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeOne<ImportDoc>("crm_meta", "amo_import", (d) => setDoc(d || {})), []);

  const call = async (what: "preview" | "run") => {
    setBusy(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/webhooks/crm/amo-import/${what}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bo'lmadi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };
  const run = () => {
    const p = doc.preview;
    if (!window.confirm(`amoCRM'dagi ${p ? p.create + p.link : "ochiq"} ta bitim ERP lidlariga ko'chirilsinmi? amoCRM'ning o'zi o'zgarmaydi.`)) return;
    void call("run");
  };

  const p = doc.preview;
  const running = doc.state === "running";
  const pr = doc.progress;
  return (
    <section className="rounded-2xl border border-ink-100 bg-surface shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
          <ArrowDownToLine className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">amoCRM'dan ko'chirish</span>
          <span className="block truncate text-xs text-ink-500">
            {running
              ? `Ko'chirilmoqda… ${pr ? `${pr.done} / ${pr.total}` : ""}`
              : doc.state === "done" && doc.result
                ? `Oxirgisi ${when(doc.finished_at)}: ${doc.result.created} ta yangi lid, ${doc.result.linked} tasi bor lidga bog'landi`
                : "Ochiq bitimlar ERP lidlariga o'tadi — mas'ul, bosqich, maydonlar va zadachalari bilan"}
          </span>
        </span>
        {running && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
        <ChevronDown className={`h-4 w-4 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink-100 px-4 py-3 text-sm">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-ink-600">
            <li>«Oldin ko'rish» — nechta bitim o'tishini sanaydi, hech narsa yozilmaydi.</li>
            <li>«Ko'chirish» — yutilmagan va yo'qotilmagan bitimlar ERP'ga lid bo'lib o'tadi. Shu telefon bilan ochiq lid bo'lsa, ikkinchisi ochilmaydi — bog'lanadi.</li>
            <li>Keyin yana bossangiz, faqat yangi kelgan bitimlar qo'shiladi. amoCRM'ning o'zi o'zgarmaydi.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary py-1.5" disabled={busy || running} onClick={() => void call("preview")}>
              {busy && !running ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Oldin ko'rish
            </button>
            <button type="button" className="btn-primary py-1.5" disabled={busy || running || !p || p.create + p.link === 0} onClick={run}>
              Ko'chirish{p ? ` (${p.create + p.link})` : ""}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {doc.state === "error" && doc.error && <p className="text-xs text-rose-600">Oxirgi urinish xato bilan tugadi: {doc.error}</p>}
          {running && pr && pr.total > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(pr.done / pr.total) * 100}%` }} />
            </div>
          )}
          {doc.state === "done" && doc.result && !p && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              ✅ {when(doc.finished_at)} · {doc.by}: {doc.result.created} ta yangi lid, {doc.result.linked} tasi bor lidga bog'landi, {doc.result.tasks} ta zadacha, {doc.result.orders} tasi ERP buyurtmasiga bog'landi
              {doc.result.already ? `; ${doc.result.already} tasi avval ko'chirilgan` : ""}.
            </p>
          )}
          {p && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Ochiq bitim", p.total],
                  ["Yangi lid bo'ladi", p.create],
                  ["Bor lidga bog'lanadi", p.link],
                  ["Avval ko'chirilgan", p.already],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-xl border border-ink-100 px-3 py-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
                    <div className="font-display text-xl font-extrabold text-ink-900">{n}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-500">
                {p.tasks} ta ochiq zadacha ham o'tadi · {p.noPhone} tasida telefon yo'q · {p.unassigned} tasining mas'uli ERP'da bog'lanmagan
                {p.unassigned ? " (Xodimlar → amoCRM foydalanuvchisi)" : ""} · {when(p.at)} holati
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CountList title="Bosqich bo'yicha" items={p.byStage} />
                <CountList title="Mas'ul bo'yicha" items={p.byUser} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CountList({ title, items }: { title: string; items: Count[] }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-500">{title}</div>
      {items.map((i) => (
        <div key={i.label} className="flex justify-between border-b border-ink-100 py-1 text-xs last:border-0">
          <span className="truncate text-ink-700">{i.label}</span>
          <b className="tabular-nums text-ink-900">{i.n}</b>
        </div>
      ))}
    </div>
  );
}
