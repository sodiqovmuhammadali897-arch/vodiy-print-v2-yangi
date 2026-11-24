import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Coins, MapPin } from "lucide-react";
import { subscribeOne, subscribeSince } from "../../lib/firestoreDb";
import { PERIODS, addDays, aggregate, metrics, pct, pctLabel, periodSpan, placeLabel, type AdsDay, type Node, type PeriodKey } from "../../lib/adsSpend";
import { formatSom } from "../../lib/ads";

// «Har bir so'm qayerga ketdi» (the owner, 2026-11-24: «kunlik hamma
// budjetni qayerga sarflanayotganini bilishimiz kerak, har bir sent biz
// uchun qadrli»). From ads_days (meta-webhook/adsSpend.js): today's every
// 2 minutes, older days and placements every 30.

type Reach = { reach: number; impr: number; from: string; to: string };
const tashkentDay = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const hm = (iso?: string | null) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16) : "—");
const n0 = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/[\s ]/g, " ");
const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: "bad" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "bad" ? "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30" : "border-ink-100 bg-surface"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${tone === "bad" ? "text-rose-700 dark:text-rose-300" : "text-ink-900"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

export default function SpendWhere({ avgCpl }: { avgCpl: number | null }) {
  const today = tashkentDay();
  const [days, setDays] = useState<AdsDay[] | null>(null);
  const [reach, setReach] = useState<{ d7?: Reach; d30?: Reach; month?: Reach } | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today });
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => subscribeSince<AdsDay>("ads_days", "day", addDays(today, -62), (rows) => setDays(rows)), [today]);
  useEffect(() => subscribeOne<{ d7?: Reach; d30?: Reach; month?: Reach }>("ads_state", "reach", setReach), []);

  const span = periodSpan(period, today, custom);
  const agg = useMemo(() => aggregate(days || [], span.from, span.to), [days, span.from, span.to]);
  const m = metrics(agg.totals);
  const periodReach = period === "today" || period === "yesterday" ? (agg.reach ? { reach: agg.reach, impr: agg.totals.impr } : null) : period === "d7" ? reach?.d7 : period === "d30" ? reach?.d30 : period === "month" ? reach?.month : null;
  const total = agg.totals.spend;
  const oldest = days && days.length ? days.map((d) => d.day).sort()[0] : null;

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const cplCls = (cpl: number | null, spend: number) => {
    if (!cpl) return spend > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "text-ink-400";
    if (!avgCpl) return "text-ink-800";
    if (cpl <= avgCpl) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (cpl <= avgCpl * 2) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  };

  const row = (n: Node, depth: number) => {
    const mm = metrics(n);
    const share = pct(n.spend, total);
    const key = `${depth}:${n.id}`;
    const can = n.children.length > 0;
    const open = openIds.has(key);
    return (
      <Fragment key={key}>
        <tr className={`border-t border-ink-100 ${depth === 0 ? "bg-ink-50/60 font-semibold" : ""}`}>
          <td className="py-2 pr-2">
            <button type="button" disabled={!can} onClick={() => toggle(key)} className="flex w-full min-w-0 items-center gap-1 text-left" style={{ paddingLeft: depth * 18 }}>
              {can ? open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" /> : <span className="w-3.5 shrink-0" />}
              <span className="truncate" title={n.name}>
                {depth === 2 ? "🎬 " : depth === 1 ? "👥 " : ""}
                {n.name || "—"}
              </span>
            </button>
          </td>
          <td className="px-2 text-right tabular-nums">
            {n0(n.spend)}
            <div className="text-[10px] font-normal text-ink-400">{usd(n.usd)}</div>
          </td>
          <td className="px-2 text-right">
            <div className="flex items-center justify-end gap-1.5 tabular-nums">
              <span className="hidden h-1.5 rounded-full bg-brand-500 sm:inline-block" style={{ width: Math.max(2, share * 0.6) }} />
              {pctLabel(share)}
            </div>
          </td>
          <td className="px-2 text-right tabular-nums">{n0(n.impr)}</td>
          <td className="px-2 text-right tabular-nums">{mm.ctr === null ? "—" : pctLabel(mm.ctr)}</td>
          <td className="px-2 text-right tabular-nums">{mm.results}</td>
          <td className="px-2 text-right">
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${cplCls(mm.cpl, n.spend)}`}>{mm.cpl ? n0(mm.cpl) : n.spend > 0 ? "lidsiz" : "—"}</span>
          </td>
          <td className="pl-2 text-right tabular-nums">{n.erp || "—"}</td>
        </tr>
        {open && n.children.map((c) => row(c, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600">
            <Coins className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-[15px] font-bold text-ink-900">Har bir so'm qayerga ketdi</h3>
            <p className="text-xs text-ink-500">
              Kampaniya → auditoriya (ad set) → video · bugungisi 2 daqiqada yangilanadi ({hm(agg.updated_at)}) · so'm = dollar × shu kungi Markaziy bank kursi
              {agg.rate ? ` (1 $ = ${formatSom(agg.rate)})` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${period === p.key ? "bg-brand-600 text-white" : "border border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <span className="flex items-center gap-1">
              <input type="date" className="input w-auto py-1 text-xs" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="text-ink-400">—</span>
              <input type="date" className="input w-auto py-1 text-xs" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </span>
          )}
        </div>
      </div>

      {days === null ? (
        <div className="h-32 animate-pulse rounded-2xl bg-ink-100/70" />
      ) : !days.length ? (
        <p className="rounded-2xl bg-ink-50/60 p-4 text-sm text-ink-500">Ma'lumot hali yig'ilmagan — server 30 daqiqa ichida birinchi marta yozadi.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sarf" value={`${n0(total)} so'm`} hint={`${usd(agg.totals.usd)} · ${agg.days} kun`} />
            <Stat label="Natija · ERP lid" value={`${m.results} · ${agg.totals.erp}`} hint={m.cpl ? `bitta natija ${n0(m.cpl)} so'm${avgCpl ? ` · 30 kun o'rtacha ${n0(avgCpl)}` : ""}` : total > 0 ? "pul ketdi, natija yo'q" : "—"} tone={total > 0 && !m.results ? "bad" : undefined} />
            <Stat label="Qamrov · namoyish" value={periodReach ? n0(periodReach.reach) : "—"} hint={`${n0(agg.totals.impr)} namoyish${periodReach && periodReach.reach ? ` · har kishiga ${(Math.round(((periodReach.impr || agg.totals.impr) / periodReach.reach) * 100) / 100).toString().replace(".", ",")} marta` : period === "custom" ? " · qamrov tanlangan davr uchun yo'q" : ""}`} />
            <Stat label="Klik · CTR · CPM" value={`${n0(agg.totals.link)} klik`} hint={`CTR ${m.ctr === null ? "—" : pctLabel(m.ctr)} · CPM ${m.cpm === null ? "—" : n0(m.cpm)} · CPC ${m.cpc === null ? "—" : n0(m.cpc)} so'm`} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-ink-500">
                  <th className="pb-2 text-left font-semibold">Nomi</th>
                  <th className="px-2 pb-2 text-right font-semibold">Sarf, so'm</th>
                  <th className="px-2 pb-2 text-right font-semibold">Ulush</th>
                  <th className="px-2 pb-2 text-right font-semibold">Namoyish</th>
                  <th className="px-2 pb-2 text-right font-semibold">CTR</th>
                  <th className="px-2 pb-2 text-right font-semibold">Natija</th>
                  <th className="px-2 pb-2 text-right font-semibold">Natija narxi</th>
                  <th className="pb-2 pl-2 text-right font-semibold">ERP lid</th>
                </tr>
              </thead>
              <tbody>
                {agg.tree.map((c) => row(c, 0))}
                {!agg.tree.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-ink-500">
                      Bu davrda sarf yo'q{oldest && span.from < oldest ? ` (ma'lumot ${oldest} dan bor)` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-400">Qatorni bossangiz ichi ochiladi: auditoriyalar, keyin videolar. Natija = Meta hisoblagan lid + yozishma; ERP lid = ERP'ga tushgan forma lidlari.</p>

          {agg.placements.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-900">
                <MapPin className="h-4 w-4 text-ink-500" /> Platforma va joylashuv
              </div>
              <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                {agg.placements.map((p) => {
                  const share = pct(p.spend, total);
                  const res = p.leads + p.chats;
                  const idle = p.spend > 0 && !res;
                  return (
                    <div key={`${p.plat}/${p.pos}`} className="flex items-center gap-2 border-b border-ink-100 py-1.5 text-sm">
                      <span className={`w-28 shrink-0 truncate sm:w-40 ${idle ? "text-rose-600" : "text-ink-800"}`}>{placeLabel(p)}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <span className={`block h-full rounded-full ${idle ? "bg-rose-400" : "bg-brand-500"}`} style={{ width: `${Math.min(100, share)}%` }} />
                      </span>
                      <span className="w-28 shrink-0 text-right tabular-nums text-ink-700">
                        {n0(p.spend)} · {pctLabel(share)}
                      </span>
                      <span className={`w-16 shrink-0 text-right text-xs tabular-nums sm:w-20 ${idle ? "font-semibold text-rose-600" : "text-ink-500"}`}>{res ? `${res} natija` : "natijasiz"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
