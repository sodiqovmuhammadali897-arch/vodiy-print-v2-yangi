// The ERP CRM's home page (the owner, 2026-11-13: «amoCRM'dagi bosh sahifa
// kabi»): today's tasks, leads without a task, talk minutes, sources,
// funnel, why leads were lost — for a period and one manager or all.
// Pure helpers; the page is src/modules/leads/crm/CrmHome.tsx.
import {
  CRM_COLUMNS,
  columnOf,
  isOldLead,
  needsTask,
  taskState,
  type CrmColumn,
} from "./crm";
import type { Lead, LeadTask, Order } from "./types";

// A call as the server writes it to `calls` (meta-webhook/server.js).
export type CallRow = {
  id: string;
  lead_id?: string | null;
  phone?: string;
  client_name?: string;
  direction?: "in" | "out";
  answered?: boolean;
  duration_seconds?: number;
  recording_url?: string;
  start_time?: string | null;
  answer_time?: string | null;
  end_time?: string | null;
  staff_email?: string;
  created_at: string;
};

export type PeriodKind = "today" | "yesterday" | "week" | "month" | "custom";
export type Span = { from: number; to: number }; // epoch ms, [from, to)

const DAY = 86400e3;
const TZ = 5 * 3600e3; // Tashkent
const midnight = (ms: number) => Math.floor((ms + TZ) / DAY) * DAY - TZ;
const dayStart = (ymd: string) => Date.parse(`${ymd}T00:00:00+05:00`);

// The period and the one it is compared with. A running period (today,
// this week, this month) is compared with the same stretch before it:
// today until now ↔ yesterday until the same hour.
export function periodSpans(
  kind: PeriodKind,
  now = Date.now(),
  custom?: { from: string; to: string },
): { cur: Span; prev: Span } {
  const today = midnight(now);
  if (kind === "yesterday")
    return {
      cur: { from: today - DAY, to: today },
      prev: { from: today - 2 * DAY, to: today - DAY },
    };
  if (kind === "custom" && custom?.from && custom?.to) {
    const from = dayStart(custom.from);
    const to = dayStart(custom.to) + DAY;
    return { cur: { from, to }, prev: { from: from - (to - from), to: from } };
  }
  if (kind === "week") {
    const dow = (new Date(today + TZ).getUTCDay() + 6) % 7; // Monday = 0
    const from = today - dow * DAY;
    return {
      cur: { from, to: now },
      prev: { from: from - 7 * DAY, to: now - 7 * DAY },
    };
  }
  if (kind === "month") {
    const d = new Date(today + TZ);
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - TZ;
    const prevFrom = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) - TZ;
    return {
      cur: { from, to: now },
      prev: { from: prevFrom, to: Math.min(from, prevFrom + (now - from)) },
    };
  }
  return {
    cur: { from: today, to: now },
    prev: { from: today - DAY, to: now - DAY },
  };
}

export const inSpan = (iso: string | null | undefined, s: Span) => {
  const t = iso ? Date.parse(iso) : NaN;
  return t >= s.from && t < s.to;
};

// Seconds actually spoken: answer → end, else the call's duration.
export function talkSeconds(
  c: Pick<
    CallRow,
    "answered" | "answer_time" | "end_time" | "duration_seconds"
  >,
): number {
  if (!c.answered) return 0;
  const a = c.answer_time ? Date.parse(c.answer_time) : NaN;
  const e = c.end_time ? Date.parse(c.end_time) : NaN;
  if (e > a) return Math.round((e - a) / 1000);
  return Math.max(0, Number(c.duration_seconds) || 0);
}

