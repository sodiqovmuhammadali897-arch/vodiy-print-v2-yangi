import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Search, X } from "lucide-react";
import { CRM_COLUMNS, columnOf, dueLabel, isOldLead, matchesLead, needsTask, nextTask, taskState, type CrmColumn } from "../../../lib/crm";
import { boardCounts, cardDate, passes, type BoardFilter, type BoardRow } from "../../../lib/boardFilters";
import { claimLead, moveToColumn } from "../../../lib/crmService";
import { sectionLabel } from "../../../lib/crmSettings";
import { formatMoney } from "../../../lib/format";
import type { Lead } from "../../../lib/types";
import type { CrmData } from "./useCrm";
import { useLeadHref } from "./leadLink";
import NewLeadModal from "./NewLeadModal";
import LostModal from "./LostModal";

// Sotuv bo'limi → Jarayon in a calm amoCRM-like look (2026-11-28, the owner:
// «bizda ranglar juda ko'p, ko'zga noqulay; amoda minimalizm; tepada bugungi
// zadacha, o'tib ketganlar — bosganda chiqadi; mijoz kartasi kattaroq»).
// Admins first («avval manga adminga ko'rinsin»); managers keep LeadsBoard.
// One plain dark ground (the «Fon» picture is not used here), wide columns,
// colour only on the stage line and the task dot. The numbers on top are
// filters (lib/boardFilters.ts).

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "—";
const money = (n: number) => formatMoney(n);

// The page's ground while this board is open: one plain colour.
function usePlainGround() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main.vt-page");
    if (!main) return;
    const addedDark = !main.classList.contains("dark");
    main.classList.add("mb-solid");
    if (addedDark) main.classList.add("dark");
    return () => {
      main.classList.remove("mb-solid");
      if (addedDark) main.classList.remove("dark");
    };
  }, []);
}

