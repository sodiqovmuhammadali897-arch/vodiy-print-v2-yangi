import { useEffect, useMemo, useState } from "react";
import { Clock3, Film, MapPin, Users } from "lucide-react";
import { subscribeOne } from "../../lib/firestoreDb";
import {
  aggregateAudience,
  aggregateVideos,
  ageLabel,
  deviceLabel,
  pct,
  pctLabel,
  placeLabel,
  regionLabel,
  videoHints,
  type AdsDay,
  type AdsPlacement,
  type AudRow,
  type Creatives,
} from "../../lib/adsSpend";

// Reklama 2.0, phase 2: where (placement), which video and how it was
// watched, who (age/gender, region, device) and when (hour). Same period as
// «Har bir so'm qayerga ketdi». Audience and video come hourly from Meta.

type Tab = "place" | "video" | "aud" | "hour";
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "place", label: "Joylashuv", icon: <MapPin className="h-3.5 w-3.5" /> },
  { key: "video", label: "Video", icon: <Film className="h-3.5 w-3.5" /> },
  { key: "aud", label: "Auditoriya", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "hour", label: "Soatlar", icon: <Clock3 className="h-3.5 w-3.5" /> },
];
const n0 = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/[\s ]/g, " ");
const share = (a: number, b: number) => pctLabel(pct(a, b));

// One bar row: name · bar · spend and share · results.
function BarRow({ label, spend, total, results, sub }: { label: string; spend: number; total: number; results: number; sub?: string }) {
  const s = pct(spend, total);
  const idle = spend > 0 && !results;
  return (
    <div className="flex items-center gap-2 border-b border-ink-100 py-1.5 text-sm">
      <span className={`w-28 shrink-0 truncate sm:w-40 ${idle ? "text-rose-600" : "text-ink-800"}`} title={label}>
        {label}
      </span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
        <span className={`block h-full rounded-full ${idle ? "bg-rose-400" : "bg-brand-500"}`} style={{ width: `${Math.min(100, s)}%` }} />
      </span>
      <span className="w-28 shrink-0 whitespace-nowrap text-right tabular-nums text-ink-700 sm:w-36">
        {n0(spend)} · {pctLabel(s)}
      </span>
      <span className={`w-16 shrink-0 text-right text-xs tabular-nums sm:w-24 ${idle ? "font-semibold text-rose-600" : "text-ink-500"}`}>
        {results ? `${results} · ${n0(spend / results)}` : "natijasiz"}
        {sub ? <span className="block text-[10px] font-normal text-ink-400">{sub}</span> : null}
      </span>
    </div>
  );
}

const total = (rows: { spend: number }[]) => rows.reduce((s, r) => s + r.spend, 0);
const res = (r: AudRow | AdsPlacement) => r.leads + r.chats;