// "2 s 14 d", "47 daq", "40 s" — talk time on a tile.
export function talkLabel(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} daq`;
  return `${Math.floor(m / 60)} s ${m % 60} d`;
}

// Tashkent hour of a call (9 for 09:xx).
export const callHour = (c: Pick<CallRow, "start_time" | "created_at">) =>
  new Date(Date.parse(c.start_time || c.created_at) + TZ).getUTCHours();

type OrderLite = Pick<Order, "status" | "total_amount" | "created_at">;

export type DashInput = {
  leads: Lead[];
  tasks: LeadTask[];
  calls: CallRow[]; // the calls of the current period (calls are many: no comparison)
  orders: Record<string, OrderLite>;
  owner: string; // "" = everyone
  cur: Span;
  prev: Span;
  now?: number;
};

export type ManagerRow = {
  email: string;
  name: string;
  newLeads: number;
  calls: number;
  talk: number;
  done: number;
  late: number;
  noTask: number;
  open: number;
  openSum: number;
};

export function crmDash({
  leads,
  tasks,
  calls,
  orders,
  owner,
  cur,
  prev,
  now = Date.now(),
}: DashInput) {
  const mine = <T extends { assigned_to_email?: string }>(r: T) =>
    !owner || r.assigned_to_email === owner;
  const live = leads.filter((l) => !isOldLead(l));
  const myLeads = live.filter(mine);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  // Tasks on the old (hidden) leads are not counted either.
  const myTasks = tasks.filter(
    (t) =>
      mine(t) &&
      !(leadById.get(t.lead_id) && isOldLead(leadById.get(t.lead_id)!)),
  );
  const open = myTasks.filter((t) => t.status === "open");
  const lateTasks = open.filter((t) => taskState(t, now) === "late");
  const todayTasks = open.filter((t) => taskState(t, now) === "today");
  const doneIn = (s: Span) =>
    myTasks.filter((t) => t.status === "done" && inSpan(t.completed_at, s));
  const withTask = new Set(open.map((t) => t.lead_id));
  const col = (l: Lead) => columnOf(l, orders);
  const noTaskLeads = myLeads.filter(
    (l) => needsTask(col(l)) && !withTask.has(l.id),
  );
  const newIn = (s: Span) => myLeads.filter((l) => inSpan(l.created_at, s));
  const myCalls = (s: Span) =>
    calls.filter(
      (c) => inSpan(c.created_at, s) && (!owner || c.staff_email === owner),
    );
  const wonIn = (s: Span) =>
    myLeads.filter(
      (l) =>
        l.converted_order_id &&
        orders[l.converted_order_id] &&
        orders[l.converted_order_id].status !== "cancelled" &&
        inSpan(orders[l.converted_order_id].created_at, s),
    );
  const lostIn = (s: Span) =>
    myLeads.filter((l) => l.status === "lost" && inSpan(l.updated_at, s));

  const callsCur = myCalls(cur);
  const talk = (list: CallRow[]) =>
    list.reduce((s, c) => s + talkSeconds(c), 0);
  const won = wonIn(cur);

  const count = <T>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, number>();
    for (const x of list) m.set(key(x), (m.get(key(x)) || 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, n]) => ({ label, n }));
  };

  const funnel = CRM_COLUMNS.filter((c) => c.key !== "delivered").map((c) => ({
    key: c.key as CrmColumn,
    label: c.label,
    color: c.color,
    n: myLeads.filter((l) => col(l) === c.key).length,
  }));

  const hours: number[] = Array.from({ length: 24 }, () => 0);
  for (const c of callsCur) hours[callHour(c)]++;

  return {
    lateTasks,
    todayTasks,
    doneTasks: doneIn(cur),
    doneDelta: doneIn(cur).length - doneIn(prev).length,
    noTaskLeads,
    newLeads: newIn(cur),
    newDelta: newIn(cur).length - newIn(prev).length,
    newFromCalls: newIn(cur).filter((l) => l.source === "Telefon").length,
    calls: callsCur,
    callsIn: callsCur.filter((c) => c.direction === "in").length,
    callsOut: callsCur.filter((c) => c.direction === "out").length,
    missed: callsCur.filter((c) => c.direction === "in" && !c.answered).length,
    talk: talk(callsCur),
    talks: callsCur.filter((c) => talkSeconds(c) >= 30).length,
    won,
    wonSum: won.reduce(
      (s, l) => s + (Number(orders[l.converted_order_id!]?.total_amount) || 0),
      0,
    ),
    lost: lostIn(cur),
    sources: count(newIn(cur), (l) => l.source || "Boshqa"),
    lostReasons: count(lostIn(cur), (l) => l.lost_reason || "Sababsiz"),
    funnel,
    hours,
  };
}

// One row per seller: the period's work and what is waiting now.
export function managerRows(
  sellers: { email: string; name: string }[],
  input: Omit<DashInput, "owner">,
): ManagerRow[] {
  return sellers.map((s) => {
    const d = crmDash({ ...input, owner: s.email });
    const openLeads = input.leads.filter(
      (l) =>
        !isOldLead(l) &&
        l.assigned_to_email === s.email &&
        needsTask(columnOf(l, input.orders)),
    );
    return {
      email: s.email,
      name: s.name,
      newLeads: d.newLeads.length,
      calls: d.calls.length,
      talk: d.talk,
      done: d.doneTasks.length,
      late: d.lateTasks.length,
      noTask: d.noTaskLeads.length,
      open: openLeads.length,
      openSum: openLeads.reduce(
        (sum, l) => sum + (Number(l.estimated_amount) || 0),
        0,
      ),
    };
  });
}
