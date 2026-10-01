import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PhoneCall, RefreshCw } from "lucide-react";
import { subscribeOne, subscribeWhere } from "../../lib/firestoreDb";
import { formatMoneyShort, initialsOf } from "../../lib/format";
import { tashkentDay } from "../../lib/salesPeriod";
import {
  conversion,
  formatAvgCall,
  formatTalk,
  funnelRows,
  minutesSince,
  sortedEntries,
  sumStats,
  type AmoStat,
  type AmoStatus,
} from "../../lib/amoStats";

// amoCRM, read only: counts the server pulls every couple of minutes
// (meta-webhook/amocrm.js). Admins see everyone and can pick a manager;
// anyone else sees only their own amoCRM user.

const AVATAR = ["#2563eb", "#7c3aed", "#0d9488", "#ea580c", "#db2777", "#0891b2", "#65a30d"];
const prevMonthOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: React.ReactNode; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold tabular-nums" style={{ color: tone }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-500">{hint}</div>
    </div>
  );
}

function Bars({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="py-4 text-center text-xs text-ink-400">Ma'lumot yo'q</div>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs font-semibold text-ink-700" title={r.label}>
            {r.label}
          </span>
          <div className="progress-track h-2.5 flex-1">
            <div className="progress-bar" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-10 text-right text-xs font-extrabold tabular-nums text-ink-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Avatar({ name, i }: { name: string; i: number }) {
  return (
    <span className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: AVATAR[i % AVATAR.length] }}>
      {initialsOf(name)}
    </span>
  );
}

