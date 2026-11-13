import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { listRange } from "../../../lib/firestoreDb";
import { formatMoneyShort } from "../../../lib/format";
import {
  columnLabel,
  columnOf,
  dueLabel,
  isOldLead,
  nextTask,
  taskDueAt,
  type CrmColumn,
} from "../../../lib/crm";
import {
  crmDash,
  managerRows,
  periodSpans,
  talkLabel,
  talkSeconds,
  type CallRow,
  type PeriodKind,
} from "../../../lib/crmDash";
import type { Actor } from "../../../lib/crmService";
import type { Lead, LeadTask, Order } from "../../../lib/types";
import { TaskRow } from "./TaskList";

// Sotuv bo'limi → «Lidlar (ERP)» → Bosh sahifa: amoCRM's dashboard, our way.
// Every tile opens the leads, tasks or calls behind its number.
type Props = {
  leads: Lead[];
  tasks: LeadTask[];
  orders: Record<
    string,
    Pick<Order, "status" | "order_number" | "total_amount" | "created_at">
  >;
  sellers: { email: string; name: string }[];
  actor: Actor;
  isAdmin: boolean;
  email: string;
};

type Drawer = {
  title: string;
  leads?: Lead[];
  tasks?: LeadTask[];
  calls?: CallRow[];
};

const PERIODS: [PeriodKind, string][] = [
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Hafta"],
  ["month", "Oy"],
  ["custom", "Davr"],
];
const prevLabel: Record<PeriodKind, string> = {
  today: "kechagidan",
  yesterday: "o'tgan kundan",
  week: "o'tgan haftadan",
  month: "o'tgan oydan",
  custom: "oldingi davrdan",
};
const SOURCE_COLORS = [
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#94a3b8",
];
const LOSS_RED = new Set([
  "Narx qimmat",
  "Raqobatchi tanlandi",
  "Sifat yoqmadi",
  "Qadriyatimizga tushmadi",
]);
const ymd = (ms: number) =>
  new Date(ms + 5 * 3600e3).toISOString().slice(0, 10);

