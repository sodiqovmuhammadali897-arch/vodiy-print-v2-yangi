import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Clock3, ExternalLink, PhoneIncoming, PhoneMissed, PhoneOutgoing, UserPlus } from "lucide-react";
import { db } from "../../lib/firebase";
import { dayRows, formatTalk, hourGrid, isLateStart, minutesSince, mmss, type AmoCall, type AmoStat } from "../../lib/amoStats";

// Qo'ng'iroqlar hisoboti: one day of calls in detail — when each manager
// started, how many people and leads they talked to, the hours they were
// on the phone, every call, today's new leads and the missed calls nobody
// returned. Numbers from amo_stats (server), the call list from amo_calls.

const HOURS = Array.from({ length: 12 }, (_, i) => String(8 + i).padStart(2, "0"));
const WEEKDAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const shiftDay = (day: string, by: number) => new Date(Date.parse(`${day}T12:00:00Z`) + by * 86400e3).toISOString().slice(0, 10);
const dayTitle = (day: string, today: string) => {
  const [, m, d] = day.split("-").map(Number);
  const label = `${d}-${["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"][m - 1]}`;
  return day === today ? `Bugun, ${label}` : day === shiftDay(today, -1) ? `Kecha, ${label}` : label;
};
const waitLabel = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} s ${String(min % 60).padStart(2, "0")} daq` : `${min} daq`);

type Props = {
  people: AmoStat[]; // this month's docs, already narrowed to the picked manager
  month: string;
  today: string;
  now: Date;
  isAdmin: boolean;
  email: string;
  host?: string;
  avatar: (name: string, user: number, size: number, live?: boolean) => ReactNode;
};

function Box({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}
function Title({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-display text-[15px] font-bold text-ink-900">{title}</h3>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}
function Tile({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${alert ? "text-rose-600 dark:text-rose-400" : "text-ink-900"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}
const Pill = ({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
      tone === "ok"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : tone === "warn"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
    }`}
  >
    {children}
  </span>
);

