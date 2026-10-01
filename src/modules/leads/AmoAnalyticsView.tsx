import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, Flame, PhoneCall, PhoneIncoming, Target, TrendingDown, TrendingUp, Trophy, UserRound, XCircle } from "lucide-react";
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

// Sotuv bo'limi: amoCRM, read only. The server pulls counts every couple of
// minutes (meta-webhook/amocrm.js); admins see everyone and can pick a
// manager, anyone else sees only their own amoCRM user.

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const AVATAR = ["#2563eb", "#7c3aed", "#0d9488", "#ea580c", "#db2777", "#0891b2", "#65a30d"];
const SOURCE_COLORS = ["#2563eb", "#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#94a3b8"];
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
const monthLabel = (month: string) => `${monthName(month)} ${month.slice(0, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const talkMinutes = (sec: number) => Math.round(sec / 60);

function Avatar({ name, i, size = 32, live }: { name: string; i: number; size?: number; live?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-white ring-2 ring-surface"
        style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${AVATAR[i % AVATAR.length]}, ${AVATAR[(i + 1) % AVATAR.length]})` }}
      >
        {initialsOf(name).slice(0, 1)}
      </span>
      {live !== undefined && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex h-3 w-3 rounded-full ring-2 ring-surface ${live ? "bg-emerald-500" : "bg-ink-300"}`} />
        </span>
      )}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-10" />;
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 40;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="amoSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#amoSpark)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Ring({ value, size = 76 }: { value: number | null; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="amoRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-ink-200" strokeWidth="10" />
      {v > 0 && <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#amoRing)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />}
    </svg>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}

function CardTitle({ icon, title, hint, right }: { icon?: React.ReactNode; title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600">{icon}</span>}
        <div>
          <h3 className="font-display text-[15px] font-bold text-ink-900">{title}</h3>
          {hint && <p className="text-xs text-ink-500">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default function AmoAnalyticsView({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const thisMonth = tashkentDay(new Date().toISOString()).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [userFilter, setUserFilter] = useState("all");
  const [chart, setChart] = useState<"leads" | "talk">("leads");
  const [status, setStatus] = useState<AmoStatus | null | undefined>(undefined);
  const [rows, setRows] = useState<AmoStat[]>([]);
  const [prevRows, setPrevRows] = useState<AmoStat[]>([]);
  const [nowRows, setNowRows] = useState<AmoStat[]>([]);
  const [mine, setMine] = useState<AmoStat[]>([]);
  const [now, setNow] = useState(new Date());
  const prev = shiftMonth(month, -1);

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

  const isCurrent = month === thisMonth;
  const cur = isAdmin ? rows : mine.filter((r) => r.month === month);
  const before = isAdmin ? prevRows : mine.filter((r) => r.month === prev);
  const current = isCurrent ? cur : isAdmin ? nowRows : mine.filter((r) => r.month === thisMonth);
  const pick = (list: AmoStat[]) => (isAdmin && userFilter !== "all" ? list.filter((r) => String(r.amo_user_id) === userFilter) : list);

  const t = useMemo(() => sumStats(pick(cur)), [cur, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const tPrev = useMemo(() => sumStats(pick(before)), [before, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => sumStats(pick(current)), [current, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => sumStats(cur), [cur]);
  const allNow = useMemo(() => sumStats(current), [current]);

  const people = useMemo(
    () => [...cur].filter((r) => r.amo_user_id !== 0 || r.leads.created || r.calls.total).sort((a, b) => b.leads.created - a.leads.created || b.calls.talk_sec - a.calls.talk_sec),
    [cur],
  );
  const colorIndex = useMemo(() => {
    const ids = [...new Set([...cur, ...current].map((r) => r.amo_user_id))].sort((a, b) => a - b);
    return new Map(ids.map((id, i) => [id, i]));
  }, [cur, current]);
  const openOf = (p: AmoStat) => (isCurrent ? p.leads.open : current.find((r) => r.amo_user_id === p.amo_user_id)?.leads.open ?? 0);

  const today = tashkentDay(now.toISOString());
  const yesterday = tashkentDay(new Date(now.getTime() - 86400e3).toISOString());
  const dayNo = Number(today.slice(8, 10));
  // Mid-month, compare with the same days of last month, not all of it.
  const prevBase = isCurrent ? Object.entries(tPrev.daily).reduce((n, [d, v]) => n + (Number(d.slice(8, 10)) <= dayNo ? v.leads : 0), 0) : tPrev.leads.created;
  const growth = prevBase > 0 ? ((t.leads.created - prevBase) / prevBase) * 100 : null;
  const conv = conversion(t.leads.won, t.leads.created);
  const topLoss = sortedEntries(t.loss)[0];

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, "0")}`;
      const v = t.daily[d];
      return { d, n: i + 1, leads: v?.leads || 0, talk: talkMinutes(v?.talk_sec || 0), future: isCurrent && i + 1 > dayNo };
    });
  }, [month, isCurrent, dayNo, t.daily]);
  const shownDays = days.filter((d) => !d.future);
  const chartMax = Math.max(1, ...days.map((d) => (chart === "leads" ? d.leads : d.talk)));
  const chartTotal = shownDays.reduce((n, d) => n + (chart === "leads" ? d.leads : d.talk), 0);

  const todayTalk = (p: AmoStat) => (p.today?.day === today ? p.today.talk_sec : 0);
  const todayPeople = pick(isCurrent ? cur : current)
    .filter((p) => p.amo_user_id !== 0)
    .sort((a, b) => todayTalk(b) - todayTalk(a));
  const maxTodayTalk = Math.max(1, ...todayPeople.map(todayTalk));
  const maxLeads = Math.max(1, ...people.map((p) => p.leads.created));
  const maxTalk = Math.max(1, ...people.map((p) => p.calls.talk_sec));
  const sources = sortedEntries(t.sources);
  const sourceTotal = sources.reduce((n, [, v]) => n + v, 0);
  const funnel = funnelRows(live.funnel, status?.statuses);
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));
  const losses = sortedEntries(t.loss).slice(0, 6);
  const lossMax = Math.max(1, ...losses.map(([, v]) => v));
  const mName = monthName(month).toLowerCase();

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          <PhoneCall className="h-3.5 w-3.5" /> amoCRM tahlili
        </div>
        <h1 className="mt-1 font-display text-[28px] font-extrabold leading-tight text-ink-900">Sotuv bo'limi</h1>
        <p className="text-sm text-ink-500">Lidlar, qo'ng'iroqlar va menejerlar natijasi</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status && (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              status.ok === false
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {status.ok !== false && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${status.ok === false ? "bg-rose-500" : "bg-emerald-500"}`} />
            </span>
            {status.ok === false ? "Ulanishda xato" : syncLabel(status, now)}
          </span>
        )}
        <div className="inline-flex items-center rounded-full border border-ink-100 bg-surface p-1 shadow-sm">
          <button type="button" aria-label="Oldingi oy" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[124px] text-center text-sm font-bold text-ink-900">{monthLabel(month)}</span>
          <button
            type="button"
            aria-label="Keyingi oy"
            disabled={month >= thisMonth}
            className="rounded-full p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (status === undefined) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`h-40 animate-pulse rounded-3xl bg-ink-100/70 ${i === 0 ? "col-span-2" : ""}`} />
          ))}
        </div>
      </div>
    );
  }
  if (status === null) {
    return (
      <div className="space-y-5">
        {header}
        <Card className="text-sm">
          <div className="font-display text-base font-bold text-ink-900">amoCRM hali ulanmagan</div>
          <p className="mt-1 text-ink-500">Admin amoCRM manzili va uzoq muddatli tokenni GitHub Secrets ga (AMO_SUBDOMAIN, AMO_TOKEN) qo'ygach, ma'lumotlar bir necha daqiqada shu yerda paydo bo'ladi.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {header}

      {status.ok === false && isAdmin && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>amoCRM dan o'qib bo'lmadi: {status.error}</span>
        </div>
      )}

      {!isAdmin && mine.length === 0 && (
        <Card className="text-sm text-ink-600">
          amoCRM akkauntingiz hali bog'lanmagan. Admin Sozlamalar → Xodimlar bo'limida sizga amoCRM foydalanuvchisini tanlaydi (yoki amoCRM dagi emailingiz shu saytdagi bilan bir xil bo'lsa, o'zi bog'lanadi).
        </Card>
      )}

      {isAdmin && people.some((p) => p.amo_user_id !== 0) && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={userFilter === "all"} onClick={() => setUserFilter("all")}>
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${userFilter === "all" ? "bg-white/20" : "bg-ink-100 text-ink-600"}`}>
              <UserRound className="h-3.5 w-3.5" />
            </span>
            Hammasi
          </Chip>
          {people
            .filter((p) => p.amo_user_id !== 0)
            .map((p) => (
              <Chip key={p.amo_user_id} active={userFilter === String(p.amo_user_id)} onClick={() => setUserFilter(String(p.amo_user_id))}>
                <Avatar name={p.name} i={colorIndex.get(p.amo_user_id) || 0} size={24} />
                {p.name}
              </Chip>
            ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-blue-600 to-indigo-600 p-5 text-white shadow-lg shadow-blue-600/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{isCurrent ? "Shu oy tushgan lidlar" : `${monthLabel(month)} lidlari`}</div>
              <div className="mt-1 font-display text-5xl font-extrabold tabular-nums tracking-tight">{t.leads.created}</div>
            </div>
            {growth !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                {growth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {growth >= 0 ? "+" : "−"}
                {Math.abs(growth).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-white/70">{isCurrent ? `o'tgan oyning shu kunlarida: ${prevBase}` : `o'tgan oy: ${prevBase}`}</div>
          <div className="mt-3">
            <Sparkline values={shownDays.map((d) => d.leads)} />
          </div>
        </div>

        <Kpi
          icon={<Flame className="h-4 w-4" />}
          tone="sky"
          label={isCurrent ? "Bugun tushgan" : "Kunlik o'rtacha"}
          value={isCurrent ? String(t.daily[today]?.leads || 0) : (t.leads.created / Math.max(1, days.length)).toFixed(1)}
          hint={isCurrent ? `kecha: ${t.daily[yesterday]?.leads || 0}` : "lid kuniga"}
        />
        <Kpi
          icon={<Target className="h-4 w-4" />}
          tone="violet"
          label="Jarayonda"
          value={String(live.leads.open)}
          hint={live.leads.stale ? <span className="font-semibold text-amber-600 dark:text-amber-400">{live.leads.stale} tasi 3+ kun harakatsiz</span> : "hammasida harakat bor"}
        />
        <div className="col-span-2 rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm lg:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Konversiya</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative shrink-0">
              <Ring value={conv} />
              <span className="absolute inset-0 flex items-center justify-center font-display text-base font-extrabold tabular-nums text-ink-900">{conv === null ? "—" : `${Math.round(conv)}%`}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-3.5 w-3.5" /> <b className="tabular-nums">{t.leads.won}</b> yutildi
              </div>
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5" /> <b className="tabular-nums">{t.leads.lost}</b> yutqazildi
              </div>
              {t.leads.won_amount > 0 && <div className="text-ink-500">{formatMoneyShort(t.leads.won_amount)} so'm</div>}
            </div>
          </div>
        </div>
      </div>

      {isCurrent && todayPeople.length > 0 && (
        <Card>
          <CardTitle icon={<PhoneIncoming className="h-4 w-4" />} title="Bugun · menejerlar faolligi" hint="amoCRM dagi qo'ng'iroqlar bo'yicha. Gaplashgan — javob berilgan qo'ng'iroqdagi alohida raqamlar." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {todayPeople.map((p) => {
              const td = p.today && p.today.day === today ? p.today : null;
              const ago = minutesSince(td?.last || null, now);
              const active = ago !== null && ago <= 15;
              return (
                <div key={p.amo_user_id} className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 transition hover:border-ink-200 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} i={colorIndex.get(p.amo_user_id) || 0} size={38} live={active} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink-900">{p.name}</div>
                      <div className={`text-[11px] font-semibold ${active ? "text-emerald-600 dark:text-emerald-400" : "text-ink-400"}`}>
                        {ago === null ? "bugun qo'ng'iroq yo'q" : active ? "hozir faol" : `${formatTalk(ago * 60)} jim`}
                        {td?.last ? ` · oxirgi ${td.last}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric k="Gaplashgan" v={String(td?.talked || 0)} />
                    <Metric k="Qo'ng'iroq" v={String(td?.total || 0)} sub={td && td.total - td.answered ? `${td.total - td.answered} javobsiz` : undefined} />
                    <Metric k="Suhbat" v={formatTalk(td?.talk_sec || 0)} />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-200/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 transition-all" style={{ width: `${((td?.talk_sec || 0) / maxTodayTalk) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(isAdmin || people.length > 1) && (
        <Card className="overflow-hidden !p-0">
          <div className="px-5 pt-5">
            <CardTitle icon={<Trophy className="h-4 w-4" />} title={`Menejerlar reytingi · ${monthLabel(month)}`} hint="Lid menejerga amoCRM dagi «Mas'ul» bo'yicha bog'lanadi. Konversiya = yutilgan ÷ tushgan." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-2.5 text-left font-semibold">Menejer</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Lidlar</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Gaplashgan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Jarayonda</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Yutildi</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Yutqazildi</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Konversiya</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Suhbat vaqti</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Qo'ng'iroqlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {people.map((p, rank) => {
                  const c = conversion(p.leads.won, p.leads.created);
                  const dim = isAdmin && userFilter !== "all" && String(p.amo_user_id) !== userFilter;
                  return (
                    <tr key={p.amo_user_id} className={`transition hover:bg-ink-50/60 ${dim ? "opacity-40" : ""}`}>
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-extrabold ${rank === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-ink-100 text-ink-500"}`}>{rank + 1}</span>
                          <Avatar name={p.name} i={colorIndex.get(p.amo_user_id) || 0} size={30} />
                          <span className="font-semibold text-ink-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 font-bold tabular-nums text-ink-900">{p.leads.created}</span>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-200/70">
                            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(p.leads.created / maxLeads) * 100}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-700">{p.calls.talked}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-700">{openOf(p)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{p.leads.won}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{p.leads.lost}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${convTone(c)}`}>{pct(c)}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-200/70">
                            <span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500" style={{ width: `${(p.calls.talk_sec / maxTalk) * 100}%` }} />
                          </span>
                          <span className="tabular-nums text-ink-700">{formatTalk(p.calls.talk_sec)}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-400">o'rtacha {formatAvgCall(p.calls.talk_sec, p.calls.answered)}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-ink-700">
                        {p.calls.total}
                        {p.calls.total - p.calls.answered > 0 && <div className="text-[11px] text-ink-400">{p.calls.total - p.calls.answered} javobsiz</div>}
                      </td>
                    </tr>
                  );
                })}
                {people.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-ink-400">
                      Bu oy uchun ma'lumot yo'q
                    </td>
                  </tr>
                )}
              </tbody>
              {people.length > 1 && (
                <tfoot>
                  <tr className="border-t border-ink-100 bg-ink-50/60 font-bold text-ink-900">
                    <td className="px-5 py-3">Jami</td>
                    <td className="px-3 py-3 tabular-nums">{all.leads.created}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{all.calls.talked}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{allNow.leads.open}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{all.leads.won}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{all.leads.lost}</td>
                    <td className="px-3 py-3 text-right">{pct(conversion(all.leads.won, all.leads.created))}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatTalk(all.calls.talk_sec)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{all.calls.total}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle
            icon={<Clock3 className="h-4 w-4" />}
            title="Kunlar kesimida"
            hint={chart === "leads" ? `${monthLabel(month)} · jami ${chartTotal} lid` : `${monthLabel(month)} · jami ${chartTotal} daqiqa suhbat`}
            right={
              <div className="inline-flex shrink-0 rounded-full bg-ink-200/60 p-0.5 text-xs font-semibold">
                <button type="button" className={`rounded-full px-3 py-1 ${chart === "leads" ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500"}`} onClick={() => setChart("leads")}>
                  Lidlar
                </button>
                <button type="button" className={`rounded-full px-3 py-1 ${chart === "talk" ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500"}`} onClick={() => setChart("talk")}>
                  Suhbat
                </button>
              </div>
            }
          />
          <div className="relative h-48">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[chartMax, Math.round(chartMax / 2), 0].map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 text-right text-[10px] tabular-nums text-ink-400">{v}</span>
                  <span className="h-px flex-1 border-t border-dashed border-ink-200/70" />
                </div>
              ))}
            </div>
            <div className="absolute inset-y-[6px] left-9 right-0 flex items-end gap-[3px]">
              {days.map((d) => {
                const v = chart === "leads" ? d.leads : d.talk;
                return (
                  <div key={d.d} className="group relative flex h-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        d.future
                          ? ""
                          : d.d === today
                            ? "bg-gradient-to-t from-brand-600 to-indigo-500"
                            : chart === "leads"
                              ? "bg-blue-300/80 group-hover:bg-blue-500 dark:bg-blue-500/50"
                              : "bg-emerald-300/80 group-hover:bg-emerald-500 dark:bg-emerald-500/50"
                      }`}
                      style={{ height: d.future ? 0 : `${Math.max(v ? 4 : 1.5, (v / chartMax) * 100)}%` }}
                    />
                    {!d.future && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[11px] font-semibold text-surface shadow group-hover:block">
                        {d.n}-{mName}: {v} {chart === "leads" ? "lid" : "daq"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ml-9 mt-1 flex justify-between text-[10px] text-ink-400">
            <span>1</span>
            <span>{Math.ceil(days.length / 2)}</span>
            <span>{days.length}</span>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-bold text-ink-900">Lid manbalari</div>
            {sourceTotal > 0 ? (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {sources.map(([name, n], i) => (
                    <div key={name} title={`${name}: ${n}`} style={{ width: `${(n / sourceTotal) * 100}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {sources.slice(0, 8).map(([name, n], i) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink-700">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        <span className="truncate">{name}</span>
                      </span>
                      <span className="tabular-nums text-ink-500">
                        <b className="text-ink-900">{n}</b> · {Math.round((n / sourceTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-2 text-xs text-ink-400">Ma'lumot yo'q</div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={<Target className="h-4 w-4" />} title="Voronka" hint="amoCRM bosqichlarida hozir turgan lidlar" />
          <div className="space-y-1.5">
            {funnel.map((f, i) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs font-semibold text-ink-700" title={f.label}>
                  {f.label}
                </span>
                <div className="flex flex-1 justify-center">
                  <div
                    className="flex h-8 items-center justify-center rounded-lg text-xs font-extrabold text-white shadow-sm"
                    style={{ width: `${Math.max(14, (f.value / funnelMax) * 100)}%`, background: `linear-gradient(90deg, hsl(${218 + i * 8} 85% ${56 - i * 2}%), hsl(${232 + i * 8} 80% ${62 - i * 2}%))` }}
                  >
                    {f.value}
                  </div>
                </div>
              </div>
            ))}
            {!funnel.length && <div className="py-3 text-center text-xs text-ink-400">Jarayonda lid yo'q</div>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Yutildi · {mName}</div>
              <div className="font-display text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{t.leads.won}</div>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/40">
              <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Yutqazildi · {mName}</div>
              <div className="font-display text-xl font-extrabold tabular-nums text-rose-700 dark:text-rose-300">{t.leads.lost}</div>
            </div>
          </div>

          <div className="mb-2 mt-6 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-900">Yutqazish sabablari</span>
            {topLoss && <span className="text-[11px] text-ink-400">eng ko'p: {topLoss[0]}</span>}
          </div>
          <div className="space-y-2.5">
            {losses.map(([name, n]) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-ink-700">{name}</span>
                  <b className="tabular-nums text-ink-900">{n}</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-200/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500" style={{ width: `${(n / lossMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {!losses.length && <div className="text-xs text-ink-400">Ma'lumot yo'q</div>}
          </div>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <PhoneCall className="h-3 w-3" /> Faqat o'qiladi: ERP amoCRM ga hech narsa yozmaydi, suhbatlar va telefon raqamlar olinmaydi.
      </p>
    </div>
  );
}

const syncLabel = (status: AmoStatus, now: Date) => {
  if (!status.last_sync) return "Ulanmoqda…";
  const ago = Math.max(0, Math.round((now.getTime() - Date.parse(status.last_sync)) / 60000));
  return ago < 1 ? "Jonli · hozirgina yangilandi" : `Jonli · ${ago} daq oldin`;
};

const convTone = (c: number | null) =>
  c === null
    ? "bg-ink-100 text-ink-500"
    : c >= 20
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : c >= 12
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

const TONES = {
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
};

function Kpi({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: keyof typeof TONES; label: string; value: string; hint: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}

function Metric({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium text-ink-500">{k}</div>
      <div className="font-display text-lg font-extrabold leading-tight tabular-nums text-ink-900">{v}</div>
      {sub && <div className="text-[10px] text-amber-600 dark:text-amber-400">{sub}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-semibold transition ${
        active ? "border-brand-600 bg-brand-600 text-white shadow-md shadow-blue-600/20" : "border-ink-100 bg-surface text-ink-700 hover:border-ink-200"
      }`}
    >
      {children}
    </button>
  );
}