export default function AdsBreakdowns({ days, from, to, placements, spendTotal }: { days: AdsDay[]; from: string; to: string; placements: AdsPlacement[]; spendTotal: number }) {
  const [tab, setTab] = useState<Tab>("place");
  const [creatives, setCreatives] = useState<Creatives>({});
  useEffect(() => subscribeOne<{ map?: Creatives }>("ads_state", "creatives", (c) => setCreatives(c?.map || {})), []);
  const aud = useMemo(() => aggregateAudience(days, from, to), [days, from, to]);
  const videos = useMemo(() => aggregateVideos(days, from, to, creatives), [days, from, to, creatives]);
  const hints = useMemo(() => videoHints(videos), [videos]);
  const waiting = <p className="rounded-2xl bg-ink-50/60 p-4 text-sm text-ink-500">Bu ma'lumot soatda bir yangilanadi — birinchisi tez orada keladi.</p>;

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${tab === t.key ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "border border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "place" &&
        (placements.length ? (
          <div className="grid gap-x-6 md:grid-cols-2">
            {placements.map((p) => (
              <BarRow key={`${p.plat}/${p.pos}`} label={placeLabel(p)} spend={p.spend} total={spendTotal} results={res(p)} />
            ))}
          </div>
        ) : (
          waiting
        ))}

      {tab === "video" &&
        (videos.some((v) => v.plays) ? (
          <div>
            {hints.length > 0 && (
              <div className="mb-3 space-y-1 rounded-2xl bg-ink-50/70 p-3 text-sm text-ink-800">
                {hints.map((h) => (
                  <div key={h}>{h}</div>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-ink-500">
                    <th className="pb-2 text-left font-semibold">Video</th>
                    <th className="px-2 pb-2 text-right font-semibold">Sarf</th>
                    <th className="px-2 pb-2 text-right font-semibold">Natija · narxi</th>
                    <th className="px-2 pb-2 text-right font-semibold">Boshladi</th>
                    <th className="px-2 pb-2 text-left font-semibold">Qancha ko'rdi: 3 soniya · 25% · 50% · 75% · 100%</th>
                    <th className="px-2 pb-2 text-right font-semibold">ThruPlay</th>
                    <th className="pb-2 pl-2 text-right font-semibold">O'rtacha</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => {
                    const steps = [
                      { label: "3s", n: v.v3, of: v.impr, title: "namoyishdan 3 soniyadan ko'p to'xtaganlar" },
                      { label: "25%", n: v.p25, of: v.plays },
                      { label: "50%", n: v.p50, of: v.plays },
                      { label: "75%", n: v.p75, of: v.plays },
                      { label: "100%", n: v.p100, of: v.plays },
                    ];
                    return (
                      <tr key={v.key} className="border-t border-ink-100 align-middle">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            {v.thumb ? <img src={v.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400"><Film className="h-4 w-4" /></span>}
                            <span className="min-w-0">
                              <span className="block max-w-[220px] truncate font-semibold text-ink-900" title={v.name}>
                                {v.name}
                              </span>
                              <span className="text-[11px] text-ink-400">{v.ads > 1 ? `${v.ads} ta reklamada` : "1 ta reklamada"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-2 text-right tabular-nums">{n0(v.spend)}</td>
                        <td className="px-2 text-right tabular-nums">
                          {v.results}
                          <span className={`ml-1 text-xs ${v.cpl ? "text-ink-500" : v.spend > 0 ? "font-semibold text-rose-600" : "text-ink-400"}`}>{v.cpl ? `· ${n0(v.cpl)}` : v.spend > 0 ? "· natijasiz" : ""}</span>
                        </td>
                        <td className="px-2 text-right tabular-nums">{n0(v.plays)}</td>
                        <td className="px-2">
                          <div className="flex gap-1">
                            {steps.map((st) => {
                              const p = st.of ? pct(st.n, st.of) : 0;
                              return (
                                <span key={st.label} title={st.title || `${st.label} gacha ko'rganlar (boshlaganlardan)`} className="flex h-7 w-14 flex-col items-center justify-center rounded-md text-[10.5px] font-bold leading-tight text-white" style={{ background: `rgba(37, 99, 235, ${0.25 + Math.min(0.75, p / 60)})` }}>
                                  <span>{st.of ? pctLabel(p) : "—"}</span>
                                  <span className="text-[9px] font-medium opacity-80">{st.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-2 text-right tabular-nums">{n0(v.thru)}</td>
                        <td className="pl-2 text-right tabular-nums">{v.avgSec === null ? "—" : `${String(v.avgSec).replace(".", ",")} s`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">3s = namoyishlardan necha foizi 3 soniyadan ko'p to'xtab qaradi; 25–100% = videoni boshlaganlardan necha foizi shu joygacha ko'rdi. Bir video bir nechta reklamada bo'lsa — bitta qator.</p>
          </div>
        ) : (
          waiting
        ))}

      {tab === "aud" &&
        (aud.has ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">Yosh va jins</div>
              {aud.age.map((r) => (
                <BarRow key={r.k} label={ageLabel(r.k)} spend={r.spend} total={total(aud.age)} results={res(r)} />
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">Viloyat (Meta bo'yicha)</div>
                {aud.region.map((r) => (
                  <BarRow key={r.k} label={regionLabel(r.k)} spend={r.spend} total={total(aud.region)} results={res(r)} />
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">Qurilma</div>
                {aud.device.map((r) => (
                  <BarRow key={r.k} label={deviceLabel(r.k)} spend={r.spend} total={total(aud.device)} results={res(r)} />
                ))}
              </div>
              <p className="text-[11px] text-ink-400">Viloyat — Meta reklamani qayerda ko'rsatgani; mijozning aniq manzili emas.</p>
            </div>
          </div>
        ) : (
          waiting
        ))}

      {tab === "hour" &&
        (aud.has ? (
          <HourChart hours={aud.hour} />
        ) : (
          waiting
        ))}
    </div>
  );
}

function HourChart({ hours }: { hours: AudRow[] }) {
  const max = Math.max(1, ...hours.map((h) => h.spend));
  const sum = (from: number, to: number) => hours.slice(from, to).reduce((s, h) => ({ spend: s.spend + h.spend, res: s.res + h.leads + h.chats }), { spend: 0, res: 0 });
  const night = sum(0, 6);
  const all = sum(0, 24);
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {hours.map((h) => {
          const r = h.leads + h.chats;
          const night = Number(h.k) < 6;
          const cls = r ? "bg-brand-500" : h.spend > 0 && night ? "bg-rose-400" : "bg-brand-200 dark:bg-brand-900/60";
          return (
            <div key={h.k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${h.k}:00 — ${n0(h.spend)} so'm · ${r} natija`}>
              {r > 0 && <span className="mb-0.5 text-[9px] font-bold text-emerald-600">{r}</span>}
              <span className={`w-full rounded-t ${cls}`} style={{ height: `${Math.max(h.spend ? 2 : 0, (h.spend / max) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[9px] tabular-nums text-ink-400">
        {hours.map((h) => (
          <span key={h.k} className="min-w-0 flex-1 text-center">
            {Number(h.k) % 3 === 0 ? h.k : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        {[
          { label: "Kechasi 00–06", ...night },
          { label: "Kunduzi 09–18", ...sum(9, 18) },
          { label: "Kechqurun 18–24", ...sum(18, 24) },
        ].map((x) => (
          <div key={x.label} className={`rounded-xl border px-3 py-2 ${x.spend > 0 && !x.res ? "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30" : "border-ink-100"}`}>
            <div className="text-xs text-ink-500">{x.label}</div>
            <div className="font-semibold tabular-nums text-ink-900">
              {n0(x.spend)} so'm · {share(x.spend, all.spend)} · {x.res} natija
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-400">Ustun = sarf, yashil raqam = natija (to'q ko'k — natija bor, och — yo'q). Qizil — kechasi 00–06 pul ketgan, natija bo'lmagan soat. Vaqt — Toshkent.</p>
    </div>
  );
}
