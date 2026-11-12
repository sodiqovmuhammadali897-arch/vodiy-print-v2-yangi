import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Phone, Plus, RotateCcw, Save, XCircle } from "lucide-react";
import { subscribeOne, subscribeWhere } from "../../../lib/firestoreDb";
import { formatDateTime, formatMoney } from "../../../lib/format";
import {
  BUSINESS_TYPES,
  CRM_COLUMNS,
  CRM_SOURCES,
  CRM_TASK_TYPES,
  CUSTOMER_TYPES,
  MANUAL_COLUMNS,
  ORDER_VOLUMES,
  PAYMENT_TYPES_CRM,
  PRODUCT_TYPES,
  REGIONS,
  columnOf,
  needsTask,
  taskDueAt,
  taskState,
  type CrmColumn,
} from "../../../lib/crm";
import { addLeadNote, addLeadTask, moveToColumn, reopenLead, updateCrmLead } from "../../../lib/crmService";
import type { Lead, LeadActivity } from "../../../lib/types";
import { useCrm } from "./useCrm";
import LostModal from "./LostModal";
import { TaskRow } from "./TaskList";

// One lead: its stage, fields (amoCRM's), timeline and tasks.
const tashToday = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const FIELDS: (keyof Lead)[] = ["full_name", "phone", "brand", "telegram", "assigned_to_email", "customer_type", "source", "region", "industry", "product_types", "order_volume", "estimated_amount", "payment_type", "ready_date", "address", "tags", "note"];