export default function CallsDayReport({ people, month, today, now, isAdmin, email, host, avatar }: Props) {
  const isCurrent = today.startsWith(month);
  const lastDay = isCurrent ? today : `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
  const [day, setDay] = useState(lastDay);
  const [picked, setPicked] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [calls, setCalls] = useState<AmoCall[]>([]);
  const [callsLoaded, setCallsLoaded] = useState(false);

  useEffect(() => {
    setDay(lastDay);
  }, [lastDay]);
  useEffect(() => {
    setShowAll(false);
    setCallsLoaded(false);
    const q = isAdmin ? query(collection(db, "amo_calls"), where("day", "==", day)) : query(collection(db, "amo_calls"), where("day", "==", day), where("staff_email", "==", email));
    return onSnapshot(
      q,
      (snap) => {
        setCalls(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AmoCall, "id">) })));
        setCallsLoaded(true);
      },
      () => {
        setCalls([]);
        setCallsLoaded(true);
      },
    );
  }, [day, isAdmin, email]);

  const users = useMemo(() => new Set(people.map((p) => p.amo_user_id)), [people]);
  const dayCalls = useMemo(() => calls.filter((c) => users.has(c.amo_user_id)).sort((a, b) => b.at.localeCompare(a.at)), [calls, users]);
  const rows = useMemo(() => dayRows(people, day), [people, day]);
  const grid = useMemo(() => hourGrid(dayCalls), [dayCalls]);
  const gridMax = Math.max(1, ...[...grid.values()].flatMap((r) => Object.values(r)));
  const isToday = day === today;
  const todays = isToday ? people.map((p) => (p.today && p.today.day === today ? p.today : null)) : [];

  const sum = (k: "total" | "answered" | "talked" | "leads_talked" | "talk_sec") => rows.reduce((n, r) => n + r[k], 0);
  const starter = rows.filter((r) => r.first).sort((a, b) => (a.first! < b.first! ? -1 : 1))[0];
  const longest = Math.max(0, ...rows.map((r) => r.longest));
  const missedOpen = todays.flatMap((t, i) => (t?.missed_open || []).map((m) => ({ ...m, manager: people[i].name })));
  const missedReturned = todays.reduce((n, t) => n + (t?.missed_returned || 0), 0);
  const missedIn = isToday ? missedOpen.length : people.reduce((n, p) => n + (p.daily?.[day]?.missed_in || 0), 0);
  const nl = todays.reduce(
    (a, t) => {
      const s = t?.new_leads;
      if (!s) return a;
      a.count += s.count;
      a.called += s.called;
      if (s.avg_first_min !== null) {
        a.firstSum += s.avg_first_min * s.called;
        a.firstN += s.called;
      }
      a.waiting.push(...s.waiting);
      return a;
    },
    { count: 0, called: 0, firstSum: 0, firstN: 0, waiting: [] as { id: number; name: string; source: string; created: string; wait_min: number }[] },
  );
  nl.waiting.sort((a, b) => b.wait_min - a.wait_min);

  const selected = picked !== null && rows.some((r) => r.user === picked) ? picked : rows[0]?.user ?? null;
  const selectedRow = rows.find((r) => r.user === selected);
  const selectedCalls = dayCalls.filter((c) => c.amo_user_id === selected);
  const shownCalls = showAll ? selectedCalls : selectedCalls.slice(0, 12);

  // The 7 days up to the picked one (this month's records only).
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6)).filter((d) => d.startsWith(month));
  const weekPeople = people.filter((p) => p.amo_user_id && week.some((d) => p.daily?.[d]?.calls));

  const leadUrl = (id: number | string | null) => (host && typeof id === "number" ? `https://${host}/leads/detail/${id}` : null);
  const canNext = day < lastDay;
  const canPrev = day > `${month}-01`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-ink-900">Qo'ng'iroqlar hisoboti</h2>
          <p className="text-xs text-ink-500">amoCRM dagi har bir qo'ng'iroq bo'yicha · har 2 daqiqada yangilanadi</p>
        </div>
        <div className="inline-flex items-center rounded-full border border-ink-100 bg-surface p-1 shadow-sm">
          <button type="button" aria-label="Oldingi kun" disabled={!canPrev} className="rounded-full p-1.5 text-ink-500 hover:bg-ink-50 disabled:opacity-30" onClick={() => setDay(shiftDay(day, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-bold text-ink-900">{dayTitle(day, today)}</span>
          <button type="button" aria-label="Keyingi kun" disabled={!canNext} className="rounded-full p-1.5 text-ink-500 hover:bg-ink-50 disabled:opacity-30" onClick={() => setDay(shiftDay(day, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Ish boshlandi" value={starter?.first || "—"} hint={starter ? `birinchi qo'ng'iroq · ${starter.name}` : "qo'ng'iroq yo'q"} />
        <Tile label="Qo'ng'iroqlar" value={String(sum("total"))} hint={`${sum("answered")} javob · ${sum("total") - sum("answered")} javobsiz`} />
        <Tile label="Gaplashgan odamlar" value={String(sum("talked"))} hint="alohida raqamlar" />
        <Tile label="Gaplashgan lidlar" value={String(sum("leads_talked"))} hint="amoCRM lidlari bo'yicha" />
        <Tile label="Suhbat vaqti" value={formatTalk(sum("talk_sec"))} hint={sum("answered") ? `o'rtacha ${mmss(sum("talk_sec") / sum("answered"))} · eng uzun ${mmss(longest)}` : undefined} />
        <Tile
          label={isToday ? "Qaytarilmagan javobsiz" : "Javobsiz kiruvchi"}
          value={String(missedIn)}
          hint={isToday ? `qaytarilgan: ${missedReturned}` : "shu kuni"}
          alert={isToday && missedIn > 0}
        />
      </div>

      <Box className="overflow-hidden !p-0">
        <div className="px-5 pt-5">
          <Title title="Menejerlar" hint="Qatorni bosing — o'ngda shu menejerning qo'ng'iroqlari chiqadi. 09:30 dan keyin boshlash va 30+ daqiqalik tanaffuslar sariq." />
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-500">Bu kuni qo'ng'iroq yo'q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-y border-ink-100 bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-2.5 font-semibold">Menejer</th>
                  <th className="px-3 py-2.5 font-semibold">Boshladi</th>
                  <th className="px-3 py-2.5 font-semibold">Oxirgi</th>
                  <th className="px-3 py-2.5 font-semibold">Qo'ng'iroq</th>
                  <th className="px-3 py-2.5 font-semibold">Javob</th>
                  <th className="px-3 py-2.5 font-semibold">Odamlar</th>
                  <th className="px-3 py-2.5 font-semibold">Lidlar</th>
                  <th className="px-3 py-2.5 font-semibold">Suhbat</th>
                  <th className="px-3 py-2.5 font-semibold">O'rtacha</th>
                  <th className="px-3 py-2.5 font-semibold">Eng uzun</th>
                  <th className="px-5 py-2.5 font-semibold">Tanaffus 30+</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => {
                  const ago = isToday ? minutesSince(r.last, now) : null;
                  return (
                    <tr
                      key={r.user}
                      onClick={() => setPicked(r.user)}
                      className={`cursor-pointer border-b border-ink-50 transition-colors ${selected === r.user ? "bg-brand-50/70 dark:bg-brand-950/30" : "hover:bg-ink-50/60"}`}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {avatar(r.name, r.user, 30, isToday ? ago !== null && ago <= 15 : undefined)}
                          <span className="font-semibold text-ink-900">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{r.first ? <Pill tone={isLateStart(r.first) ? "warn" : "ok"}>{r.first}</Pill> : "—"}</td>
                      <td className="px-3 py-2.5 text-ink-700">{r.last || "—"}</td>
                      <td className="px-3 py-2.5">
                        <b className="text-ink-900">{r.total}</b>
                        {r.total - r.answered > 0 && <span className="block text-[11px] text-ink-400">{r.total - r.answered} javobsiz</span>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{r.total ? `${Math.round((r.answered / r.total) * 100)}%` : "—"}</td>
                      <td className="px-3 py-2.5 font-bold text-ink-900">{r.talked}</td>
                      <td className="px-3 py-2.5 font-bold text-ink-900">{r.leads_talked}</td>
                      <td className="px-3 py-2.5 text-ink-700">{formatTalk(r.talk_sec)}</td>
                      <td className="px-3 py-2.5 text-ink-700">{r.answered ? mmss(r.talk_sec / r.answered) : "—"}</td>
                      <td className="px-3 py-2.5 text-ink-700">{r.longest ? mmss(r.longest) : "—"}</td>
                      <td className="px-5 py-2.5">{r.gaps > 1 ? <Pill tone="warn">{r.gaps} ta</Pill> : <span className="text-ink-700">{r.gaps}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Box>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Box>
            <Title title="Soatlar bo'yicha faollik" hint="Har katakda — shu soatdagi qo'ng'iroqlar. Bo'sh katak — qo'ng'iroq bo'lmagan soat." />
            {!callsLoaded ? (
              <div className="h-24 animate-pulse rounded-2xl bg-ink-100/70" />
            ) : grid.size === 0 ? (
              <p className="text-sm text-ink-500">Bu kun uchun qo'ng'iroqlar ro'yxati yo'q (oxirgi 31 kun saqlanadi).</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[520px] space-y-1.5">
                  {rows
                    .filter((r) => grid.has(r.user))
                    .map((r) => (
                      <div key={r.user} className="flex items-center gap-1">
                        <span className="w-24 shrink-0 truncate text-xs font-semibold text-ink-700">{r.name}</span>
                        {HOURS.map((h) => {
                          const v = grid.get(r.user)?.[h] || 0;
                          return (
                            <span
                              key={h}
                              title={`${h}:00 — ${v} ta`}
                              className="flex h-7 flex-1 items-center justify-center rounded-md text-[11px] font-bold"
                              style={{ background: v ? `rgba(0, 98, 219, ${0.15 + 0.85 * (v / gridMax)})` : undefined, color: v / gridMax > 0.45 ? "#fff" : undefined }}
                            >
                              {v || ""}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  <div className="flex gap-1 pl-[100px]">
                    {HOURS.map((h) => (
                      <span key={h} className="flex-1 text-center text-[10px] text-ink-400">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Box>

          {isToday && (
            <Box>
              <Title title="Bugungi yangi lidlar" hint="Mas'ul menejer bo'yicha. Birinchi qo'ng'iroq — lid tushgandan keyingi birinchi qo'ng'iroq." />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-ink-50/70 p-3">
                  <div className="font-display text-xl font-extrabold tabular-nums text-ink-900">{nl.count}</div>
                  <div className="text-[11px] text-ink-500">yangi lid</div>
                </div>
                <div className="rounded-2xl bg-ink-50/70 p-3">
                  <div className="font-display text-xl font-extrabold tabular-nums text-ink-900">{nl.called}</div>
                  <div className="text-[11px] text-ink-500">qo'ng'iroq qilindi</div>
                </div>
                <div className="rounded-2xl bg-ink-50/70 p-3">
                  <div className="font-display text-xl font-extrabold tabular-nums text-ink-900">{nl.firstN ? `${Math.round(nl.firstSum / nl.firstN)} daq` : "—"}</div>
                  <div className="text-[11px] text-ink-500">o'rtacha birinchi qo'ng'iroqqacha</div>
                </div>
                <div className={`rounded-2xl p-3 ${nl.waiting.length ? "bg-rose-50 dark:bg-rose-950/40" : "bg-ink-50/70"}`}>
                  <div className={`font-display text-xl font-extrabold tabular-nums ${nl.waiting.length ? "text-rose-600 dark:text-rose-400" : "text-ink-900"}`}>{nl.waiting.length}</div>
                  <div className="text-[11px] text-ink-500">hali qo'ng'iroq yo'q</div>
                </div>
              </div>
              {nl.waiting.length > 0 && (
                <ul className="mt-3 divide-y divide-ink-100 text-sm">
                  {nl.waiting.slice(0, 8).map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <UserPlus className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="truncate text-ink-700">
                          #{w.id} · {w.source} · {w.created}
                          {w.name ? ` · ${w.name}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400">{waitLabel(w.wait_min)} kutyapti</span>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          )}

          {isToday && missedOpen.length > 0 && (
            <Box className="border-rose-200 dark:border-rose-900">
              <Title title="Qaytarilmagan javobsiz qo'ng'iroqlar" hint="15 daqiqadan keyin menejerga va rahbarga Telegram'da eslatiladi." />
              <ul className="divide-y divide-ink-100 text-sm">
                {missedOpen
                  .sort((a, b) => b.waiting_min - a.waiting_min)
                  .map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <PhoneMissed className="h-4 w-4 shrink-0 text-rose-500" />
                        <span className="truncate text-ink-700">
                          {m.at} · {m.phone || m.lead_name || "Noma'lum"} · {m.manager}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400">{waitLabel(m.waiting_min)}</span>
                    </li>
                  ))}
              </ul>
            </Box>
          )}
        </div>

        <Box>
          <Title
            title={selectedRow ? `${selectedRow.name} · qo'ng'iroqlar` : "Qo'ng'iroqlar"}
            hint="Eng yangisi tepada. Lid nomini bosing — amoCRM da ochiladi."
            right={selectedCalls.length ? <span className="text-xs font-semibold text-ink-500">{selectedCalls.length} ta</span> : undefined}
          />
          {!callsLoaded ? (
            <div className="h-40 animate-pulse rounded-2xl bg-ink-100/70" />
          ) : selectedCalls.length === 0 ? (
            <p className="text-sm text-ink-500">Qo'ng'iroq yo'q.</p>
          ) : (
            <>
              <ul className="divide-y divide-ink-100">
                {shownCalls.map((c) => {
                  const url = leadUrl(c.lead_id);
                  const who = [c.contact, c.phone].filter(Boolean).join(" · ") || "Noma'lum raqam";
                  return (
                    <li key={c.id} className="grid grid-cols-[44px_28px_1fr_auto] items-center gap-2 py-2 text-sm">
                      <span className="font-bold tabular-nums text-ink-900">{c.hm}</span>
                      <span title={c.dir === "in" ? "Kiruvchi" : "Chiquvchi"} className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${c.dir === "in" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" : "bg-brand-50 text-brand-600 dark:bg-brand-950/40"}`}>
                        {c.dir === "in" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-ink-900">{who}</span>
                        <span className="block truncate text-[11px] text-ink-500">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600">
                              {c.lead_name || `Lid #${c.lead_id}`}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            c.lead_name || "lidsiz"
                          )}
                          {c.stage ? ` · ${c.stage}` : ""}
                        </span>
                      </span>
                      <span className={`text-right font-bold tabular-nums ${c.answered ? "text-ink-900" : "text-xs text-rose-600 dark:text-rose-400"}`}>{c.answered ? mmss(c.duration) : "javobsiz"}</span>
                    </li>
                  );
                })}
              </ul>
              {selectedCalls.length > shownCalls.length && (
                <button type="button" className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700" onClick={() => setShowAll(true)}>
                  Hammasini ko'rish ({selectedCalls.length})
                </button>
              )}
            </>
          )}
        </Box>
      </div>

      {weekPeople.length > 0 && week.length > 1 && (
        <Box className="overflow-hidden !p-0">
          <div className="px-5 pt-5">
            <Title title="Oxirgi 7 kun" hint="Har kuni: ish boshlagan vaqti · qo'ng'iroq; pastda — gaplashgan odamlar va suhbat vaqti." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-y border-ink-100 bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-2.5 font-semibold">Menejer</th>
                  {week.map((d) => (
                    <th key={d} className="px-3 py-2.5 font-semibold">
                      {WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]} {Number(d.slice(8, 10))}
                    </th>
                  ))}
                  <th className="px-5 py-2.5 font-semibold">O'rtacha</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {weekPeople.map((p) => {
                  const worked = week.map((d) => (p.today?.day === d ? { ...p.today, calls: p.today.total } : p.daily?.[d])).filter((d) => d?.calls);
                  const starts = worked.map((d) => d?.first).filter(Boolean) as string[];
                  const avgStart = starts.length
                    ? (() => {
                        const m = Math.round(starts.reduce((n, s) => n + Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)), 0) / starts.length);
                        return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                      })()
                    : null;
                  const avg = (k: "calls" | "talked" | "talk_sec") => (worked.length ? Math.round(worked.reduce((n, d) => n + Number(d?.[k] || 0), 0) / worked.length) : 0);
                  return (
                    <tr key={p.amo_user_id} className="border-b border-ink-50">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {avatar(p.name, p.amo_user_id, 28)}
                          <span className="font-semibold text-ink-900">{p.name}</span>
                        </div>
                      </td>
                      {week.map((d) => {
                        const v = p.today?.day === d ? { ...p.today, calls: p.today.total } : p.daily?.[d];
                        if (!v?.calls) return <td key={d} className="px-3 py-2.5 text-ink-300">—</td>;
                        return (
                          <td key={d} className="px-3 py-2.5">
                            <span className="whitespace-nowrap">
                              {v.first ? <Pill tone={isLateStart(v.first) ? "warn" : "ok"}>{v.first}</Pill> : null} <b className="text-ink-900">{v.calls}</b>
                            </span>
                            <span className="block text-[11px] text-ink-400">
                              {v.talked ?? "—"} odam · {formatTalk(v.talk_sec || 0)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5">
                        <span className="whitespace-nowrap">
                          {avgStart ? <Pill tone={isLateStart(avgStart) ? "warn" : "ok"}>{avgStart}</Pill> : null} <b className="text-ink-900">{avg("calls")}</b>
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {avg("talked")} odam · {formatTalk(avg("talk_sec"))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-1.5 px-5 py-3 text-[11px] text-ink-400">
            <Clock3 className="h-3.5 w-3.5" /> Ish boshlash vaqti va gaplashgan odamlar shu hisobot qo'shilgan kundan boshlab yoziladi.
          </p>
        </Box>
      )}
    </div>
  );
}
