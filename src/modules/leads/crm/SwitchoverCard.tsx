import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Rocket } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { subscribeOne } from "../../../lib/firestoreDb";

// Sotuv bo'limi → Lidlar → «ERP'ga o'tish» (the owner only, 2026-11-26:
// «25 kundagi yangi lidlardan boshqa eski lidlarni yop; amodan hamma
// zadachalarni ko'chir»): meta-webhook/switchover.js. «Oldin ko'rish»
// counts, «Bajarish» moves amoCRM's open tasks onto ERP leads and closes
// the other old leads (they go to Mijozlar bazasi). Pressing again moves
// only tasks not moved yet.
type Count = { label: string; n: number };
type Preview = {
  cutoff: string;
  amoOpenTasks: number;
  tasksToMove: number;
  tasksAlready: number;
  tasksOnContacts: number;
  tasksOnClosedDeals: number;
  byUser: Count[];
  leadsCreate: number;
  leadsLink: number;
  leadsReopen: number;
  leadsClose: number;
  closeByStatus: Count[];
  tasksCancel: number;
  leadsKeepNew: number;
  at: string;
};
type Doc = { state?: "running" | "done" | "error"; previewing?: boolean; preview?: Preview | null; progress?: { done: number; total: number }; result?: { created: number; linked: number; reopened: number; tasks: number; closed: number; cancelled: number }; finished_at?: string; by?: string; error?: string | null };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const STATUS: Record<string, string> = { new: "Yangi", accepted: "Qabul qilindi", info_given: "Ma'lumot berildi", offer: "Taklif yuborildi" };

export default function SwitchoverCard() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<Doc>({});
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("2026-11-25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeOne<Doc>("crm_meta", "switchover", (d) => setDoc(d || {})), []);

  const call = async (what: "preview" | "run") => {
    setBusy(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/webhooks/crm/switchover/${what}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ day }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bo'lmadi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };
  const p = doc.preview;
  const working = doc.state === "running" || !!doc.previewing;
  const pr = doc.progress;
  const run = () => {
    if (!p) return;
    if (!window.confirm(`${p.tasksToMove} ta amoCRM zadachasi ERP'ga o'tadi va ${p.leadsClose} ta eski lid yopiladi («Eski lid (ERP'ga o'tish)» — Mijozlar bazasiga tushadi). Bajarilsinmi?`)) return;
    void call("run");
  };

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/60 shadow-sm dark:border-brand-800 dark:bg-brand-900/10">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Rocket className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">ERP'ga o'tish: amoCRM zadachalari + eski lidlarni yopish</span>
          <span className="block truncate text-xs text-ink-600">
            {doc.previewing
              ? "Sanalmoqda…"
              : doc.state === "running"
                ? `Bajarilmoqda… ${pr && pr.total ? `${pr.done} / ${pr.total}` : "amoCRM o'qilmoqda"}`
                : doc.state === "done" && doc.result
                  ? `Bajarildi ${when(doc.finished_at)}: ${doc.result.tasks} zadacha ko'chdi, ${doc.result.closed} eski lid yopildi`
                  : "amoCRM'dagi ochiq zadachalar ERP lidlariga o'tadi, qolgan eski lidlar yopiladi"}
          </span>
        </span>
        {working && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
        <ChevronDown className={`h-4 w-4 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-brand-200 px-4 py-3 text-sm dark:border-brand-800">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-ink-600">
            <li>amoCRM'dagi har bir ochiq zadacha (Muhammadiyor, Nuriddin …) o'z bitimining ERP lidiga, o'sha managerga o'tadi. ERP'da bu bitim bo'lmasa, lid ochiladi.</li>
            <li>Tanlangan kundan oldin kelgan, buyurtmasi yo'q, zadachasi amoCRM'dan kelmagan hamma ochiq lid yopiladi — sababi «Eski lid (ERP'ga o'tish)». Ular Mijozlar bazasiga tushadi, kerak bo'lsa «Qayta ishlash» bilan qaytadi.</li>
            <li>Yana bossangiz, faqat hali ko'chmagan zadachalar qo'shiladi. amoCRM'ning o'zi o'zgarmaydi.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-ink-600">
              Shu kundan boshlab kelgan lidlar qoladi:{" "}
              <input type="date" className="input ml-1 inline-block w-auto py-1 text-sm" value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary py-1.5" disabled={busy || working} onClick={() => void call("preview")}>
              {doc.previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Oldin ko'rish
            </button>
            <button type="button" className="btn-primary py-1.5" disabled={busy || working || !p} onClick={run}>
              Bajarish
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {doc.error && <p className="text-xs text-rose-600">Oxirgi urinish xato bilan tugadi: {doc.error}</p>}
          {doc.state === "running" && pr && pr.total > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(pr.done / pr.total) * 100}%` }} />
            </div>
          )}
          {doc.state === "done" && doc.result && !p && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
              ✅ {when(doc.finished_at)} · {doc.by}: {doc.result.tasks} ta zadacha ko'chdi ({doc.result.created} ta yangi lid, {doc.result.linked} tasi bor lidga{doc.result.reopened ? `, ${doc.result.reopened} tasi qayta ochildi` : ""}); {doc.result.closed} ta eski lid yopildi, ularning {doc.result.cancelled} ta zadachasi bekor qilindi.
            </p>
          )}
          {p && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Ko'chadigan zadacha", p.tasksToMove],
                  ["Yangi lid ochiladi", p.leadsCreate],
                  ["Yopiladigan eski lid", p.leadsClose],
                  ["Qoladigan yangi lid", p.leadsKeepNew],
                ].map(([label, n]) => (
                  <div key={String(label)} className="rounded-xl border border-ink-100 bg-surface px-3 py-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
                    <div className="font-display text-xl font-extrabold text-ink-900">{n}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-600">
                amoCRM'da ochiq zadacha: {p.amoOpenTasks} · avval ko'chgan {p.tasksAlready} · bor lidga bog'lanadi {p.leadsLink}
                {p.leadsReopen ? ` (${p.leadsReopen} tasi qayta ochiladi)` : ""} · kontaktdagi zadacha {p.tasksOnContacts} va yopilgan bitimdagi {p.tasksOnClosedDeals} — ko'chmaydi · yopiladigan lidlarning {p.tasksCancel} ta ochiq zadachasi bekor bo'ladi · {when(p.at)} holati
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Counts title="Zadachalar kimga" items={p.byUser} />
                <Counts title="Yopiladigan lidlar bosqichi" items={p.closeByStatus.map((c) => ({ ...c, label: STATUS[c.label] || c.label }))} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Counts({ title, items }: { title: string; items: Count[] }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-500">{title}</div>
      {items.length ? (
        items.map((i) => (
          <div key={i.label} className="flex justify-between border-b border-ink-100 py-1 text-xs last:border-0">
            <span className="truncate text-ink-700">{i.label}</span>
            <b className="tabular-nums text-ink-900">{i.n}</b>
          </div>
        ))
      ) : (
        <p className="text-xs text-ink-400">—</p>
      )}
    </div>
  );
}