export default function CrmHome({
  leads,
  tasks,
  orders,
  sellers,
  actor,
  isAdmin,
  email,
}: Props) {
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [custom, setCustom] = useState({
    from: ymd(Date.now() - 6 * 86400e3),
    to: ymd(Date.now()),
  });
  const [owner, setOwner] = useState(isAdmin ? "" : email);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [tick, setTick] = useState(0);
  const [drawer, setDrawer] = useState<Drawer | null>(null);

  // A fresh «now» every two minutes, so overdue tasks and today's calls move on.
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 120_000);
    return () => window.clearInterval(t);
  }, []);
  // Only «Bugun» keeps moving; a past period is read once.
  const live = period === "today" ? tick : 0;
  const spans = useMemo(
    () => periodSpans(period, Date.now(), custom),
    [period, custom, live],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Calls are ~400 a day, so only the period's own are read (no comparison).
  useEffect(() => {
    let alive = true;
    listRange<CallRow>(
      "calls",
      "created_at",
      new Date(spans.cur.from).toISOString(),
      new Date(spans.cur.to).toISOString(),
    )
      .then((rows) => alive && setCalls(rows))
      .catch(() => alive && setCalls([]));
    return () => {
      alive = false;
    };
  }, [spans]);

  const input = {
    leads,
    tasks,
    calls,
    orders,
    cur: spans.cur,
    prev: spans.prev,
  };
  const d = useMemo(
    () => crmDash({ ...input, owner }),
    [leads, tasks, calls, orders, spans, owner],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(
    () => (isAdmin ? managerRows(sellers, input) : []),
    [isAdmin, sellers, leads, tasks, calls, orders, spans],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const staffName = useMemo(
    () => new Map(sellers.map((s) => [s.email, s.name])),
    [sellers],
  );
  const vs = prevLabel[period];
  const leadsBy = (f: (l: Lead) => boolean) =>
    leads.filter((l) => !owner || l.assigned_to_email === owner).filter(f);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Seg items={PERIODS} value={period} onChange={setPeriod} />
          {period === "custom" && (
            <span className="flex items-center gap-1.5 text-sm">
              <input
                type="date"
                className="input w-auto py-1.5"
                value={custom.from}
                max={custom.to}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
              —
              <input
                type="date"
                className="input w-auto py-1.5"
                value={custom.to}
                min={custom.from}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </span>
          )}
        </div>
        {isAdmin && (
          <Seg
            items={[
              ["", "Hammasi"],
              ...sellers.map(
                (s) => [s.email, s.name.split(/\s+/)[0]] as [string, string],
              ),
            ]}
            value={owner}
            onChange={setOwner}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          tone="red"
          icon={<AlarmClock className="h-4 w-4" />}
          label="Muddati o'tgan zadachalar"
          value={d.lateTasks.length}
          sub={
            d.lateTasks.length
              ? `eng eskisi ${dueLabel(d.lateTasks.reduce((a, b) => (taskDueAt(a) < taskDueAt(b) ? a : b)))}`
              : "hammasi o'z vaqtida"
          }
          onClick={() =>
            setDrawer({
              title: "Muddati o'tgan zadachalar",
              tasks: d.lateTasks,
            })
          }
        />
        <Tile
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Bajarilgan zadachalar"
          value={d.doneTasks.length}
          sub={<Delta n={d.doneDelta} vs={vs} />}
          onClick={() =>
            setDrawer({ title: "Bajarilgan zadachalar", tasks: d.doneTasks })
          }
        />
        <Tile
          tone="blue"
          icon={<ClipboardList className="h-4 w-4" />}
          label="Bugun bajarilishi kerak"
          value={d.todayTasks.length}
          sub="bugun qolgan zadachalar"
          onClick={() =>
            setDrawer({ title: "Bugun bajarilishi kerak", tasks: d.todayTasks })
          }
        />
        <Tile
          tone="orange"
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Zadachasiz lidlar"
          value={d.noTaskLeads.length}
          sub="ochiq lid, keyingi qadam yo'q"
          onClick={() =>
            setDrawer({ title: "Zadachasiz lidlar", leads: d.noTaskLeads })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Yangi lidlar"
          value={d.newLeads.length}
          sub={
            <>
              <Delta n={d.newDelta} vs={vs} /> · {d.newFromCalls} tasi
              qo'ng'iroqdan
            </>
          }
          onClick={() =>
            setDrawer({ title: "Yangi lidlar", leads: d.newLeads })
          }
        />
        <Tile
          label="Qo'ng'iroqlar"
          value={d.calls.length}
          sub={
            <>
              <PhoneIncoming className="inline h-3 w-3" /> {d.callsIn} ·{" "}
              <PhoneOutgoing className="inline h-3 w-3" /> {d.callsOut}
              {d.missed > 0 && (
                <span className="font-semibold text-rose-600">
                  {" "}
                  · {d.missed} javobsiz
                </span>
              )}
            </>
          }
          onClick={() => setDrawer({ title: "Qo'ng'iroqlar", calls: d.calls })}
        />
        <Tile
          label="Gaplashilgan vaqt"
          value={talkLabel(d.talk)}
          sub={
            <>
              {d.talks} ta suhbat ≥30 s
              {d.talks > 0 &&
                ` · o'rtacha ${talkLabel(Math.round(d.talk / d.talks))}`}
            </>
          }
          onClick={() =>
            setDrawer({
              title: "Gaplashilgan qo'ng'iroqlar",
              calls: d.calls.filter((c) => talkSeconds(c) > 0),
            })
          }
        />
        <Tile
          label="Buyurtmaga aylandi"
          value={d.won.length}
          sub={
            <>
              {d.wonSum ? formatMoneyShort(d.wonSum) : "—"} · {d.lost.length} ta
              yo'qotildi
            </>
          }
          onClick={() =>
            setDrawer({ title: "Buyurtmaga aylangan lidlar", leads: d.won })
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        {isAdmin && (
          <Card title="Menejerlar" hint="qatorni bossangiz o'sha menejer">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-2">Menejer</th>
                    <th className="px-2 text-right">Yangi lid</th>
                    <th className="px-2 text-right">Qo'ng'iroq</th>
                    <th className="px-2 text-right">Gaplashdi</th>
                    <th className="px-2 text-right">Zadacha ✓</th>
                    <th className="px-2 text-right">O'tgan</th>
                    <th className="px-2 text-right">Zadachasiz</th>
                    <th className="pl-2">Ochiq lidlar</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => {
                    const max = Math.max(1, ...rows.map((x) => x.open));
                    return (
                      <tr
                        key={r.email}
                        onClick={() =>
                          setOwner(owner === r.email ? "" : r.email)
                        }
                        className={`cursor-pointer border-b border-ink-50 hover:bg-ink-50 ${owner === r.email ? "bg-brand-50 dark:bg-brand-900/20" : ""}`}
                      >
                        <td className="py-2 pr-2 font-semibold text-ink-900">
                          {r.name}
                        </td>
                        <td className="px-2 text-right">{r.newLeads}</td>
                        <td className="px-2 text-right">{r.calls}</td>
                        <td className="px-2 text-right">{talkLabel(r.talk)}</td>
                        <td className="px-2 text-right">{r.done}</td>
                        <td
                          className={`px-2 text-right ${r.late ? "font-bold text-rose-600" : ""}`}
                        >
                          {r.late}
                        </td>
                        <td
                          className={`px-2 text-right ${r.noTask ? "font-bold text-orange-600" : ""}`}
                        >
                          {r.noTask}
                        </td>
                        <td className="pl-2">
                          <div className="text-xs text-ink-700">
                            {r.open}
                            {r.openSum > 0 &&
                              ` · ${formatMoneyShort(r.openSum)}`}
                          </div>
                          <div className="mt-1 h-1.5 rounded bg-ink-100">
                            <div
                              className="h-full rounded bg-brand-500"
                              style={{ width: `${(r.open / max) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Qo'ng'iroq va gaplashish — Mois Zvonki'dan, menejer raqami ulangan
              qo'ng'iroqlar.
            </p>
          </Card>
        )}
        <Card title="Lid manbalari" hint={`${d.newLeads.length} ta yangi lid`}>
          <Donut
            items={d.sources}
            onPick={(label) =>
              setDrawer({
                title: `Manba: ${label}`,
                leads: d.newLeads.filter(
                  (l) => (l.source || "Boshqa") === label,
                ),
              })
            }
          />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Voronka" hint="hozir">
          <Bars
            items={d.funnel.map((f) => ({
              label: f.label,
              n: f.n,
              color: f.color,
            }))}
            onPick={(label) => {
              const key = d.funnel.find((f) => f.label === label)
                ?.key as CrmColumn;
              setDrawer({
                title: `Bosqich: ${label}`,
                leads: leadsBy(
                  (l) => columnOf(l, orders) === key && !isOldLead(l),
                ),
              });
            }}
          />
        </Card>
        <Card title="Qo'ng'iroqlar soat bo'yicha">
          <Hours hours={d.hours} />
        </Card>
        <Card title="Nega yo'qotildi">
          {d.lostReasons.length ? (
            <Bars
              items={d.lostReasons.map((r) => ({
                label: r.label,
                n: r.n,
                color: LOSS_RED.has(r.label) ? "#f43f5e" : "#94a3b8",
              }))}
              onPick={(label) =>
                setDrawer({
                  title: `Yo'qotildi: ${label}`,
                  leads: d.lost.filter(
                    (l) => (l.lost_reason || "Sababsiz") === label,
                  ),
                })
              }
            />
          ) : (
            <p className="py-6 text-center text-sm text-ink-400">
              Bu davrda yo'qotilgan lid yo'q
            </p>
          )}
        </Card>
      </div>

      {drawer && (
        <Modal
          open
          onClose={() => setDrawer(null)}
          title={drawer.title}
          description={
            drawer.leads
              ? `${drawer.leads.length} ta lid`
              : drawer.tasks
                ? `${drawer.tasks.length} ta zadacha`
                : `${drawer.calls?.length || 0} ta qo'ng'iroq`
          }
          size="lg"
        >
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {drawer.tasks &&
              (drawer.tasks.length ? (
                [...drawer.tasks]
                  .sort((a, b) => taskDueAt(a) - taskDueAt(b))
                  .map((t) =>
                    t.status === "open" ? (
                      <div key={t.id}>
                        <LeadLine
                          lead={leads.find((l) => l.id === t.lead_id)}
                          orders={orders}
                          tasks={tasks}
                          onGo={() => setDrawer(null)}
                          small
                        />
                        <TaskRow
                          task={t}
                          lead={leads.find((l) => l.id === t.lead_id)}
                          actor={actor}
                          late={Date.now() > taskDueAt(t)}
                          compact
                        />
                      </div>
                    ) : (
                      <div
                        key={t.id}
                        className="rounded-xl border border-ink-200 p-3 text-sm"
                      >
                        <LeadLine
                          lead={leads.find((l) => l.id === t.lead_id)}
                          orders={orders}
                          tasks={tasks}
                          onGo={() => setDrawer(null)}
                          small
                        />
                        <div className="text-ink-700">✓ {t.result || "—"}</div>
                        <div className="text-xs text-ink-400">
                          {t.assigned_to_name} ·{" "}
                          {t.completed_at
                            ? new Date(t.completed_at).toLocaleString("uz-UZ", {
                                timeZone: "Asia/Tashkent",
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>
                    ),
                  )
              ) : (
                <Empty />
              ))}
            {drawer.leads &&
              (drawer.leads.length ? (
                drawer.leads.map((l) => (
                  <LeadLine
                    key={l.id}
                    lead={l}
                    orders={orders}
                    tasks={tasks}
                    onGo={() => setDrawer(null)}
                  />
                ))
              ) : (
                <Empty />
              ))}
            {drawer.calls &&
              (drawer.calls.length ? (
                [...drawer.calls]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((c) => {
                    const lead = c.lead_id
                      ? leads.find((l) => l.id === c.lead_id)
                      : undefined;
                    const sec = talkSeconds(c);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-ink-200 px-3 py-2 text-sm"
                      >
                        <span className="w-12 text-xs text-ink-500">
                          {new Date(
                            c.start_time || c.created_at,
                          ).toLocaleTimeString("uz-UZ", {
                            timeZone: "Asia/Tashkent",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={
                            c.direction === "in"
                              ? "text-sky-600"
                              : "text-indigo-600"
                          }
                        >
                          {c.direction === "in" ? "↙ kiruvchi" : "↗ chiquvchi"}
                        </span>
                        {lead ? (
                          <Link
                            to={`/leads/${lead.id}`}
                            onClick={() => setDrawer(null)}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            {lead.brand || lead.full_name || lead.phone}
                          </Link>
                        ) : (
                          <span className="text-ink-700">
                            {c.client_name || c.phone}
                          </span>
                        )}
                        <span
                          className={
                            c.answered
                              ? "text-ink-500"
                              : "font-semibold text-rose-600"
                          }
                        >
                          {c.answered ? talkLabel(sec) : "javobsiz"}
                        </span>
                        <span className="text-xs text-ink-400">
                          {(c.staff_email && staffName.get(c.staff_email)) ||
                            ""}
                        </span>
                        {c.recording_url && (
                          <audio
                            className="ml-auto h-8 max-w-[220px]"
                            controls
                            preload="none"
                            src={c.recording_url}
                          />
                        )}
                      </div>
                    );
                  })
              ) : (
                <Empty />
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Seg<T extends string>({
  items,
  value,
  onChange,
}: {
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-ink-200 bg-surface p-0.5">
      {items.map(([k, label]) => (
        <button
          key={k || "all"}
          type="button"
          onClick={() => onChange(k)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${value === k ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  red: "text-rose-600 bg-rose-50 dark:bg-rose-900/30",
  green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
  blue: "text-brand-600 bg-brand-50 dark:bg-brand-900/30",
  orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/30",
} as const;

function Tile({
  label,
  value,
  sub,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: ReactNode;
  tone?: keyof typeof TONES;
  icon?: ReactNode;
  onClick: () => void;
}) {
  const zero = value === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-2xl border border-ink-100 bg-surface px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {icon && (
        <span
          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg ${tone ? TONES[tone] : ""}`}
        >
          {icon}
        </span>
      )}
      <div className="pr-9 text-[10.5px] font-bold uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-3xl font-extrabold leading-none ${tone && !zero ? TONES[tone].split(" ")[0] : "text-ink-900"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-ink-500">{sub}</div>}
    </button>
  );
}

function Delta({ n, vs }: { n: number; vs: string }) {
  if (!n) return <span>{vs} o'zgarmadi</span>;
  return (
    <span>
      <b className={n > 0 ? "text-emerald-600" : "text-rose-600"}>
        {n > 0 ? `+${n}` : n}
      </b>{" "}
      {vs}
    </span>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-4">
      <h3 className="mb-3 font-display text-sm font-extrabold text-ink-900">
        {title}{" "}
        {hint && (
          <span className="ml-1 font-sans text-xs font-normal text-ink-500">
            {hint}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Bars({
  items,
  onPick,
}: {
  items: { label: string; n: number; color: string }[];
  onPick: (label: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-1">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          onClick={() => onPick(i.label)}
          className="grid w-full grid-cols-[120px_1fr_32px] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-ink-50"
        >
          <span className="truncate text-ink-700">{i.label}</span>
          <span className="h-3.5 rounded bg-ink-100">
            <span
              className="block h-full rounded"
              style={{
                width: `${(i.n / max) * 100}%`,
                background: i.color,
                minWidth: i.n ? 4 : 0,
              }}
            />
          </span>
          <b className="text-right tabular-nums text-ink-900">{i.n}</b>
        </button>
      ))}
    </div>
  );
}

function Donut({
  items,
  onPick,
}: {
  items: { label: string; n: number }[];
  onPick: (label: string) => void;
}) {
  const total = items.reduce((s, i) => s + i.n, 0);
  if (!total)
    return (
      <p className="py-6 text-center text-sm text-ink-400">
        Bu davrda yangi lid yo'q
      </p>
    );
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        width="130"
        height="130"
        viewBox="0 0 42 42"
        role="img"
        aria-label="Lid manbalari"
      >
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          className="stroke-ink-100"
          strokeWidth="6"
        />
        {items.map((i, k) => {
          const pct = (i.n / total) * 100;
          const el = (
            <circle
              key={i.label}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={SOURCE_COLORS[k % SOURCE_COLORS.length]}
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={25 - acc}
            />
          );
          acc += pct;
          return el;
        })}
        <text
          x="21"
          y="23.5"
          textAnchor="middle"
          fontSize="8"
          fontWeight="800"
          className="fill-ink-900"
        >
          {total}
        </text>
      </svg>
      <div className="min-w-[150px] flex-1 space-y-0.5">
        {items.map((i, k) => (
          <button
            key={i.label}
            type="button"
            onClick={() => onPick(i.label)}
            className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-ink-50"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: SOURCE_COLORS[k % SOURCE_COLORS.length] }}
            />
            <span className="text-ink-700">{i.label}</span>
            <b className="ml-auto tabular-nums text-ink-900">{i.n}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function Hours({ hours }: { hours: number[] }) {
  const from = 8;
  const to = 20;
  const slice = hours.slice(from, to + 1);
  const max = Math.max(1, ...slice);
  if (!slice.some(Boolean))
    return (
      <p className="py-6 text-center text-sm text-ink-400">Qo'ng'iroq yo'q</p>
    );
  return (
    <div className="flex h-36 items-end gap-1">
      {slice.map((n, k) => (
        <div
          key={k}
          className="flex flex-1 flex-col items-center gap-1"
          title={`${from + k}:00 — ${n} ta`}
        >
          <span className="text-[9px] tabular-nums text-ink-500">
            {n || ""}
          </span>
          <div
            className="w-full rounded-t bg-brand-500"
            style={{ height: `${(n / max) * 100}px` }}
          />
          <span className="text-[10px] text-ink-500">{from + k}</span>
        </div>
      ))}
    </div>
  );
}

function LeadLine({
  lead,
  orders,
  tasks,
  onGo,
  small,
}: {
  lead?: Lead;
  orders: Props["orders"];
  tasks: LeadTask[];
  onGo: () => void;
  small?: boolean;
}) {
  if (!lead)
    return small ? null : (
      <div className="text-sm text-ink-400">Lid topilmadi</div>
    );
  const col = columnOf(lead, orders);
  const nt = nextTask(tasks, lead.id);
  return (
    <Link
      to={`/leads/${lead.id}`}
      onClick={onGo}
      className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${small ? "mb-1 px-1 text-xs" : "rounded-xl border border-ink-200 px-3 py-2 text-sm hover:border-brand-300"}`}
    >
      <span className="font-bold text-brand-700">
        {lead.brand
          ? `«${lead.brand}»`
          : lead.full_name || lead.phone || lead.lead_number}
      </span>
      {!small && lead.brand && lead.full_name && (
        <span className="text-ink-600">{lead.full_name}</span>
      )}
      <span className="text-ink-500">{lead.phone}</span>
      <span className="rounded bg-ink-100 px-1.5 text-[11px] text-ink-600">
        {col
          ? columnLabel(col)
          : lead.status === "lost"
            ? `yo'qotildi${lead.lost_reason ? ": " + lead.lost_reason : ""}`
            : "—"}
      </span>
      {!small &&
        (nt ? (
          <span className="text-xs text-emerald-700">{dueLabel(nt)}</span>
        ) : col && ["new", "accepted", "info_given", "offer"].includes(col) ? (
          <span className="text-xs font-semibold text-orange-600">
            zadacha yo'q
          </span>
        ) : null)}
      <span className="ml-auto text-xs text-ink-400">
        {lead.assigned_to_name || "biriktirilmagan"}
      </span>
    </Link>
  );
}

const Empty = () => (
  <p className="py-6 text-center text-sm text-ink-400">Hech narsa yo'q</p>
);
