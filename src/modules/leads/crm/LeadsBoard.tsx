import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ListChecks, Loader2, Plus, Search, X } from "lucide-react";
import { formatMoneyShort } from "../../../lib/format";
import {
  CRM_COLUMNS,
  boardStats,
  columnOf,
  dueLabel,
  matchesLead,
  needsTask,
  nextTask,
  taskState,
  type CrmColumn,
} from "../../../lib/crm";
import { moveToColumn } from "../../../lib/crmService";
import type { Lead } from "../../../lib/types";
import { useCrm } from "./useCrm";
import NewLeadModal from "./NewLeadModal";
import LostModal from "./LostModal";
import TaskList from "./TaskList";

// Sotuv bo'limi → «Lidlar»: the ERP's own amoCRM-like board — a column per
// stage, cards with the next task, drag a card to move it.
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "—";

export default function LeadsBoard() {
  const navigate = useNavigate();
  const { leads, tasks, orders, sellers, actor, isAdmin, email, error } = useCrm();
  const [view, setView] = useState<"board" | "tasks">("board");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string>(isAdmin ? "" : email);
  const [problems, setProblems] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CrmColumn | null>(null);
  const [lost, setLost] = useState<Lead | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const mine = useMemo(() => (leads || []).filter((l) => (!owner || l.assigned_to_email === owner) && matchesLead(l, q)), [leads, owner, q]);
  const myTasks = useMemo(() => tasks.filter((t) => !owner || t.assigned_to_email === owner), [tasks, owner]);
  const stats = useMemo(() => boardStats(mine, myTasks, orders), [mine, myTasks, orders]);
  const byCol = useMemo(() => {
    const m = new Map<CrmColumn, Lead[]>();
    for (const c of CRM_COLUMNS) m.set(c.key, []);
    for (const l of mine) {
      const c = columnOf(l, orders);
      if (!c) continue;
      const nt = nextTask(myTasks, l.id);
      const problem = (needsTask(c) && !nt) || (nt && taskState(nt) === "late");
      if (problems && !problem) continue;
      m.get(c)!.push(l);
    }
    for (const list of m.values()) list.sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
    return m;
  }, [mine, myTasks, orders, problems]);

  const drop = async (col: CrmColumn) => {
    const lead = (leads || []).find((l) => l.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!lead || columnOf(lead, orders) === col) return;
    if (col !== "new" && col !== "accepted" && col !== "info_given" && col !== "offer" && !lead.converted_order_id) {
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
    return (
      <div className="flex justify-center py-16 text-ink-500">
        {error ? <span className="text-sm text-rose-600">{error}</span> : <Loader2 className="h-6 w-6 animate-spin" />}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Lidlar</h1>
          <p className="text-sm text-ink-500">Lid, bosqich, zadacha — ERP ichida. Kartani sudrab keyingi bosqichga o'tkazing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-ink-200 bg-surface p-1">
            <button type="button" onClick={() => setView("board")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "board" ? "bg-ink-900 text-white" : "text-ink-500"}`}>
              Voronka
            </button>
            <button type="button" onClick={() => setView("tasks")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "tasks" ? "bg-ink-900 text-white" : "text-ink-500"}`}>
              <ListChecks className="mr-1 inline h-4 w-4" />
              Zadachalar {stats.tasksToday + stats.late > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-xs text-white">{stats.tasksToday + stats.late}</span>}
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Yangi lid
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi n={stats.newToday} label="bugun yangi lid" />
        <Kpi n={stats.tasksToday} label="zadacha bugunga" />
        <Kpi n={stats.late} label="muddati o'tgan zadacha" red />
        <Kpi n={stats.noTask} label="zadachasiz ochiq lid" red />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 sm:max-w-xs">
          <Search className="h-4 w-4 text-ink-400" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Ism, brend, telefon, LID…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Tozalash">
              <X className="h-4 w-4 text-ink-400" />
            </button>
          )}
        </label>
        <select className="input w-auto py-2" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Hamma menejerlar</option>
          {sellers.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
          {!isAdmin && !sellers.some((s) => s.email === email) && <option value={email}>Mening lidlarim</option>}
        </select>
        <button
          type="button"
          onClick={() => setProblems(!problems)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold ${problems ? "border-rose-300 bg-rose-50 text-rose-700" : "border-ink-200 bg-surface text-ink-600"}`}
        >
          <AlertTriangle className="h-4 w-4" /> Faqat muammolilar
        </button>
      </div>
      {msg && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{msg}</div>}

      {view === "tasks" ? (
        <TaskList tasks={myTasks} leads={leads} actor={actor} />
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="grid min-w-[1180px] grid-cols-7 gap-2.5 px-1">
            {CRM_COLUMNS.map((c) => {
              const list = byCol.get(c.key) || [];
              const sum = list.reduce((s, l) => s + (l.converted_order_id ? orders[l.converted_order_id]?.total_amount || 0 : Number(l.estimated_amount) || 0), 0);
              return (
                <div
                  key={c.key}
                  className={`flex min-h-[420px] flex-col rounded-2xl bg-ink-100/70 p-2 transition dark:bg-ink-800/40 ${overCol === c.key ? "ring-2 ring-brand-500" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(c.key);
                  }}
                  onDragLeave={() => setOverCol((x) => (x === c.key ? null : x))}
                  onDrop={() => void drop(c.key)}
                >
                  <div className="mb-1 flex items-center justify-between border-b-[3px] px-1 pb-1.5" style={{ borderColor: c.color }}>
                    <span className="text-xs font-bold text-ink-900">{c.label}</span>
                    <span className="text-xs text-ink-500">{list.length}</span>
                  </div>
                  <div className="px-1 pb-1.5 text-[11px] text-ink-500">{sum ? formatMoneyShort(sum) : "—"}</div>
                  <div className="flex-1 space-y-1.5">
                    {list.map((l) => {
                      const nt = nextTask(myTasks, l.id);
                      const st = nt ? taskState(nt) : null;
                      const order = l.converted_order_id ? orders[l.converted_order_id] : null;
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={() => setDragId(l.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => navigate(`/leads/${l.id}`)}
                          className={`cursor-pointer rounded-xl bg-surface p-2.5 text-xs shadow-sm ring-1 ring-ink-100 transition hover:ring-brand-300 dark:ring-ink-700 ${dragId === l.id ? "opacity-50" : ""} ${busy === l.id ? "animate-pulse" : ""}`}
                        >
                          <div className="truncate text-[13px] font-bold text-ink-900">{l.brand ? `«${l.brand}»` : l.full_name || l.phone || l.lead_number}</div>
                          <div className="truncate text-ink-500">
                            {order ? `→ ${order.order_number || "buyurtma"}` : [l.full_name && l.brand ? l.full_name : "", (l.product_types || []).join(", ") || l.interested_product_name].filter(Boolean).join(" · ") || (l.brand || l.full_name ? l.phone : l.source) || ""}
                          </div>
                          {(l.tags || []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(l.tags || []).slice(0, 3).map((t) => (
                                <span key={t} className="rounded bg-indigo-50 px-1.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center justify-between">
                            {nt ? (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${st === "late" ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
                                {dueLabel(nt)}
                              </span>
                            ) : needsTask(c.key) ? (
                              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">zadacha yo'q</span>
                            ) : (
                              <span />
                            )}
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" title={l.assigned_to_name}>
                              {initials(l.assigned_to_name || "")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {!list.length && <div className="px-1 py-4 text-center text-[11px] text-ink-400">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {dragId && (
            <div
              className="mt-2 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700 dark:bg-rose-900/20"
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
      )}

      {adding && <NewLeadModal onClose={() => setAdding(false)} sellers={sellers} actor={actor} isAdmin={isAdmin} onCreated={(id) => navigate(`/leads/${id}`)} />}
      {lost && <LostModal lead={lost} tasks={tasks.filter((t) => t.lead_id === lost.id && t.status === "open")} actor={actor} onClose={() => setLost(null)} />}
    </div>
  );
}

function Kpi({ n, label, red }: { n: number; label: string; red?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-surface px-4 py-3">
      <div className={`font-display text-2xl font-extrabold ${red && n > 0 ? "text-rose-600" : "text-ink-900"}`}>{n}</div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}