export default function MinimalBoard({ crm }: { crm: CrmData }) {
  usePlainGround();
  const navigate = useNavigate();
  const leadHref = useLeadHref();
  const { leads, tasks, orders, sellers, actor, isAdmin, email, error, settingsVersion } = crm;
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string>(isAdmin ? "" : email);
  const [filter, setFilter] = useState<BoardFilter>("");
  const [showOld, setShowOld] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CrmColumn | null>(null);
  const [lost, setLost] = useState<Lead | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const myTasks = useMemo(() => tasks.filter((t) => !owner || t.assigned_to_email === owner), [tasks, owner]);
  const oldCount = useMemo(() => (leads || []).filter(isOldLead).length, [leads]);
  // Every visible lead with its column and next task (search and manager applied, not the filter).
  const rows = useMemo(() => {
    const out: (BoardRow & { lead: Lead })[] = [];
    for (const l of leads || []) {
      if (!showOld && isOldLead(l)) continue;
      if (owner && l.assigned_to_email !== owner && (isAdmin || l.assigned_to_email)) continue;
      if (!matchesLead(l, q)) continue;
      const col = columnOf(l, orders);
      if (!col) continue;
      out.push({ lead: l, col, created_at: l.created_at, next: nextTask(myTasks, l.id) });
    }
    return out;
  }, [leads, owner, q, showOld, isAdmin, orders, myTasks, settingsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => boardCounts(rows), [rows]);
  const valueOf = (l: Lead) => (l.converted_order_id ? orders[l.converted_order_id]?.total_amount || 0 : Number(l.estimated_amount) || 0);
  const total = useMemo(() => rows.reduce((s, r) => s + valueOf(r.lead), 0), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const forecast = useMemo(() => {
    const list = rows.filter((r) => r.col === "advance");
    return { n: list.length, sum: list.reduce((s, r) => s + valueOf(r.lead), 0) };
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const byCol = useMemo(() => {
    const m = new Map<CrmColumn, (BoardRow & { lead: Lead })[]>();
    for (const c of CRM_COLUMNS) m.set(c.key, []);
    for (const r of rows) if (passes(filter, r)) m.get(r.col!)?.push(r);
    for (const list of m.values()) list.sort((a, b) => (b.lead.updated_at || b.lead.created_at).localeCompare(a.lead.updated_at || a.lead.created_at));
    return m;
  }, [rows, filter]);
  const shown = useMemo(() => [...byCol.values()].reduce((s, l) => s + l.length, 0), [byCol]);

  const claim = async (lead: Lead) => {
    setBusy(lead.id);
    setMsg(null);
    try {
      await claimLead(lead, tasks.filter((t) => t.lead_id === lead.id && t.status === "open"), actor);
      setMsg(`«${lead.brand || lead.full_name || lead.phone}» — sizniki, «Qabul qilindi» bosqichida.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bo'lmadi");
    } finally {
      setBusy(null);
    }
  };
  const drop = async (col: CrmColumn) => {
    const lead = (leads || []).find((l) => l.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!lead || columnOf(lead, orders) === col) return;
    if (!["new", "accepted", "info_given", "offer"].includes(col) && !needsTask(col) && !lead.converted_order_id) {
      if (!window.confirm(`«${lead.full_name || lead.brand}» — yutildimi? Mijoz va buyurtma qoralamasi ochiladi.`)) return;
    }
    setBusy(lead.id);
    setMsg(null);
    try {
      const r = await moveToColumn(lead, col, actor);
      if (r.orderId && !lead.converted_order_id) setMsg("Buyurtma qoralamasi ochildi — lid kartasidan oching va mahsulotlarni kiriting.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  if (!leads)
    return <div className="flex justify-center py-16 text-[#8a9bab]">{error ? <span className="text-sm text-[#f0606a]">{error}</span> : <Loader2 className="h-6 w-6 animate-spin" />}</div>;

  const STATS: { key: BoardFilter; label: string; value: string; color: string }[] = [
    { key: "today", label: "Bugungi zadachalar", value: String(counts.today), color: "text-[#3fbf7f]" },
    { key: "notask", label: "Zadachasiz", value: String(counts.notask), color: "text-[#e8b54a]" },
    { key: "late", label: "Muddati o'tgan", value: String(counts.late), color: "text-[#f0606a]" },
    { key: "new", label: "Yangi bugun / kecha", value: `${counts.newToday} / ${counts.newYesterday}`, color: "text-[#e6edf3]" },
  ];
  const active = STATS.find((s) => s.key === filter);

  return (
    <div className="-mx-1 overflow-hidden rounded-xl border border-[#2e3e50] bg-[#18222c] text-[#e6edf3] lg:mx-0">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#2e3e50] px-4 py-3 lg:gap-5 lg:px-5">
        <h1 className="text-[15px] font-bold uppercase tracking-[0.08em]">{sectionLabel("lidlar")}</h1>
        <label className="flex min-w-[200px] flex-1 items-center gap-2 border-l border-[#2e3e50] pl-4 text-[#8a9bab] lg:max-w-md">
          <Search className="h-4 w-4 shrink-0" />
          <input className="w-full bg-transparent text-sm text-[#e6edf3] outline-none placeholder:text-[#61738a]" placeholder="Ism, brend, telefon, LID…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Tozalash">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        {isAdmin && (
          <select className="rounded-lg border border-[#2e3e50] bg-[#18222c] px-3 py-1.5 text-sm text-[#c9d6e2] outline-none" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Hamma menejerlar</option>
            {sellers.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {oldCount > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-[#8a9bab]">
            <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} /> Eski lidlar ({oldCount})
          </label>
        )}
        <div className="ml-auto text-sm text-[#8a9bab]">
          {rows.length} lid: <b className="font-semibold text-[#e6edf3]">{money(total)}</b>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#4c9ffe] px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-white hover:bg-[#3b8ef0]">
          <Plus className="h-4 w-4" /> Yangi lid
        </button>
      </div>

      {/* the numbers — each one is a filter */}
      <div className="flex flex-wrap items-end gap-x-12 gap-y-3 border-b border-[#2e3e50] px-4 pb-3.5 pt-3 lg:px-5">
        {STATS.map((s) => {
          const on = filter === s.key;
          return (
            <button key={s.key} type="button" onClick={() => setFilter(on ? "" : s.key)} className={`relative text-left ${on ? "after:absolute after:-bottom-[15px] after:left-0 after:right-0 after:h-0.5 after:bg-current" : ""} ${on ? s.color : ""}`} title={on ? "Filtrni olib tashlash" : "Faqat shu lidlarni ko'rsatish"}>
              <span className="block text-[13px] text-[#8a9bab] hover:text-[#c9d6e2]">{s.label}</span>
              <b className={`block text-[26px] font-medium tabular-nums leading-tight ${s.color}`} data-no-count>
                {s.value}
              </b>
            </button>
          );
        })}
        <div className="ml-auto text-right">
          <span className="block text-[13px] text-[#8a9bab]">Prognoz (Dizayn / avans)</span>
          <b className="block text-[22px] font-medium tabular-nums leading-tight" data-no-count>
            <span className="text-[18px] font-normal text-[#8a9bab]">{forecast.n} lid: </span>
            {money(forecast.sum)}
          </b>
        </div>
      </div>
      {(active || msg) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#2e3e50] px-4 py-2.5 text-[13px] text-[#8a9bab] lg:px-5">
          {active && (
            <>
              Ko'rsatilmoqda:
              <button type="button" onClick={() => setFilter("")} className={`inline-flex items-center gap-1.5 rounded-full border border-current px-3 py-0.5 font-semibold ${active.color}`}>
                {active.label} · {shown} <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {msg && <span className="text-[#c9d6e2]">{msg}</span>}
        </div>
      )}

      {/* board */}
      <div className="overflow-x-auto px-3 pb-4 pt-4 lg:px-5">
        <div className="flex gap-3.5">
          {CRM_COLUMNS.map((c, ci) => {
            const list = byCol.get(c.key) || [];
            const all = rows.filter((r) => r.col === c.key);
            const sum = all.reduce((s, r) => s + valueOf(r.lead), 0);
            return (
              <div
                key={c.key}
                className={`flex w-[300px] shrink-0 flex-col gap-2 rounded-lg transition ${overCol === c.key ? "bg-[#1d2935]" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(c.key);
                }}
                onDragLeave={() => setOverCol((x) => (x === c.key ? null : x))}
                onDrop={() => void drop(c.key)}
              >
                <div className="mb-1 border-b-2 pb-2 text-center" style={{ borderColor: c.color }}>
                  <b className="block text-[12.5px] font-bold uppercase tracking-[0.08em] text-[#c9d6e2]">{c.label}</b>
                  <span className="text-[13px] text-[#8a9bab]">
                    {all.length} lid{sum ? `: ${money(sum)}` : ""}
                  </span>
                </div>
                {ci === 0 && (
                  <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-dashed border-[#2e3e50] py-3 text-sm font-semibold text-[#8a9bab] hover:text-[#e6edf3]">
                    Tezkor qo'shish
                  </button>
                )}
                {list.map(({ lead: l, next: nt }) => {
                  const st = nt ? taskState(nt) : null;
                  const order = l.converted_order_id ? orders[l.converted_order_id] : null;
                  const noTask = !nt && needsTask(c.key);
                  const task = nt ? dueLabel(nt) : noTask ? "Zadacha yo'q" : "";
                  const tone = st === "late" ? "text-[#f0606a]" : noTask ? "text-[#e8b54a]" : "text-[#8a9bab]";
                  const dot = st === "late" ? "bg-[#f0606a]" : st === "today" ? "bg-[#3fbf7f]" : noTask ? "bg-[#e8b54a]" : "bg-[#61738a]";
                  const isNew = c.key === "new";
                  const title = isNew ? l.brand || l.full_name || l.phone || l.lead_number : l.full_name || l.brand || l.phone || l.lead_number;
                  const link = order ? `→ ${order.order_number || "buyurtma"}` : [isNew ? "" : l.brand, l.lead_number].filter(Boolean).join(" · ");
                  const product = (l.product_types || []).join(", ") || l.interested_product_name || "";
                  const tags = [...(l.tags || []).slice(0, 3), !isNew && l.quantity ? l.quantity : ""].filter(Boolean);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => navigate(leadHref(l.id))}
                      className={`cursor-pointer rounded-lg border border-transparent bg-[#223040] px-3.5 pb-2.5 pt-3 text-[13px] hover:border-[#3a4d63] ${dragId === l.id ? "opacity-50" : ""} ${busy === l.id ? "animate-pulse" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-2.5">
                        <b className="truncate text-[14.5px] font-semibold">{title}</b>
                        <time className="shrink-0 text-[12px] text-[#61738a]">{cardDate(l.created_at)}</time>
                      </div>
                      {link && <div className="mt-0.5 truncate text-[14px] text-[#4c9ffe]">{link}</div>}
                      {isNew && (
                        <dl className="mt-2 grid grid-cols-[78px_1fr] gap-x-2.5 gap-y-0.5">
                          {[
                            ["Ism", l.brand ? l.full_name : ""],
                            ["Nechta", l.quantity],
                            ["Mahsulot", product],
                            ["Telefon", l.phone],
                            ["Manba", l.source],
                          ]
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                              <div key={k} className="contents">
                                <dt className="text-[#61738a]">{k}</dt>
                                <dd className="truncate text-[#cdd8e3]">{v}</dd>
                              </div>
                            ))}
                        </dl>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded border border-[#2e3e50] px-1.5 text-[11.5px] text-[#8a9bab]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={`mt-2.5 flex items-center gap-2 text-[12.5px] ${tone}`}>
                        {task && <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />}
                        <span className="truncate">{task}</span>
                        {l.assigned_to_email ? (
                          <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#26364a] px-1 text-[10.5px] font-bold text-[#8a9bab]" title={l.assigned_to_name}>
                            {initials(l.assigned_to_name || "")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            title="Lidni o'zimga olaman"
                            disabled={busy === l.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void claim(l);
                            }}
                            className="ml-auto shrink-0 rounded-md border border-[#3fbf7f] px-2 py-0.5 text-[12px] font-semibold text-[#3fbf7f] hover:bg-[#3fbf7f]/10"
                          >
                            ✓ Qabul qildim
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!list.length && <div className="py-4 text-center text-xs text-[#61738a]">—</div>}
              </div>
            );
          })}
        </div>
        {dragId && (
          <div
            className="mt-3 rounded-lg border-2 border-dashed border-[#f0606a]/60 p-3 text-center text-sm font-semibold text-[#f0606a]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const l = (leads || []).find((x) => x.id === dragId) || null;
              setDragId(null);
              if (l) setLost(l);
            }}
          >
            ✕ Yo'qotildi — shu yerga tashlang
          </div>
        )}
      </div>

      {adding && <NewLeadModal onClose={() => setAdding(false)} sellers={sellers} actor={actor} isAdmin={isAdmin} onCreated={(id) => navigate(leadHref(id))} />}
      {lost && <LostModal lead={lost} tasks={tasks.filter((t) => t.lead_id === lost.id && t.status === "open")} actor={actor} onClose={() => setLost(null)} />}
    </div>
  );
}
