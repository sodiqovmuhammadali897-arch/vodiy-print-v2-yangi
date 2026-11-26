import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { formatMoneyShort } from "../../../lib/format";
import { exportCsv } from "../../../lib/exportCsv";
import { listAll } from "../../../lib/firestoreDb";
import { sectionLabel } from "../../../lib/crmSettings";
import { reopenFromBase, type Actor } from "../../../lib/crmService";
import { BASE_GROUPS, CSV_HEADERS, EMPTY_FILTER, baseCounts, baseManagers, baseYears, csvRows, dealLabel, groupInfo, matchesBase, sortBase, type BaseFilter } from "../../../lib/crmBase";
import type { BaseDeal, Lead } from "../../../lib/types";
import type { CrmData } from "./useCrm";
import { useBase } from "./useBase";
import { useLeadHref } from "./leadLink";
import AmoBaseCard from "./AmoBaseCard";
import CustomerPanel from "./CustomerPanel";

// Sotuv bo'limi → «Mijozlar bazasi» (2026-11-26; owner: «yopilgan, qimmat
// degan hamma lidlar to'planadigan baza»; «managerlar ham umumiyni ko'ra
// olsin»). One row per customer (phone) with every closed deal; «Qayta
// ishlash» makes it a new lead with a task. src/lib/crmBase.ts has the rules.
const PAGE = 100;
const day = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const TILES = ["price", "competitor", "no_answer", "cancelled", "won"];

