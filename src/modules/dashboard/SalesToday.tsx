import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { listRange, subscribeOne } from "../../lib/firestoreDb";
import { crmDash, periodSpans, talkLabel, type CallRow, type PeriodKind } from "../../lib/crmDash";
import { DEFAULT_TALK_TARGET_MIN, talkProgress } from "../../lib/managerHome";
import { callStats, minutes } from "../../lib/salesToday";
import { useCrm } from "../leads/crm/useCrm";
import { useContacts } from "../leads/crm/useContacts";
import { salesCalls } from "../../lib/contacts";

// The main Bosh sahifa's «Bugungi sotuv» (2026-11-26): talk time against the
// daily target, incoming and outgoing calls with minutes; the owner also gets
// the team table. The task list, missed calls, no-task leads and the weekly
// ranking were taken off on 2026-11-27 (owner: «bularni olib tashla») — tasks
// live in Sotuv bo'limi → Zadachalar, the rest in the Telegram messages.
const PERIODS: [PeriodKind, string][] = [
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Hafta"],
];

export default function SalesToday() {
  const auth = useAuth();
  const crm = useCrm();
  const me = crm.email;
  const owner = auth.isAdmin && !auth.staff?.report_manager_id;
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [who, setWho] = useState(""); // the owner's choice; "" = the team
  const email = owner ? who : me;
  const [allCalls, setCalls] = useState<CallRow[]>([]);
  // Kontaktlar' calls (office, staff, suppliers, personal) are not sales.
  const { index: contactsIndex } = useContacts();
  const calls = useMemo(() => salesCalls(allCalls, contactsIndex), [allCalls, contactsIndex]);
  const [target, setTarget] = useState(DEFAULT_TALK_TARGET_MIN);
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

  const leads = crm.leads || [];
  const ownerOf = useMemo(() => new Map(leads.map((l) => [l.id, l.assigned_to_email || ""])), [leads]);
  // A seller's calls: made or taken by them, and the missed ones on their leads.
  const mine = useMemo(
    () => (email ? calls.filter((c) => c.staff_email === email || (c.direction === "in" && !c.answered && c.lead_id && ownerOf.get(c.lead_id) === email)) : calls),
    [calls, email, ownerOf],
  );
  const st = callStats(mine);
  const talkP = talkProgress(st.talk, target);

  // The owner's table: one row per seller.
  const rows = useMemo(() => {
    if (!owner || who) return [];
    return crm.sellers.map((s) => {
      const theirs = calls.filter((c) => c.staff_email === s.email || (c.direction === "in" && !c.answered && c.lead_id && ownerOf.get(c.lead_id) === s.email));
      const cs = callStats(theirs);
      const dd = crmDash({ leads, tasks: crm.tasks, calls: theirs, orders: crm.orders, owner: s.email, cur: spans.cur, prev: spans.prev });
      return { s, cs, done: dd.doneTasks.length, left: dd.todayTasks.length, late: dd.lateTasks.length, noTask: dd.noTaskLeads.length };
    });
  }, [owner, who, crm.sellers, calls, ownerOf, leads, crm.tasks, crm.orders, spans]);

  if (!crm.leads) return <div className="h-40 animate-pulse rounded-3xl bg-ink-100/70" />;
  const name = (e: string) => crm.sellers.find((s) => s.email === e)?.name || e;
  const today = period === "today";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">{owner && !who ? "Bugungi sotuv — jamoa" : "Bugungi sotuv"}</h2>
          <p className="text-xs text-ink-500">Qo'ng'iroqlar (Mois Zvonki) — har 2 daqiqada yangilanadi. Zadachalar: Sotuv bo'limi → Zadachalar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {owner && (
            <select className="input w-auto py-1.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Kimniki">
              <option value="">Hamma menejerlar</option>
              {crm.sellers.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-xl border border-ink-200 bg-surface p-1">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPeriod(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === k ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <Label>{today ? "Bugun gaplashgan vaqt" : "Gaplashgan vaqt"}</Label>
          <Big>{talkLabel(st.talk)}</Big>
          <Sub>
            {st.talks} suhbat (30 soniyadan ko'p){st.first && today ? ` · ish boshlandi ${st.first}` : ""}
          </Sub>
          {today && email && talkP.pct !== null && (
            <>
              <Bar pct={talkP.pct} />
              <Sub>
                kunlik maqsad {talkP.target} daq · {talkP.pct}%{talkP.pct >= 100 ? " ✅" : ""}
              </Sub>
            </>
          )}
        </Card>
        <CallCard icon={<PhoneIncoming className="h-4 w-4 text-emerald-600" />} label="Kiruvchi qo'ng'iroq" n={st.in} talkMin={minutes(st.inTalk)} note={<>{st.inAnswered} javob berildi{st.inMissed ? <> · <b className="text-rose-600">{st.inMissed} javobsiz</b></> : null}</>} />
        <CallCard icon={<PhoneOutgoing className="h-4 w-4 text-brand-600" />} label="Chiquvchi qo'ng'iroq" n={st.out} talkMin={minutes(st.outTalk)} note={<>{st.outAnswered} ko'tarildi · {st.out - st.outAnswered} ko'tarmadi</>} />
      </div>

      {owner && !who && rows.length > 0 && (
        <Card>
          <h3 className="mb-2 font-display text-sm font-extrabold text-ink-900">Menejerlar — {period === "today" ? "bugun" : period === "yesterday" ? "kecha" : "bu hafta"}</h3>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-right text-[10.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-1.5 text-left font-semibold">Menejer</th>
                  <th className="px-2 py-1.5 font-semibold">Gaplashdi</th>
                  {today && <th className="px-2 py-1.5 font-semibold">Maqsad</th>}
                  <th className="px-2 py-1.5 font-semibold">Kiruvchi</th>
                  <th className="px-2 py-1.5 font-semibold">Chiquvchi</th>
                  <th className="px-2 py-1.5 font-semibold">Javobsiz</th>
                  <th className="px-2 py-1.5 font-semibold">Bajarildi</th>
                  <th className="px-2 py-1.5 font-semibold">Qoldi</th>
                  <th className="px-2 py-1.5 font-semibold">Muddati o'tgan</th>
                  <th className="px-2 py-1.5 font-semibold">Zadachasiz lid</th>
                  {today && <th className="px-2 py-1.5 font-semibold">Birinchi qo'ng'iroq</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-right tabular-nums">
                {rows.map(({ s, cs, done, left, late, noTask }) => {
                  const p = talkProgress(cs.talk, target).pct || 0;
                  return (
                    <tr key={s.email}>
                      <td className="px-2 py-1.5 text-left">
                        <button type="button" className="font-semibold text-ink-900 hover:underline" onClick={() => setWho(s.email)}>
                          {s.name}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">{talkLabel(cs.talk)}</td>
                      {today && <td className={`px-2 py-1.5 ${p >= 100 ? "font-semibold text-emerald-600" : ""}`}>{p}%</td>}
                      <td className="px-2 py-1.5">
                        {cs.in} <span className="text-ink-400">· {minutes(cs.inTalk)} daq</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {cs.out} <span className="text-ink-400">· {minutes(cs.outTalk)} daq</span>
                      </td>
                      <td className={`px-2 py-1.5 ${cs.inMissed ? "text-rose-600" : ""}`}>{cs.inMissed}</td>
                      <td className="px-2 py-1.5 text-emerald-600">{done}</td>
                      <td className="px-2 py-1.5">{left}</td>
                      <td className={`px-2 py-1.5 ${late ? "text-rose-600" : ""}`}>{late}</td>
                      <td className={`px-2 py-1.5 ${noTask ? "text-amber-600" : ""}`}>{noTask}</td>
                      {today && <td className="px-2 py-1.5">{cs.first || "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-400">Ismni bossangiz — o'sha menejerning sahifasi. Javobsiz — uning lidlariga kelgan, javob berilmagan kiruvchi qo'ng'iroqlar.</p>
        </Card>
      )}
      {owner && who && (
        <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setWho("")}>
          ← Hamma menejerlar ({name(who)} tanlangan)
        </button>
      )}
    </section>
  );
}

function CallCard({ icon, label, n, talkMin, note }: { icon: ReactNode; label: string; n: number; talkMin: number; note: ReactNode }) {
  return (
    <Card>
      <Label>
        <span className="inline-flex items-center gap-1.5">
          {icon} {label}
        </span>
      </Label>
      <div className="mt-1 flex items-end gap-6">
        <div>
          <Big>{n}</Big>
          <Sub>ta</Sub>
        </div>
        <div>
          <Big>{talkMin}</Big>
          <Sub>daqiqa gaplashildi</Sub>
        </div>
      </div>
      <Sub>{note}</Sub>
    </Card>
  );
}
const Card = ({ children }: { children: ReactNode }) => <div className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">{children}</div>;
const Label = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{children}</div>;
const Big = ({ children }: { children: ReactNode }) => <div className="mt-1 font-display text-3xl font-extrabold leading-none text-ink-900">{children}</div>;
const Sub = ({ children }: { children: ReactNode }) => <div className="mt-1.5 text-xs text-ink-500">{children}</div>;
const Bar = ({ pct }: { pct: number }) => (
  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
    <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
  </div>
);