export default function AmoAnalyticsView({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const thisMonth = tashkentDay(new Date().toISOString()).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [userFilter, setUserFilter] = useState("all");
  const [status, setStatus] = useState<AmoStatus | null | undefined>(undefined);
  const [rows, setRows] = useState<AmoStat[]>([]);
  const [prevRows, setPrevRows] = useState<AmoStat[]>([]);
  const [nowRows, setNowRows] = useState<AmoStat[]>([]);
  const [mine, setMine] = useState<AmoStat[]>([]);
  const [now, setNow] = useState(new Date());
  const prev = prevMonthOf(month);

  useEffect(() => subscribeOne<AmoStatus>("amo_meta", "status", (s) => setStatus(s || null)), []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!isAdmin) return;
    const a = subscribeWhere<AmoStat>("amo_stats", "month", month, setRows);
    const b = subscribeWhere<AmoStat>("amo_stats", "month", prev, setPrevRows);
    // Leads in work and the funnel are "right now": the current month's docs.
    const c = month === thisMonth ? () => undefined : subscribeWhere<AmoStat>("amo_stats", "month", thisMonth, setNowRows);
    return () => {
      a();
      b();
      c();
    };
  }, [isAdmin, month, prev, thisMonth]);
  useEffect(() => {
    if (isAdmin || !email) return;
    return subscribeWhere<AmoStat>("amo_stats", "staff_email", email, setMine);
  }, [isAdmin, email]);

  const cur = isAdmin ? rows : mine.filter((r) => r.month === month);
  const before = isAdmin ? prevRows : mine.filter((r) => r.month === prev);
  const current = month === thisMonth ? cur : isAdmin ? nowRows : mine.filter((r) => r.month === thisMonth);
  const pick = (list: AmoStat[]) => (isAdmin && userFilter !== "all" ? list.filter((r) => String(r.amo_user_id) === userFilter) : list);
  const scoped = pick(cur);
  const t = useMemo(() => sumStats(scoped), [scoped]);
  const all = useMemo(() => sumStats(cur), [cur]);
  const live = useMemo(() => sumStats(pick(current)), [current, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const openOf = (p: AmoStat) => (month === thisMonth ? p.leads.open : current.find((r) => r.amo_user_id === p.amo_user_id)?.leads.open ?? 0);
  const tPrev = useMemo(() => sumStats(pick(before)), [before, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useMemo(
    () => [...cur].filter((r) => r.amo_user_id !== 0 || r.leads.created || r.calls.total).sort((a, b) => b.leads.created - a.leads.created || b.calls.talk_sec - a.calls.talk_sec),
    [cur],
  );
  const colorIndex = useMemo(() => new Map(people.map((p, i) => [p.amo_user_id, i])), [people]);
  const today = tashkentDay(now.toISOString());
  const isCurrent = month === thisMonth;
  const todayLeads = t.daily[today]?.leads || 0;
  const yesterday = tashkentDay(new Date(now.getTime() - 86400e3).toISOString());
  // Mid-month, compare with the same days of last month, not all of it.
  const prevBase = isCurrent
    ? Object.entries(tPrev.daily).reduce((n, [d, v]) => n + (Number(d.slice(8, 10)) <= Number(today.slice(8, 10)) ? v.leads : 0), 0)
    : tPrev.leads.created;
  const growth = prevBase > 0 ? ((t.leads.created - prevBase) / prevBase) * 100 : null;
  const prevLabel = isCurrent ? `o'tgan oyning shu kunlari: ${prevBase}` : `o'tgan oy: ${prevBase}`;
  const topLoss = sortedEntries(t.loss)[0];
  const conv = conversion(t.leads.won, t.leads.created);

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = isCurrent ? Number(today.slice(8, 10)) : count;
    return Array.from({ length: last }, (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, "0")}`;
      return { d, n: i + 1, leads: t.daily[d]?.leads || 0 };
    });
  }, [month, isCurrent, today, t.daily]);
  const maxDay = Math.max(1, ...days.map((d) => d.leads));

  if (status === undefined) return <div className="card p-6 text-center text-sm text-ink-500">Yuklanmoqda…</div>;
  if (status === null) {
    return (
      <div className="card p-6 text-sm text-ink-700">
        <div className="font-display text-base font-bold text-ink-900">amoCRM hali ulanmagan</div>
        <p className="mt-1 text-ink-500">Admin amoCRM manzili va uzoq muddatli tokenni GitHub Secrets ga (AMO_SUBDOMAIN, AMO_TOKEN) qo'ygach, ma'lumotlar bir necha daqiqada shu yerda paydo bo'ladi.</p>
      </div>
    );
  }

  const syncedAgo = status.last_sync ? Math.max(0, Math.round((now.getTime() - Date.parse(status.last_sync)) / 60000)) : null;

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" className="input w-auto !py-2 text-sm" value={month} max={thisMonth} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        {isAdmin && (
          <select className="input w-auto !py-2 text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">Barcha menejerlar</option>
            {people.map((p) => (
              <option key={p.amo_user_id} value={String(p.amo_user_id)}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-500">
          <span className={`h-2 w-2 rounded-full ${status.ok === false ? "bg-rose-500" : "bg-emerald-500"}`} />
          <RefreshCw className="h-3 w-3" />
          amoCRM: {syncedAgo === null ? "hali yangilanmadi" : syncedAgo < 1 ? "hozirgina yangilandi" : `${syncedAgo} daq oldin yangilandi`}
          {status.poll_minutes ? ` · har ${status.poll_minutes} daqiqada` : ""}
        </span>
      </div>

      {status.ok === false && isAdmin && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>amoCRM dan o'qib bo'lmadi: {status.error}</span>
        </div>
      )}

      {!isAdmin && mine.length === 0 && (
        <div className="card p-5 text-sm text-ink-600">
          amoCRM akkauntingiz hali bog'lanmagan. Admin Sozlamalar → Xodimlar bo'limida sizga amoCRM foydalanuvchisini tanlaydi (yoki amoCRM dagi emailingiz shu saytdagi bilan bir xil bo'lsa, o'zi bog'lanadi).
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          label={isCurrentMonthLabel(month, thisMonth)}
          value={String(t.leads.created)}
          hint={growth === null ? prevLabel : <><span className={growth >= 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(0)}%</span> · {prevLabel}</>}
        />
        {isCurrent ? (
          <Tile label="Bugun tushgan" value={String(todayLeads)} hint={`kecha: ${t.daily[yesterday]?.leads || 0}`} />
        ) : (
          <Tile label="Kunlik o'rtacha" value={(t.leads.created / Math.max(1, days.length)).toFixed(1)} hint="lid kuniga" />
        )}
        <Tile label="Jarayonda (hozir)" value={String(live.leads.open)} hint={live.leads.stale ? `shundan ${live.leads.stale} tasi 3+ kun harakatsiz` : "hammasida harakat bor"} tone="#0284c7" />
        <Tile label="Yutildi" value={String(t.leads.won)} hint={<>konversiya <b>{pct(conv)}</b>{t.leads.won_amount ? ` · ${formatMoneyShort(t.leads.won_amount)} so'm` : ""}</>} tone="#059669" />
        <Tile label="Yutqazildi" value={String(t.leads.lost)} hint={topLoss ? `ko'p sabab: «${topLoss[0]}» (${topLoss[1]})` : "—"} tone="#e11d48" />
      </div>

      {isCurrent && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Bugun · menejerlar faolligi</h3>
          <p className="mb-3 text-xs text-ink-500">amoCRM dagi qo'ng'iroqlar bo'yicha (kiruvchi va chiquvchi). Gaplashgan — javob berilgan qo'ng'iroqdagi alohida raqamlar.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pick(people).filter((p) => p.amo_user_id !== 0).map((p) => {
              const td = p.today && p.today.day === today ? p.today : null;
              const ago = minutesSince(td?.last || null, now);
              return (
                <div key={p.amo_user_id} className="rounded-2xl border border-ink-100 p-4">
                  <div className="flex items-center">
                    <Avatar name={p.name} i={colorIndex.get(p.amo_user_id) || 0} />
                    <span className="truncate font-semibold text-ink-900">{p.name}</span>
                    <span className={`ml-auto text-[11px] font-bold ${ago !== null && ago <= 15 ? "text-emerald-600" : "text-ink-400"}`}>
                      {ago === null ? "bugun qo'ng'iroq yo'q" : ago <= 15 ? "● hozir faol" : `${formatTalk(ago * 60)} jim`}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Stat k="Gaplashgan" v={String(td?.talked || 0)} />
                    <Stat k="Suhbat vaqti" v={formatTalk(td?.talk_sec || 0)} />
                    <Stat k="Qo'ng'iroqlar" v={td ? `${td.total}${td.total - td.answered ? ` (${td.total - td.answered} javobsiz)` : ""}` : "0"} />
                    <Stat k="Oxirgi" v={td?.last || "—"} />
                  </div>
                </div>
              );
            })}
            {pick(people).filter((p) => p.amo_user_id !== 0).length === 0 && <div className="py-3 text-sm text-ink-400">Bugun hali ma'lumot yo'q</div>}
          </div>
        </div>
      )}

      {(isAdmin || people.length > 1) && (
        <div className="card overflow-hidden">
          <div className="px-5 pb-2 pt-5">
            <h3 className="font-display text-sm font-bold text-ink-900">Menejerlar · {month}</h3>
            <p className="text-xs text-ink-500">Lid menejerga amoCRM dagi «Mas'ul» bo'yicha bog'lanadi. Konversiya = yutilgan ÷ tushgan.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Menejer</th>
                  <th className="table-th whitespace-nowrap text-right">Lidlar</th>
                  <th className="table-th whitespace-nowrap text-right">Gaplashgan</th>
                  <th className="table-th whitespace-nowrap text-right">Jarayonda</th>
                  <th className="table-th whitespace-nowrap text-right">Yutildi</th>
                  <th className="table-th whitespace-nowrap text-right">Yutqazildi</th>
                  <th className="table-th whitespace-nowrap text-right">Konversiya</th>
                  <th className="table-th whitespace-nowrap text-right">Suhbat vaqti</th>
                  <th className="table-th whitespace-nowrap text-right">O'rt. suhbat</th>
                  <th className="table-th whitespace-nowrap text-right">Qo'ng'iroqlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {people.map((p) => {
                  const c = conversion(p.leads.won, p.leads.created);
                  return (
                    <tr key={p.amo_user_id} className={isAdmin && userFilter !== "all" && String(p.amo_user_id) !== userFilter ? "opacity-40" : ""}>
                      <td className="table-td">
                        <div className="flex items-center">
                          <Avatar name={p.name} i={colorIndex.get(p.amo_user_id) || 0} />
                          <span className="font-medium text-ink-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{p.leads.created}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{p.calls.talked}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{openOf(p)}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{p.leads.won}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{p.leads.lost}</td>
                      <td className="table-td text-right">
                        <span className={`chip ${c === null ? "bg-ink-100 text-ink-600" : c >= 20 ? "bg-emerald-100 text-emerald-700" : c >= 12 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>{pct(c)}</span>
                      </td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{formatTalk(p.calls.talk_sec)}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{formatAvgCall(p.calls.talk_sec, p.calls.answered)}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">
                        {p.calls.total}
                        {p.calls.total - p.calls.answered > 0 && <span className="text-ink-400"> ({p.calls.total - p.calls.answered} javobsiz)</span>}
                      </td>
                    </tr>
                  );
                })}
                {people.length === 0 && (
                  <tr>
                    <td colSpan={10} className="table-td text-center text-ink-400">
                      Bu oy uchun ma'lumot yo'q
                    </td>
                  </tr>
                )}
              </tbody>
              {people.length > 1 && (
                <tfoot>
                  <tr className="bg-ink-50/60 font-bold">
                    <td className="table-td">Jami</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{all.leads.created}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{all.calls.talked}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{sumStats(current).leads.open}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{all.leads.won}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{all.leads.lost}</td>
                    <td className="table-td text-right">{pct(conversion(all.leads.won, all.leads.created))}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{formatTalk(all.calls.talk_sec)}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{formatAvgCall(all.calls.talk_sec, all.calls.answered)}</td>
                    <td className="table-td whitespace-nowrap text-right tabular-nums">{all.calls.total}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Kunlik tushgan lidlar</h3>
          <p className="mb-3 text-xs text-ink-500">{month}{isCurrent ? " · to'q rang — bugun" : ""}</p>
          <div className="flex h-36 items-end gap-[3px] border-b border-ink-100">
            {days.map((d) => (
              <div
                key={d.d}
                title={`${d.n}: ${d.leads} lid`}
                className="flex-1 rounded-t"
                style={{ height: `${Math.max(2, (d.leads / maxDay) * 100)}%`, background: d.d === today ? "#0062db" : "#93c5fd" }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-400">
            <span>1</span>
            <span>{days.length}</span>
          </div>
          <h3 className="mt-5 font-display text-sm font-bold text-ink-900">Manbalar</h3>
          <div className="mt-2 divide-y divide-dashed divide-ink-100">
            {sortedEntries(t.sources).slice(0, 8).map(([name, n]) => (
              <div key={name} className="flex justify-between py-1.5 text-sm">
                <span className="text-ink-700">{name}</span>
                <b className="tabular-nums text-ink-900">
                  {n} · {t.leads.created ? Math.round((n / t.leads.created) * 100) : 0}%
                </b>
              </div>
            ))}
            {!Object.keys(t.sources).length && <div className="py-2 text-xs text-ink-400">Ma'lumot yo'q</div>}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Voronka · amoCRM bosqichlari</h3>
          <p className="mb-3 text-xs text-ink-500">Hozir har bosqichda turgan lidlar{isCurrent ? "" : " (bugungi holat)"}</p>
          <Bars rows={funnelRows(live.funnel, status.statuses)} color="#60a5fa" />
          <div className="mt-2 space-y-2">
            <Bars rows={[{ label: `Yutildi (${month})`, value: t.leads.won }]} color="#34d399" />
            <Bars rows={[{ label: `Yutqazildi (${month})`, value: t.leads.lost }]} color="#fb7185" />
          </div>
          <h3 className="mt-5 font-display text-sm font-bold text-ink-900">Yutqazish sabablari</h3>
          <div className="mt-2 divide-y divide-dashed divide-ink-100">
            {sortedEntries(t.loss).slice(0, 6).map(([name, n]) => (
              <div key={name} className="flex justify-between py-1.5 text-sm">
                <span className="text-ink-700">{name}</span>
                <b className="tabular-nums text-ink-900">{n}</b>
              </div>
            ))}
            {!Object.keys(t.loss).length && <div className="py-2 text-xs text-ink-400">Ma'lumot yo'q</div>}
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <PhoneCall className="h-3 w-3" /> Faqat o'qiladi: ERP amoCRM ga hech narsa yozmaydi, suhbatlar va telefon raqamlar olinmaydi.
      </p>
    </div>
  );
}

const isCurrentMonthLabel = (month: string, thisMonth: string) => (month === thisMonth ? "Shu oy tushgan lidlar" : `${month} tushgan lidlar`);

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-500">{k}</div>
      <div className="font-display text-base font-extrabold tabular-nums text-ink-900">{v}</div>
    </div>
  );
}