export default function BasePage({ crm, isOwner }: { crm: CrmData; isOwner: boolean }) {
  const { rows, error, reload, patch } = useBase();
  const navigate = useNavigate();
  const leadHref = useLeadHref();
  const [f, setF] = useState<BaseFilter>(EMPTY_FILTER);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const all = rows || [];
  const counts = useMemo(() => baseCounts(all), [all]);
  const managers = useMemo(() => baseManagers(all), [all]);
  const years = useMemo(() => baseYears(all), [all]);
  const list = useMemo(() => sortBase(all.filter((c) => matchesBase(c, f))), [all, f]);
  const set = (p: Partial<BaseFilter>) => {
    setF((cur) => ({ ...cur, ...p }));
    setShown(PAGE);
  };

  // Who gets the lead: a manager takes it for themselves; an admin picks.
  const target = (): Actor | null => {
    if (!crm.isAdmin) return crm.actor;
    const s = crm.sellers.find((x) => x.email === to);
    return s ? { email: s.email, name: s.name } : null;
  };
  const reopen = async (ids: string[]) => {
    const t = target();
    if (!t) return setMsg("Avval «Kimga beriladi»dan managerni tanlang.");
    setBusy(ids.length > 1 ? "bulk" : ids[0]);
    setMsg(null);
    try {
      const leads = await listAll<Lead>("leads");
      let made = 0;
      let had = 0;
      let lastId = "";
      for (const id of ids) {
        const c = all.find((x) => x.id === id);
        if (!c) continue;
        const r = await reopenFromBase(c, t, crm.actor, leads);
        lastId = r.leadId;
        if (r.existing) had++;
        else {
          made++;
          patch(c.id, { reopened: { count: (c.reopened?.count || 0) + 1, last_at: new Date().toISOString(), lead_id: r.leadId, by_name: crm.actor.name, to_name: t.name } });
        }
      }
      setPicked(new Set());
      if (ids.length === 1 && lastId) {
        setOpen(null);
        if (had) setMsg("Bu raqamda ochiq lid bor — o'sha ochildi.");
        navigate(leadHref(lastId));
      } else setMsg(`${made} ta mijoz ${t.name}ga lid bo'lib berildi («Qayta aloqa» zadachasi bilan)${had ? `; ${had} tasida ochiq lid bor edi` : ""}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bo'lmadi");
    } finally {
      setBusy(null);
    }
  };
  const toggle = (id: string) =>
    setPicked((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{sectionLabel("baza")}</h1>
          <p className="max-w-3xl text-sm text-ink-500">Yopilgan hamma lidlar bir joyda: ERP'da yo'qotilganlar va amoCRM arxivi. Bir raqamning hamma bitimi bitta mijozda — kim gaplashgan, nega yopilgan, nima so'ragan.</p>
        </div>
        <button type="button" className="btn-secondary" disabled={!list.length} onClick={() => exportCsv(`mijozlar-bazasi-${new Date().toISOString().slice(0, 10)}`, CSV_HEADERS, csvRows(list))}>
          <Download className="h-4 w-4" /> Excel
        </button>
      </div>

      {isOwner && <AmoBaseCard empty={rows !== null && !rows.length} onDone={() => void reload()} />}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Tile label="Hammasi" value={counts.all || 0} hint="mijoz" on={!f.group} tone="text-ink-900" onClick={() => set({ group: "" })} />
        {TILES.map((k) => {
          const g = groupInfo(k);
          return <Tile key={k} label={g.label} value={counts[k] || 0} hint={g.hint} on={f.group === k} tone={g.tone} onClick={() => set({ group: f.group === k ? "" : k })} />;
        })}
      </div>

      {msg && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{msg}</div>}

      <div className="rounded-2xl border border-ink-100 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input w-auto min-w-[220px] py-1.5" placeholder="Ism, brend, raqam yoki mahsulot" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          {BASE_GROUPS.filter((g) => !TILES.includes(g.key) && counts[g.key]).map((g) => (
            <button key={g.key} type="button" onClick={() => set({ group: f.group === g.key ? "" : g.key })} className={`rounded-full px-3 py-1 text-xs font-semibold ${f.group === g.key ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"}`}>
              {g.label} {counts[g.key]}
            </button>
          ))}
          <select className="input w-auto py-1.5 text-sm" value={f.source} onChange={(e) => set({ source: e.target.value as BaseFilter["source"] })}>
            <option value="">Manba: hammasi</option>
            <option value="amo">amoCRM arxivi</option>
            <option value="erp">ERP</option>
          </select>
          <select className="input w-auto py-1.5 text-sm" value={f.manager} onChange={(e) => set({ manager: e.target.value })}>
            <option value="">Manager: hammasi</option>
            {managers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-sm" value={f.year} onChange={(e) => set({ year: e.target.value })}>
            <option value="">Yopilgan: hammasi</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
            <input type="checkbox" checked={f.fresh} onChange={(e) => set({ fresh: e.target.checked })} /> Qayta ishlanmaganlar
          </label>
        </div>

        {crm.isAdmin && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm dark:border-brand-800 dark:bg-brand-900/20">
            <span className="font-semibold text-ink-700">Kimga beriladi:</span>
            <select className="input w-auto py-1 text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">— tanlang —</option>
              {crm.sellers.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.name}
                </option>
              ))}
            </select>
            {picked.size > 0 && (
              <>
                <span className="text-ink-600">{picked.size} ta tanlandi</span>
                <button type="button" className="btn-primary py-1 text-xs" disabled={!!busy} onClick={() => void reopen([...picked])}>
                  {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Lid qilib berish
                </button>
                <button type="button" className="text-xs text-ink-500 hover:underline" onClick={() => setPicked(new Set())}>
                  bekor
                </button>
              </>
            )}
          </div>
        )}

        {rows === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-ink-100/70" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-600">{error}</p>
        ) : !list.length ? (
          <p className="py-10 text-center text-sm text-ink-500">{all.length ? "Topilmadi" : isOwner ? "Baza hali bo'sh — yuqoridagi «amoCRM arxivini ko'chirish»ni bosing. ERP'da yo'qotilgan lidlar o'zi tushadi." : "Baza hali bo'sh."}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500">
                  {crm.isAdmin && (
                    <th className="w-8 px-2 py-1.5">
                      <input type="checkbox" aria-label="Hammasini tanlash" checked={picked.size > 0 && list.slice(0, shown).every((c) => picked.has(c.id))} onChange={(e) => setPicked(e.target.checked ? new Set(list.slice(0, shown).map((c) => c.id)) : new Set())} />
                    </th>
                  )}
                  <th className="px-2 py-1.5 font-semibold">Mijoz</th>
                  <th className="px-2 py-1.5 font-semibold">Telefon</th>
                  <th className="px-2 py-1.5 font-semibold">Oxirgi natija</th>
                  <th className="px-2 py-1.5 font-semibold">Yopilgan</th>
                  <th className="px-2 py-1.5 font-semibold">Kim</th>
                  <th className="px-2 py-1.5 font-semibold">Mahsulot</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Summa</th>
                  <th className="px-2 py-1.5 font-semibold">Tarix</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {list.slice(0, shown).map((c) => {
                  const g = groupInfo(c.last?.group || "none");
                  const products = [...new Set(c.deals.map((d) => d.product).filter(Boolean))].join(", ");
                  const isOpen = open === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr className={`cursor-pointer hover:bg-ink-50/60 ${isOpen ? "bg-ink-50/60" : ""}`} onClick={() => setOpen(isOpen ? null : c.id)}>
                        {crm.isAdmin && (
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label="Tanlash" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                          </td>
                        )}
                        <td className="max-w-[220px] px-2 py-2">
                          <div className="truncate font-semibold text-ink-900">{c.brand ? `«${c.brand}»` : c.name || "Ismsiz"}</div>
                          <div className="truncate text-xs text-ink-500">{[c.brand ? c.name : "", c.region].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums" onClick={(e) => e.stopPropagation()}>
                          <a className="text-ink-700 hover:text-brand-700 hover:underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>
                            {c.phone}
                          </a>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.cls}`}>{dealLabel({ status: c.last?.status as BaseDeal["status"], reason: c.last?.reason || "", group: c.last?.group || "" })}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-600">{day(c.last?.closed_at)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-600">{c.last?.manager_name || "—"}</td>
                        <td className="max-w-[180px] truncate px-2 py-2 text-xs text-ink-600">{products || "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-700">{c.sum ? formatMoneyShort(c.sum) : "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-500">
                          {c.deals.length} bitim{c.calls_count ? ` · 📞 ${c.calls_count}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {c.reopened?.count ? (
                            <button type="button" className="mr-2 text-[11px] text-ink-500 hover:underline" onClick={() => navigate(leadHref(c.reopened!.lead_id))} title="Oxirgi ochilgan lid">
                              ↺ {c.reopened.count} marta · {day(c.reopened.last_at)}
                              {c.reopened.to_name ? ` · ${c.reopened.to_name}` : ""}
                            </button>
                          ) : null}
                          <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-200" disabled={!!busy} onClick={() => void reopen([c.id])}>
                            {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Qayta ishlash
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {list.length > shown && (
              <div className="pt-3 text-center">
                <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => setShown((n) => n + PAGE)}>
                  Yana {Math.min(PAGE, list.length - shown)} ta · jami {list.length}
                </button>
              </div>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-400">«Qayta ishlash» — mijoz yangi lid bo'lib «Qabul qilindi»ga tushadi, «Qayta aloqa» zadachasi qo'yiladi, eski tarixi lid kartasida ko'rinadi. Shu raqamda ochiq lid bo'lsa, ikkinchisi ochilmaydi.</p>
      </div>
      {open && all.find((x) => x.id === open) && (
        <CustomerPanel
          c={all.find((x) => x.id === open)!}
          names={Object.fromEntries(crm.sellers.map((x) => [x.email, x.name]))}
          busy={busy === open}
          onClose={() => setOpen(null)}
          onReopen={() => void reopen([open])}
        />
      )}
    </div>
  );
}

function Tile({ label, value, hint, on, tone, onClick }: { label: string; value: number; hint: string; on: boolean; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border-2 bg-surface px-4 py-3 text-left transition hover:shadow-sm ${on ? "border-brand-500" : "border-transparent ring-1 ring-ink-100"}`}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-3xl font-extrabold leading-none ${value ? tone : "text-ink-900"}`}>{value.toLocaleString("ru-RU")}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </button>
  );
}

// Every closed deal of a customer, newest first (also on the lead card).
export function History({ deals }: { deals: BaseDeal[] }) {
  return (
    <ol className="space-y-1.5">
      {deals.map((d) => {
        const g = groupInfo(d.group);
        return (
          <li key={d.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
            <span className="w-20 shrink-0 tabular-nums text-ink-500">{day(d.closed_at)}</span>
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${g.cls}`}>{dealLabel(d)}</span>
            <span className="text-ink-700">{d.manager_name || "—"}</span>
            {d.product && <span className="text-ink-500">· {d.product}</span>}
            {d.price ? <span className="tabular-nums text-ink-500">· {formatMoneyShort(d.price)}</span> : null}
            <span className={`rounded px-1.5 text-[10px] font-bold ${d.source === "amo" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>{d.source === "amo" ? "amoCRM" : "ERP"}</span>
            {d.title && <span className="text-ink-400">{d.title}</span>}
            {d.comment && <span className="basis-full text-ink-500">«{d.comment}»</span>}
          </li>
        );
      })}
    </ol>
  );
}
