import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { listWhere, subscribeOne, upsertOne } from "../../../lib/firestoreDb";
import type { AmoTaskDoc } from "../../../lib/salesKpi";
import type { CrmData } from "./useCrm";

// Sotuv bo'limi → Tahlil → «amoCRM → ERP» (step 5, the owner only): the
// week in parallel. This month's task numbers side by side — amoCRM's
// (amo_tasks) and the ERP's own (erp_tasks, meta-webhook/erpTasks.js) — and
// the switch that makes the ERP the main system: the KPI's task condition
// and the 09:00 / 10:00 / 15:00 / 18:00 Telegram messages then come from
// the ERP (crm_settings/main.task_source).
type Row = { email: string; name: string; amo: AmoTaskDoc | null; erp: AmoTaskDoc | null };
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${String(x).replace(".", ",")}%`);

export default function SwitchCard({ crm }: { crm: CrmData }) {
  const auth = useAuth();
  const month = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7);
  const [source, setSource] = useState<"amo" | "erp" | null>(null);
  const [amo, setAmo] = useState<AmoTaskDoc[] | null>(null);
  const [erp, setErp] = useState<AmoTaskDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeOne<{ task_source?: string }>("crm_settings", "main", (d) => setSource(d?.task_source === "erp" ? "erp" : "amo")), []);
  useEffect(() => {
    void listWhere<AmoTaskDoc>("amo_tasks", "month", month).then(setAmo).catch(() => setAmo([]));
    void listWhere<AmoTaskDoc>("erp_tasks", "month", month).then(setErp).catch(() => setErp([]));
  }, [month]);

  const rows = useMemo((): Row[] => {
    const by = new Map<string, Row>();
    const row = (email: string, name: string) => {
      const k = email.toLowerCase();
      if (!by.has(k)) by.set(k, { email: k, name, amo: null, erp: null });
      return by.get(k)!;
    };
    for (const s of crm.sellers) row(s.email, s.name);
    for (const a of amo || []) if (a.staff_email) row(a.staff_email, a.name).amo = a;
    for (const e of erp || []) if (e.staff_email) row(e.staff_email, e.name).erp = e;
    return [...by.values()].filter((r) => r.amo || r.erp).sort((a, b) => a.name.localeCompare(b.name));
  }, [crm.sellers, amo, erp]);
  const openLeads = (email: string) => (crm.leads || []).filter((l) => l.assigned_to_email === email && l.status !== "lost" && !l.converted_order_id).length;

  const flip = async () => {
    const next = source === "erp" ? "amo" : "erp";
    const text =
      next === "erp"
        ? "ERP asosiy tizim bo'lsinmi?\n\n• KPI'dagi zadacha sharti ERP zadachalaridan hisoblanadi;\n• 09:00, 10:00, 15:00, 18:00 Telegram xabarlari ERP'dan boradi, amoCRM'niki to'xtaydi.\n\namoCRM'ning o'zi ishlayveradi, ma'lumot o'chmaydi. Istalgan payt qaytarish mumkin."
        : "amoCRM'ga qaytarilsinmi? KPI sharti va kunlik xabarlar yana amoCRM'dan bo'ladi.";
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      await upsertOne("crm_settings", "main", { task_source: next, task_source_by: auth.staff?.full_name || crm.email, task_source_at: new Date().toISOString() });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Bo'lmadi");
    }
    setBusy(false);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-ink-100 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
          <ArrowRightLeft className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">Asosiy tizim</div>
          <div className="font-display text-xl font-extrabold text-ink-900">{source === null ? "…" : source === "erp" ? "ERP" : "amoCRM"}</div>
          <div className="text-xs text-ink-500">KPI'dagi zadacha sharti va 09:00 · 10:00 · 15:00 · 18:00 Telegram xabarlari shu tizimdan olinadi.</div>
        </div>
        <button type="button" disabled={busy || source === null} onClick={() => void flip()} className={source === "erp" ? "btn-secondary" : "btn-primary"}>
          {source === "erp" ? "amoCRM'ga qaytarish" : "ERP'ni asosiy qilish"}
        </button>
      </div>

      <div>
        <h3 className="mb-1 font-display text-sm font-extrabold text-ink-900">
          Parallel hafta: shu oy zadachalari <span className="ml-1 font-sans text-xs font-normal text-ink-500">ikkala tizimda — farq katta bo'lsa, menejer qaysi birida ishlayotgani ko'rinadi</span>
        </h3>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-2 py-1.5 text-left font-semibold" rowSpan={2} />
                <th className="border-b border-ink-100 px-2 py-1 text-center font-semibold" colSpan={3}>
                  amoCRM
                </th>
                <th className="border-b border-ink-100 px-2 py-1 text-center font-semibold text-violet-700 dark:text-violet-300" colSpan={4}>
                  ERP
                </th>
              </tr>
              <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-2 py-1 text-right font-semibold">O'z vaqtida</th>
                <th className="px-2 py-1 text-right font-semibold">Kechikkan</th>
                <th className="px-2 py-1 text-right font-semibold">Zadachasiz</th>
                <th className="px-2 py-1 text-right font-semibold">O'z vaqtida</th>
                <th className="px-2 py-1 text-right font-semibold">Kechikkan</th>
                <th className="px-2 py-1 text-right font-semibold">Zadachasiz</th>
                <th className="px-2 py-1 text-right font-semibold">Ochiq lid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.email}>
                  <td className="px-2 py-1.5 font-semibold text-ink-900">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {pct(r.amo?.pct)} <span className="text-ink-400">({r.amo?.due || 0})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{r.amo?.late || 0}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.amo?.no_task_leads ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {pct(r.erp?.pct)} <span className="text-ink-400">({r.erp?.due || 0})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{r.erp?.late || 0}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.erp?.no_task_leads ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{openLeads(r.email)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-ink-400">
                    {amo === null || erp === null ? "Yuklanmoqda…" : "Bu oy hali zadacha yo'q"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Qavsda — shu oy muddati kelgan zadachalar soni. ERP raqamlari har 30 daqiqada yangilanadi. Kunga ko'chirilgan zadacha (kuni kelgandan keyin) — kechikkan hisoblanadi, amoCRM'dagidek.
        </p>
      </div>
    </section>
  );
}
