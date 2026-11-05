import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeAll, subscribeOne } from "../../lib/firestoreDb";
import { GROUPS, monthTrend, periodDays, summarize, type LostDay, type LostGroup, type Period } from "../../lib/lost";
import { monthLabel, num, short } from "../../lib/salesKpi";

// Yutqazilganlar (admin): lost amoCRM deals and the reason the manager
// picked («Ёпилиш сабаби») — for a day, a week or a month, per manager.
// Data: amo_lost/{day} from the server (meta-webhook/amoLost.js); the same
// day goes to the admins on Telegram at 19:00.

const BAR: Record<LostGroup, string> = {
  price: "bg-rose-500",
  competitor: "bg-violet-500",
  no_answer: "bg-amber-500",
  wrong_number: "bg-amber-300",
  cancelled: "bg-slate-400",
  other: "bg-slate-300 dark:bg-slate-500",
  none: "bg-rose-200 dark:bg-rose-900",
};
const CHIP: Record<LostGroup, string> = {
  price: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  competitor: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  no_answer: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  wrong_number: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  cancelled: "bg-ink-100 text-ink-700",
  other: "bg-ink-100 text-ink-700",
  none: "border border-dashed border-rose-400 text-rose-700 dark:text-rose-300",
};
const CARD: Partial<Record<LostGroup, string>> = {
  price: "text-rose-600 dark:text-rose-400",
  competitor: "text-violet-600 dark:text-violet-400",
  no_answer: "text-amber-600 dark:text-amber-400",
  wrong_number: "text-amber-600 dark:text-amber-400",
};
const PERIODS: [Period, string][] = [
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Hafta"],
  ["month", "Oy"],
];
const todayTashkent = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))}-${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const lastDay = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

export default function LostDeals() {
  const [days, setDays] = useState<LostDay[] | null>(null);
  const [host, setHost] = useState<string>("");
  const [period, setPeriod] = useState<Period>("today");
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [who, setWho] = useState<number | null>(null);
  const [group, setGroup] = useState<LostGroup | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => subscribeAll<LostDay>("amo_lost", setDays), []);
  useEffect(() => subscribeOne<{ host?: string }>("amo_meta", "status", (s) => setHost((s && s.host) || "")), []);

  const today = todayTashkent();
  const range = useMemo(() => {
    if (period === "month" && pickedMonth && pickedMonth !== today.slice(0, 7)) return { from: `${pickedMonth}-01`, to: lastDay(pickedMonth) };
    return periodDays(period, today);
  }, [period, pickedMonth, today]);
  const team = useMemo(() => summarize(days || [], range.from, range.to), [days, range]);
  const s = useMemo(() => summarize(days || [], range.from, range.to, who), [days, range, who]);
  const trend = useMemo(() => monthTrend(days || []), [days]);

  if (!days)
    return (
      <div className="flex justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!days.length) return <div className="card p-6 text-sm text-ink-500">Ma'lumot hali yo'q — server amoCRM'dan 10 daqiqa ichida yuklaydi.</div>;

  const title =
    period === "month" ? monthLabel(range.from.slice(0, 7)) : period === "week" ? `${dayLabel(range.from)} – ${dayLabel(range.to)}` : dayLabel(range.from);
  const items = group ? s.items.filter((it) => it.group === group) : s.items;
  const shown = showAll ? items : items.slice(0, 25);
  const maxManager = Math.max(1, ...team.managers.map((m) => m.n));
  const leadUrl = (id: number) => (host ? `https://${host}/leads/detail/${id}` : null);
  const cards = GROUPS.filter((g) => g.key !== "other" && g.key !== "none");
  const rest = s.byGroup.other.n + s.byGroup.none.n;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Yutqazilganlar · {title}</h1>
          <p className="text-sm text-ink-500">amoCRM'da yopilgan bitimlar va menejer tanlagan «Ёпилиш сабаби»</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPeriod(k);
                setPickedMonth(null);
                setShowAll(false);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${period === k && !(k === "month" && pickedMonth) ? "border-ink-900 bg-ink-900 text-white dark:border-ink-800 dark:bg-ink-800 dark:text-ink-50" : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ user: null as number | null, name: "Hammasi" }, ...team.managers.map((m) => ({ user: m.user as number | null, name: m.name }))].map((c) => (
          <button
            key={String(c.user)}
            type="button"
            onClick={() => setWho(c.user)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${who === c.user ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Totals and the reasons; a card filters the list below */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button type="button" onClick={() => setGroup(null)} className="rounded-2xl bg-slate-900 p-4 text-left text-white ring-1 ring-white/10">
          <div className="text-sm font-semibold text-slate-300">Yutqazildi</div>
          <div className="font-display text-3xl font-extrabold tabular-nums">{num(s.total)}</div>
          <div className="text-xs text-slate-300">{s.sum ? `${short(s.sum)} so'm` : "summa yozilmagan"}</div>
        </button>
        {cards.map((g) => {
          const v = s.byGroup[g.key];
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroup(group === g.key ? null : g.key)}
              className={`rounded-2xl border-2 bg-surface p-4 text-left transition ${group === g.key ? "border-ink-900 dark:border-ink-700" : "border-transparent hover:border-ink-200"}`}
            >
              <div className="text-sm font-semibold text-ink-700">
                {g.icon} {g.title}
              </div>
              <div className={`font-display text-3xl font-extrabold tabular-nums ${CARD[g.key] || "text-ink-900"}`}>{num(v.n)}</div>
              <div className="text-xs text-ink-500">
                {pct(v.n, s.total)}%{(g.key === "price" || g.key === "competitor") && v.sum ? ` · ${short(v.sum)}` : ""}
              </div>
            </button>
          );
        })}
      </div>
      {rest > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(["other", "none"] as LostGroup[]).map((k) =>
            s.byGroup[k].n ? (
              <button key={k} type="button" onClick={() => setGroup(group === k ? null : k)} className={`rounded-full px-2.5 py-1 font-semibold ${CHIP[k]} ${group === k ? "ring-2 ring-ink-900" : ""}`}>
                {GROUPS.find((g) => g.key === k)!.icon} {GROUPS.find((g) => g.key === k)!.title}: {s.byGroup[k].n}
              </button>
            ) : null,
          )}
          {s.reasons
            .filter((r) => r.group === "other")
            .map((r) => (
              <span key={r.reason} className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">
                {r.reason} {r.n}
              </span>
            ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.7fr]">
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Menejerlar bo'yicha</h2>
          <p className="text-xs text-ink-500">Har menejer nimaga yutqazdi · {title}</p>
          <div className="mt-3 space-y-2.5">
            {team.managers.map((m) => (
              <button key={m.user} type="button" onClick={() => setWho(who === m.user ? null : m.user)} className="grid w-full grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-2 text-left text-sm">
                <span className={`truncate ${who === m.user ? "font-bold text-ink-900" : "text-ink-700"}`}>{m.name}</span>
                <div className="flex h-3.5 overflow-hidden rounded-full bg-ink-100" style={{ width: `${(m.n / maxManager) * 100}%` }}>
                  {GROUPS.map((g) =>
                    m.byGroup[g.key] ? <i key={g.key} className={`block h-full ${BAR[g.key]}`} style={{ width: `${(m.byGroup[g.key]! / m.n) * 100}%` }} title={`${g.title}: ${m.byGroup[g.key]}`} /> : null,
                  )}
                </div>
                <b className="tabular-nums text-ink-900">{m.n}</b>
              </button>
            ))}
            {!team.managers.length && <p className="text-sm text-ink-500">Bu davrda yutqazilgan bitim yo'q</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-600">
            {GROUPS.map((g) => (
              <span key={g.key} className="flex items-center gap-1">
                <i className={`inline-block h-2.5 w-2.5 rounded-sm ${BAR[g.key]}`} />
                {g.title}
              </span>
            ))}
          </div>
          {team.managers.length > 1 && team.total >= 20 && (
            <div className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-600">
              {team.managers.map((m) => (
                <div key={m.user}>
                  <b className="text-ink-800">{m.name}:</b> qimmat {pct(m.byGroup.price || 0, m.n)}% · raqobatchi {pct(m.byGroup.competitor || 0, m.n)}% · gaplashilmagan{" "}
                  {pct((m.byGroup.no_answer || 0) + (m.byGroup.wrong_number || 0), m.n)}%
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
            <div>
              <h2 className="font-display text-base font-bold text-ink-900">
                Yutqazilgan bitimlar{group ? ` · ${GROUPS.find((g) => g.key === group)!.title}` : ""}
              </h2>
              <p className="text-xs text-ink-500">Katta summa birinchi · bosilsa amoCRM'da ochiladi</p>
            </div>
            {group && (
              <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setGroup(null)}>
                Filtrni olib tashlash
              </button>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[640px]">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="py-2 pl-4 pr-2 font-bold sm:px-5">Bitim</th>
                  <th className="hidden px-2 py-2 font-bold sm:table-cell">Menejer</th>
                  <th className="hidden px-2 py-2 font-bold sm:table-cell">Qaysi bosqichda</th>
                  <th className="px-2 py-2 font-bold">Sabab</th>
                  <th className="py-2 pl-2 pr-4 text-right font-bold sm:pr-5">Summa</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => {
                  const url = leadUrl(it.id);
                  return (
                    <tr key={it.id} className="border-b border-ink-50 last:border-0">
                      <td className="max-w-[120px] py-2.5 pl-4 pr-2 sm:max-w-[240px] sm:px-5">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="block truncate font-medium text-ink-900 hover:text-brand-600">
                            {it.name || `#${it.id}`}
                          </a>
                        ) : (
                          <span className="block truncate font-medium text-ink-900">{it.name || `#${it.id}`}</span>
                        )}
                        <span className="block truncate text-xs text-ink-500">
                          <span className="sm:hidden">{it.manager || "—"}</span>
                          {period !== "today" && period !== "yesterday" && (
                            <>
                              <span className="sm:hidden"> · </span>
                              {dayLabel(it.closed.slice(0, 10))}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2.5 text-ink-700 sm:table-cell">{it.manager || "—"}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2.5 text-xs text-ink-500 sm:table-cell">{it.stage || "—"}</td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block max-w-[104px] truncate whitespace-nowrap rounded-full px-2.5 py-0.5 align-middle text-xs font-bold sm:max-w-none ${CHIP[it.group]}`} title={it.reason || "Tanlanmagan"}>
                          {GROUPS.find((g) => g.key === it.group)!.icon} {it.reason || "Tanlanmagan"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-1 pr-4 text-right sm:pr-5 font-bold tabular-nums text-ink-900">{it.price ? short(it.price) : "—"}</td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-ink-500">
                      Bu davrda yutqazilgan bitim yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > shown.length && (
            <div className="px-5 pb-4 pt-2">
              <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setShowAll(true)}>
                Yana {items.length - shown.length} tasini ko'rsatish
              </button>
            </div>
          )}
        </div>
      </div>

      {trend.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {trend.slice(-6).map((t) => (
            <button
              key={t.month}
              type="button"
              onClick={() => {
                setPeriod("month");
                setPickedMonth(t.month);
                setShowAll(false);
              }}
              className={`rounded-2xl border-2 bg-surface p-3 text-left text-sm ${period === "month" && range.from.startsWith(t.month) ? "border-ink-900 dark:border-ink-700" : "border-transparent hover:border-ink-200"}`}
            >
              <div className="text-ink-600">{monthLabel(t.month)}</div>
              <b className="font-display text-lg tabular-nums text-ink-900">{num(t.total)}</b>
              <div className="text-xs text-ink-500">
                qimmat {pct(t.price, t.total)}% · raq. {pct(t.competitor, t.total)}%
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-500">
        Har 10 daqiqada amoCRM'dan yangilanadi. Bugungi xulosa har kuni 19:00 da adminlarga Telegramda boradi. «Qaysi bosqichda» — bitim yopilishidan oldin yetgan eng uzoq bosqich.
      </p>
    </div>
  );
}
