import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getOne, listRange, subscribeOne } from "../../../lib/firestoreDb";
import { formatMoneyShort } from "../../../lib/format";
import { crmDash, periodSpans, talkLabel, type CallRow, type PeriodKind } from "../../../lib/crmDash";
import { DEFAULT_TALK_TARGET_MIN, monthConversion, planLine, talkProgress, workDaysLeft } from "../../../lib/managerHome";
import { taskDueAt } from "../../../lib/crm";
import type { SalesKpiDoc } from "../../../lib/salesKpi";
import type { CrmData } from "./useCrm";
import { TaskRow } from "./TaskList";

// Sotuv bo'limi → Bosh sahifa, a manager's own (step 7, 2026-11-26; the
// mockup of 2026-11-13): their tasks, talk time against the daily target
// the owner sets, new leads, the month's plan from KPI, their funnel and
// conversion against the team. The owner sees it «through a manager's eyes».
const PERIODS: [PeriodKind, string][] = [
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Hafta"],
  ["month", "Oy"],
];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const pct = (x: number | null) => (x === null ? "—" : `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`);

export default function ManagerHome({ crm, email, name, managerId }: { crm: CrmData; email: string; name: string; managerId: string }) {
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [target, setTarget] = useState(DEFAULT_TALK_TARGET_MIN);
  const [plan, setPlan] = useState<{ plan: number; sales: number } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 120_000);
    return () => window.clearInterval(t);
  }, []);
  const spans = useMemo(() => periodSpans(period, Date.now()), [period, period === "today" ? tick : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    listRange<CallRow>("calls", "created_at", new Date(spans.cur.from).toISOString(), new Date(spans.cur.to).toISOString())
      .then((rows) => alive && setCalls(rows))
      .catch(() => alive && setCalls([]));
    return () => {
      alive = false;
    };
  }, [spans.cur.from, spans.cur.to]);
  useEffect(() => subscribeOne<{ talk_target_min?: number }>("crm_settings", "main", (d) => setTarget(Number(d?.talk_target_min) > 0 ? Number(d!.talk_target_min) : DEFAULT_TALK_TARGET_MIN)), []);

  // The month's plan and sales (KPI): the month's own plan, else the manager's.
  const month = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7);
  useEffect(() => {
    if (!managerId) return setPlan(null);
    let alive = true;
    void Promise.all([
      getOne<{ monthly_plan?: number }>("managers", managerId).catch(() => null),
      getOne<{ plan?: number | null }>("kpi_months", `${month}_${managerId}`).catch(() => null),
      getOne<SalesKpiDoc>("kpi_sales", `${month}_${managerId}`).catch(() => null),
    ]).then(([m, k, s]) => alive && setPlan({ plan: Number(k?.plan) || Number(m?.monthly_plan) || 0, sales: Number(s?.sales) || 0 }));
    return () => {
      alive = false;
    };
  }, [managerId, month]);

  const d = useMemo(() => crmDash({ leads: crm.leads || [], tasks: crm.tasks, calls, orders: crm.orders, owner: email, cur: spans.cur, prev: spans.prev }), [crm.leads, crm.tasks, calls, crm.orders, email, spans]);
  const conv = useMemo(() => monthConversion(crm.leads || [], crm.orders, email), [crm.leads, crm.orders, email]);
  const talkP = talkProgress(d.talk, target);
  const daysLeft = workDaysLeft();
  const pl = plan ? planLine(plan.plan, plan.sales, daysLeft) : null;
  const todo = useMemo(() => [...d.lateTasks, ...d.todayTasks].sort((a, b) => taskDueAt(a) - taskDueAt(b)), [d.lateTasks, d.todayTasks]);
  const leadById = useMemo(() => new Map((crm.leads || []).map((l) => [l.id, l])), [crm.leads]);
  const actor = crm.email === email ? crm.actor : { email, name };
  const funnel = d.funnel.filter((f) => f.key !== "delivered");
  const fmax = Math.max(1, ...funnel.map((f) => f.n));
  const now = new Date(Date.now() + 5 * 3600e3);
  const first = name.split(/\s+/)[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Assalomu alaykum, {first} 👋</h1>
          <p className="text-sm text-ink-500">
            Bugun, {now.getUTCDate()}-{MONTHS[now.getUTCMonth()]} · sizning kuningiz
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-ink-200 bg-surface p-1">
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === k ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Muddati o'tgan" value={d.lateTasks.length} tone={d.lateTasks.length ? "bad" : undefined} sub={d.lateTasks.length ? "zadacha — birinchi shularni qiling" : "hammasi o'z vaqtida"} />
        <Tile label="Bugun qilish kerak" value={d.todayTasks.length} tone="info" sub="zadacha qoldi" />
        <Tile
          label="Bajarildi"
          value={d.doneTasks.length}
          tone="good"
          sub={
            <>
              zadacha{d.doneDelta ? <> · <b className={d.doneDelta > 0 ? "text-emerald-600" : "text-rose-600"}>{d.doneDelta > 0 ? `+${d.doneDelta}` : d.doneDelta}</b> oldingidan</> : null}
            </>
          }
        />
        <Tile label="Zadachasiz lid" value={d.noTaskLeads.length} tone={d.noTaskLeads.length ? "bad" : undefined} sub={d.noTaskLeads.length ? "keyingi qadamni qo'ying" : "hammasida keyingi qadam bor"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <Label>Gaplashdim</Label>
          <div className="mt-1 font-display text-4xl font-extrabold text-ink-900">{talkLabel(d.talk)}</div>
          <div className="text-xs text-ink-500">
            {d.calls.length} qo'ng'iroq · {d.talks} suhbat (30 s+){d.missed ? <span className="text-rose-600"> · {d.missed} javobsiz</span> : null}
          </div>
          {period === "today" && talkP.pct !== null && (
            <>
              <Bar pct={talkP.pct} color="bg-brand-600" />
              <div className="mt-1 text-xs text-ink-500">
                kunlik maqsad {talkP.target} daq · {talkP.pct}%{talkP.pct >= 100 ? " ✅" : ""}
              </div>
            </>
          )}
        </Card>
        <Card>
          <Label>Yangi lidlarim</Label>
          <div className="mt-1 font-display text-4xl font-extrabold text-ink-900">{d.newLeads.length}</div>
          <div className="text-xs text-ink-500">{d.sources.length ? d.sources.slice(0, 3).map((s) => `${s.n} ${s.label}`).join(" · ") : "bu davrda yangi lid yo'q"}</div>
        </Card>
        <Card>
          <Label>Oylik reja</Label>
          {pl && pl.plan > 0 ? (
            <>
              <div className="mt-1 font-display text-4xl font-extrabold text-ink-900">{formatMoneyShort(pl.sales)}</div>
              <Bar pct={Math.min(100, pl.pct || 0)} color="bg-emerald-500" />
              <div className="mt-1 text-xs text-ink-500">
                {formatMoneyShort(pl.plan)} dan {pl.pct}%{pl.left ? ` · qoldi ${formatMoneyShort(pl.left)} · ${daysLeft} ish kuni (kuniga ~${formatMoneyShort(pl.perDay)})` : " · reja bajarildi 🎉"}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-500">{managerId ? "Bu oyga reja belgilanmagan (KPI sahifasida)." : "Profil Managerlar ro'yxatiga bog'lanmagan."}</p>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <h3 className="mb-2 font-display text-sm font-extrabold text-ink-900">Bugungi zadachalarim {todo.length ? <span className="font-sans text-xs font-normal text-ink-500">· {todo.length}</span> : null}</h3>
          {todo.length ? (
            <div className="space-y-2">
              {todo.slice(0, 12).map((t) => (
                <TaskRow key={t.id} task={t} lead={leadById.get(t.lead_id)} actor={actor} late={taskDueAt(t) < Date.now()} compact={false} />
              ))}
              {todo.length > 12 && <p className="text-xs text-ink-500">… yana {todo.length - 12} ta — Zadachalar bo'limida</p>}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-500">Bugunga zadacha qolmadi 👍</p>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 font-display text-sm font-extrabold text-ink-900">Mening voronkam</h3>
          <div className="space-y-1.5">
            {funnel.map((f) => (
              <div key={f.key} className="grid grid-cols-[110px_1fr_28px] items-center gap-2 text-xs">
                <span className="truncate text-ink-700">{f.label}</span>
                <span className="h-3.5 rounded bg-ink-100">
                  <span className="block h-full rounded" style={{ width: `${(f.n / fmax) * 100}%`, background: f.color, minWidth: f.n ? 4 : 0 }} />
                </span>
                <b className="text-right tabular-nums text-ink-900">{f.n}</b>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Bu oy: {conv.leads} lid → {conv.won} buyurtma ({pct(conv.conv)}) · jamoa o'rtachasi {pct(conv.team)}
          </p>
        </Card>
      </div>
    </div>
  );
}

const TONES = { bad: "text-rose-600 dark:text-rose-300", info: "text-brand-600 dark:text-brand-300", good: "text-emerald-600 dark:text-emerald-300" };
function Tile({ label, value, sub, tone }: { label: string; value: number; sub: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-surface px-4 py-3">
      <Label>{label}</Label>
      <div className={`mt-1 font-display text-3xl font-extrabold leading-none ${tone && value ? TONES[tone] : "text-ink-900"}`}>{value}</div>
      <div className="mt-1.5 text-xs text-ink-500">{sub}</div>
    </div>
  );
}
const Card = ({ children }: { children: ReactNode }) => <section className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-4">{children}</section>;
const Label = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{children}</div>;
const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
  </div>
);