export default function LeadPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { tasks, orders, sellers, actor, isAdmin } = useCrm();
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [acts, setActs] = useState<LeadActivity[]>([]);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [note, setNote] = useState("");
  const [nt, setNt] = useState({ type: "call", date: tashToday(), time: "", note: "" });
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => subscribeOne<Lead>("leads", id, (l) => setLead(l)), [id]);
  useEffect(() => subscribeWhere<LeadActivity>("lead_activities", "lead_id", id, setActs), [id]);
  useEffect(() => {
    if (lead) setForm(Object.fromEntries(FIELDS.map((k) => [k, lead[k]])) as Partial<Lead>);
  }, [lead]);

  const myTasks = useMemo(() => tasks.filter((t) => t.lead_id === id), [tasks, id]);
  const open = useMemo(() => myTasks.filter((t) => t.status === "open").sort((a, b) => taskDueAt(a) - taskDueAt(b)), [myTasks]);
  const done = useMemo(() => myTasks.filter((t) => t.status === "done").sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))).slice(0, 5), [myTasks]);
  const timeline = useMemo(() => [...acts].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), [acts]);

  if (lead === undefined)
    return (
      <div className="flex justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (lead === null) return <div className="card p-8 text-center text-sm text-ink-500">Lid topilmadi.</div>;

  const col = columnOf(lead, orders);
  const order = lead.converted_order_id ? orders[lead.converted_order_id] : null;
  const dirty = FIELDS.some((k) => JSON.stringify(form[k] ?? "") !== JSON.stringify(lead[k] ?? ""));
  const set = (patch: Partial<Lead>) => setForm((f) => ({ ...f, ...patch }));
  const title = lead.brand ? `«${lead.brand}»` : lead.full_name || lead.phone || lead.lead_number || "Lid";

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bo'lmadi");
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const o = sellers.find((s) => s.email === form.assigned_to_email);
      await updateCrmLead(lead.id, { ...form, estimated_amount: Number(form.estimated_amount) || 0, ...(o ? { assigned_to_name: o.name } : {}) });
    }, "Saqlandi");
  const move = (c: CrmColumn) =>
    run(async () => {
      if (!MANUAL_COLUMNS.includes(c) && !lead.converted_order_id && !window.confirm("Yutildimi? Mijoz va buyurtma qoralamasi ochiladi.")) return;
      const r = await moveToColumn(lead, c, actor);
      if (r.orderId && !lead.converted_order_id) navigate(`/orders/${r.orderId}/edit`);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/leads?v=lidlar" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> Lidlar · {lead.lead_number}
          </Link>
          <h1 className="mt-0.5 truncate font-display text-2xl font-bold text-ink-900">
            {title}
            {lead.interested_product_name && <span className="ml-2 text-lg font-semibold text-ink-500">— {lead.interested_product_name}</span>}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <a className="btn-secondary" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
              <Phone className="h-4 w-4" /> Qo'ng'iroq qilish
            </a>
          )}
          {lead.status === "lost" ? (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void run(() => reopenLead(lead, actor))}>
              <RotateCcw className="h-4 w-4" /> Qayta ochish
            </button>
          ) : (
            !lead.converted_order_id && (
              <button type="button" className="btn-secondary text-rose-600" onClick={() => setLost(true)}>
                <XCircle className="h-4 w-4" /> Yo'qotildi
              </button>
            )
          )}
          {lead.converted_order_id ? (
            <Link to={`/orders/${lead.converted_order_id}`} className="btn-primary">
              Buyurtma {order?.order_number || ""} →
            </Link>
          ) : (
            lead.status !== "lost" && (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void move("advance")}>
                <CheckCircle2 className="h-4 w-4" /> Yutildi → buyurtma
              </button>
            )
          )}
        </div>
      </div>

      {lead.status === "lost" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
          Yo'qotilgan — sabab: <b>{lead.lost_reason || "—"}</b>
          {lead.lost_comment ? ` (${lead.lost_comment})` : ""}
        </div>
      ) : (
        <div className="flex overflow-x-auto">
          {CRM_COLUMNS.map((c, i) => {
            const idx = CRM_COLUMNS.findIndex((x) => x.key === col);
            const state = i < idx ? "done" : i === idx ? "cur" : "next";
            return (
              <button
                key={c.key}
                type="button"
                disabled={busy || c.key === col}
                onClick={() => void move(c.key)}
                className={`min-w-[120px] flex-1 px-3 py-2 text-center text-xs font-semibold transition ${state === "cur" ? "bg-brand-600 text-white" : state === "done" ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" : "bg-ink-100 text-ink-500 hover:bg-ink-200 dark:bg-ink-800"}`}
                style={{ clipPath: "polygon(0 0, 94% 0, 100% 50%, 94% 100%, 0 100%, 6% 50%)" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      {msg && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr_330px]">
        <section className="card space-y-2.5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-ink-900">Mijoz va lid</h3>
            {dirty && (
              <button type="button" className="btn-primary py-1 text-xs" disabled={busy} onClick={() => void save()}>
                <Save className="h-3.5 w-3.5" /> Saqlash
              </button>
            )}
          </div>
          <Txt label="Ism" v={form.full_name} on={(v) => set({ full_name: v })} />
          <Txt label="Telefon" v={form.phone} on={(v) => set({ phone: v })} />
          <Txt label="Brend nomi" v={form.brand} on={(v) => set({ brand: v })} />
          <Txt label="Telegram" v={form.telegram} on={(v) => set({ telegram: v })} />
          {isAdmin ? (
            <Sel label="Mas'ul" v={form.assigned_to_email} on={(v) => set({ assigned_to_email: v })} options={sellers.map((s) => [s.email, s.name] as [string, string])} />
          ) : (
            <Row label="Mas'ul">{lead.assigned_to_name || "—"}</Row>
          )}
          <Sel label="Mijoz turi" v={form.customer_type} on={(v) => set({ customer_type: v })} options={CUSTOMER_TYPES} />
          <Sel label="Manba" v={form.source} on={(v) => set({ source: v })} options={CRM_SOURCES} />
          <Sel label="Viloyat" v={form.region} on={(v) => set({ region: v })} options={REGIONS} />
          <Sel label="Biznes turi" v={form.industry} on={(v) => set({ industry: v })} options={BUSINESS_TYPES} />
          <Multi label="Mahsulot turi" v={form.product_types || []} on={(v) => set({ product_types: v })} options={PRODUCT_TYPES} />
          <Sel label="Buyurtma hajmi" v={form.order_volume} on={(v) => set({ order_volume: v })} options={ORDER_VOLUMES} />
          <Txt label="Taxminiy summa" v={form.estimated_amount ? String(form.estimated_amount) : ""} on={(v) => set({ estimated_amount: Number(v.replace(/\D/g, "")) || 0 })} />
          <Sel label="To'lov turi" v={form.payment_type} on={(v) => set({ payment_type: v })} options={PAYMENT_TYPES_CRM} />
          <Row label="Tayyor bo'lish">
            <input type="date" className="input py-1" value={form.ready_date || ""} onChange={(e) => set({ ready_date: e.target.value || null })} />
          </Row>
          <Txt label="Manzil" v={form.address} on={(v) => set({ address: v })} />
          <Row label="Teglar">
            <input className="input py-1" placeholder="vergul bilan: korporativ, Namangan" value={(form.tags || []).join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          </Row>
          <Row label="Izoh">
            <textarea className="input min-h-[60px] py-1" value={form.note || ""} onChange={(e) => set({ note: e.target.value })} />
          </Row>
          {order && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
              Buyurtma: <b>{order.order_number}</b> · {formatMoney(order.total_amount || 0)}
            </div>
          )}
        </section>

        <section className="card p-4">
          <h3 className="mb-2 font-display text-sm font-bold text-ink-900">Tarix</h3>
          <div className="flex gap-2">
            <textarea className="input min-h-[52px] flex-1" placeholder="Izoh yozing…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              type="button"
              className="btn-primary self-end"
              disabled={busy || !note.trim()}
              onClick={() =>
                void run(async () => {
                  await addLeadNote(lead.id, note, actor);
                  setNote("");
                })
              }
            >
              Qo'shish
            </button>
          </div>
          <div className="mt-3 divide-y divide-ink-100">
            {timeline.map((a) => (
              <div key={a.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium text-ink-900">
                    {a.kind === "call" ? `📞 ${a.call_direction === "in" ? "Kiruvchi" : "Chiquvchi"} qo'ng'iroq${a.call_answered === false ? " — javobsiz" : a.call_duration_seconds ? ` · ${Math.floor(a.call_duration_seconds / 60)} daq ${a.call_duration_seconds % 60} s` : ""}` : a.text}
                  </span>
                  <span className="text-xs text-ink-400">
                    {formatDateTime(a.created_at)} · {a.actor_name}
                  </span>
                </div>
                {a.kind === "call" && a.call_recording_url && <audio controls preload="none" src={a.call_recording_url} className="mt-1.5 h-8 w-full" />}
              </div>
            ))}
            {!timeline.length && <div className="py-6 text-center text-sm text-ink-400">Hali yozuv yo'q.</div>}
          </div>
        </section>

        <section className="order-first space-y-3 xl:order-none">
          {needsTask(col) && !open.length && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-900 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-200">
              ⚠ Bu lidda zadacha yo'q. Har bir ochiq lidda keyingi qadam (zadacha) bo'lishi shart.
            </div>
          )}
          <div className="card space-y-2 p-4">
            <h3 className="font-display text-sm font-bold text-ink-900">Zadachalar</h3>
            {open.map((t) => (
              <TaskRow key={t.id} task={t} actor={actor} late={taskState(t) === "late"} compact />
            ))}
            {addingTask ? (
              <div className="space-y-2 rounded-xl border border-brand-200 p-3">
                <select className="input py-1.5" value={nt.type} onChange={(e) => setNt({ ...nt, type: e.target.value })}>
                  {CRM_TASK_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="input py-1.5" value={nt.date} onChange={(e) => setNt({ ...nt, date: e.target.value })} />
                  <input type="time" className="input py-1.5" value={nt.time} onChange={(e) => setNt({ ...nt, time: e.target.value })} />
                </div>
                <input className="input py-1.5" placeholder="Nima qilish kerak (ixtiyoriy)" value={nt.note} onChange={(e) => setNt({ ...nt, note: e.target.value })} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1 py-1.5"
                    disabled={busy || !nt.date}
                    onClick={() =>
                      void run(async () => {
                        await addLeadTask(lead, nt.type, nt.date, nt.time, nt.note.trim(), actor);
                        setAddingTask(false);
                        setNt({ type: "call", date: tashToday(), time: "", note: "" });
                      })
                    }
                  >
                    Qo'yish
                  </button>
                  <button type="button" className="btn-secondary py-1.5" onClick={() => setAddingTask(false)}>
                    Bekor
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary w-full justify-center" onClick={() => setAddingTask(true)}>
                <Plus className="h-4 w-4" /> Zadacha qo'shish
              </button>
            )}
            {done.length > 0 && (
              <div className="pt-2">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Bajarilganlar</div>
                {done.map((t) => (
                  <div key={t.id} className="border-t border-ink-100 py-1.5 text-xs text-ink-600">
                    ✓ {t.result || "—"} <span className="text-ink-400">· {formatDateTime(t.completed_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      {lost && <LostModal lead={lead} tasks={open} actor={actor} onClose={() => setLost(false)} />}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
      <span className="text-ink-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
function Txt({ label, v, on }: { label: string; v?: string; on: (v: string) => void }) {
  return (
    <Row label={label}>
      <input className="input py-1" value={v || ""} onChange={(e) => on(e.target.value)} />
    </Row>
  );
}
function Sel({ label, v, on, options }: { label: string; v?: string; on: (v: string) => void; options: (string | [string, string])[] }) {
  const opts = options.map((o) => (Array.isArray(o) ? o : ([o, o] as [string, string])));
  return (
    <Row label={label}>
      <select className="input py-1" value={v || ""} onChange={(e) => on(e.target.value)}>
        <option value="">—</option>
        {v && !opts.some(([k]) => k === v) && <option value={v}>{v}</option>}
        {opts.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </Row>
  );
}
function Multi({ label, v, on, options }: { label: string; v: string[]; on: (v: string[]) => void; options: string[] }) {
  return (
    <Row label={label}>
      <div className="flex flex-wrap gap-1">
        {v.map((x) => (
          <button key={x} type="button" className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-200" onClick={() => on(v.filter((y) => y !== x))} title="Olib tashlash">
            {x} ✕
          </button>
        ))}
        <select className="input w-auto py-0.5 text-xs" value="" onChange={(e) => e.target.value && on([...v, e.target.value])}>
          <option value="">+ qo'shish</option>
          {options
            .filter((o) => !v.includes(o))
            .map((o) => (
              <option key={o}>{o}</option>
            ))}
        </select>
      </div>
    </Row>
  );
}
