import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, Loader2, Pencil, PhoneCall, ShoppingCart } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { mainModel, oneLiner, tierView, timesLabel } from "../../lib/guide";
import { num, short } from "../../lib/salesKpi";
import { useLessons } from "./useLessons";
import { useGuide } from "./useGuide";

// One product family on one screen for a seller: what it is and for whom
// (from the Darslik lesson), how it really sells (server facts), the price
// tiers, who buys it, what to offer with it, what customers say.

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

export default function GuideCard() {
  const { key = "" } = useParams();
  const { isAdmin } = useAuth();
  const { loading, families, markSeen } = useGuide();
  const { lessons } = useLessons();
  const f = families.find((x) => x.key === key);
  const lesson = f ? lessons.find((l) => l.key === f.lesson) : undefined;
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    if (f) markSeen(f.key);
  }, [f?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading)
    return (
      <div className="flex justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!f)
    return (
      <div className="card p-6 text-sm text-ink-500">
        Topilmadi.{" "}
        <Link to="/darslik/qollanma" className="font-semibold text-brand-700">
          Qo'llanmaga qaytish
        </Link>
      </div>
    );

  const priced = f.models.filter((m) => m.tiers.length);
  const shown = priced.find((m) => m.id === model) || mainModel(f.models);
  const tv = shown ? tierView(shown.tiers) : null;
  const img = f.models.find((m) => m.image_url)?.image_url;
  const repeatShare = f.buyers ? f.repeat_buyers / f.buyers : 0;
  const whoMax = Math.max(1, ...f.who.map((w) => w.n), f.who_unknown);
  const months = Object.entries(f.months);
  const monthMax = Math.max(1, ...months.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <Link to="/darslik/qollanma" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Mahsulot qo'llanmasi
      </Link>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
        <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-ink-100 dark:from-ink-200 dark:to-ink-100">
          {img ? <img src={img} alt={f.title} className="h-full w-full object-cover" /> : <span className="text-sm font-semibold text-ink-400">rasm yo'q</span>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="font-display text-2xl font-bold text-ink-900">{f.title}</h1>
            {isAdmin && lesson && (
              <Link to={`/darslik/${lesson.key}`} className="btn-secondary px-3 py-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Matnni Darslikda tahrirlash
              </Link>
            )}
          </div>
          {lesson && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-800">{oneLiner(lesson.about)}</p>}
          {lesson?.audience && (
            <p className="mt-1.5 text-sm text-ink-600">
              <b className="text-ink-800">Kimga:</b> {lesson.audience}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
            {f.models.length > 0 && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{f.models.length} model katalogda</span>}
            {f.min_qty && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700 dark:bg-ink-200/60">min. {num(f.min_qty)} dona</span>}
            {f.lead_days && (
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700 dark:bg-ink-200/60">
                tayyor: {f.lead_days.min === f.lead_days.max ? f.lead_days.min : `${f.lead_days.min}–${f.lead_days.max}`} ish kuni
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Facts */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <Fact value={`№${f.rank}`} label={f.revenue ? `${short(f.revenue)} so'm sotilgan · ${f.orders} buyurtma` : "hali sotilmagan"} />
        <Fact value={f.qty_median ? `${num(f.qty_median)} dona` : "—"} label={f.qty_median ? `odatdagi tiraj (${num(f.qty_low)}–${num(f.qty_high)})` : "odatdagi tiraj"} />
        <Fact value={f.line_median ? short(f.line_median) : "—"} label="odatdagi buyurtma summasi" />
        <Fact value={f.unit_median ? num(f.unit_median) : "—"} label="odatdagi dona narxi, so'm" />
        <Fact
          value={f.buyers ? `${f.repeat_buyers} / ${f.buyers}` : "—"}
          label={f.buyers && repeatShare < 0.3 ? "mijoz qayta olgan — qolganiga 2–3 oyda qo'ng'iroq qiling" : "mijoz qayta olgan"}
          warn={Boolean(f.buyers) && repeatShare < 0.3}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Prices */}
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Narx — tiraj oshsa arzonlashadi</h2>
          {!shown || !tv ? (
            <p className="mt-2 text-sm text-ink-500">Katalogda narx yo'q — Mahsulotlar bo'limida to'ldiring.</p>
          ) : (
            <>
              {priced.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {priced.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.id === shown.id ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-brand-50 dark:bg-ink-200/60"}`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-1 text-xs text-ink-500">«{shown.name}», dona narxi</div>
              <table className="mt-1 w-full text-sm tabular-nums">
                <tbody>
                  {tv.rows.map((t) => (
                    <tr key={t.min_qty} className="border-t border-ink-100 first:border-0">
                      <td className="py-1.5 text-ink-700">{num(t.min_qty)} dona</td>
                      <td className="py-1.5 text-right font-bold text-ink-900">{num(t.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tv.times && tv.first && tv.last && (
                <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                  Aytib qo'ying: {num(tv.last.min_qty)} dona olsa, donasi <b>{timesLabel(tv.times)} arzon</b> ({num(tv.first.price)} → {num(tv.last.price)}).
                </div>
              )}
            </>
          )}
          {f.specs.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-bold text-ink-900">Ko'p yoziladigan o'lcham va turlar</h3>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {f.specs.map((s) => (
                  <span key={s.text} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700 dark:bg-ink-200/60">
                    {s.text}
                  </span>
                ))}
              </div>
            </>
          )}
          {months.length > 1 && (
            <>
              <h3 className="mt-4 text-sm font-bold text-ink-900">Qaysi oyda ko'p olinadi</h3>
              <div className="mt-2 flex h-16 items-end gap-1.5">
                {months.map(([m, v]) => (
                  <div key={m} className="flex flex-1 flex-col items-center gap-1" title={`${short(v)} so'm`}>
                    <div className="w-full rounded-t-md bg-brand-500/80" style={{ height: `${Math.max(6, (v / monthMax) * 52)}px` }} />
                    <span className="text-[10px] text-ink-500">{MONTHS[Number(m.slice(5, 7)) - 1]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Who and what with */}
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Kimga taklif qilamiz</h2>
          <p className="text-xs text-ink-500">Kim olgan — mijoz sohasi bo'yicha buyurtmalar</p>
          <div className="mt-2 space-y-1.5">
            {f.who.map((w) => (
              <Bar key={w.name} label={w.name} n={w.n} max={whoMax} />
            ))}
            {f.who_unknown > 0 && <Bar label="soha yozilmagan" n={f.who_unknown} max={whoMax} muted />}
            {!f.who.length && !f.who_unknown && <p className="text-sm text-ink-500">Hali ma'lumot yo'q</p>}
          </div>
          <h2 className="mt-5 font-display text-base font-bold text-ink-900">Qo'shib taklif qiling</h2>
          <p className="text-xs text-ink-500">Shu mahsulot bilan bir buyurtmada olinganlar</p>
          <div className="mt-1 divide-y divide-ink-100">
            {f.with.map((w) => (
              <Link key={w.key} to={`/darslik/qollanma/${w.key}`} className="flex items-center justify-between py-2 text-sm text-ink-800 hover:text-brand-700">
                <span>{w.title}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 dark:bg-ink-200/60">{w.n} marta</span>
              </Link>
            ))}
            {!f.with.length && <p className="py-2 text-sm text-ink-500">Birga olingan mahsulot yo'q</p>}
          </div>
          {lesson?.upsell && <div className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">{lesson.upsell}</div>}
        </div>

        {/* What customers say */}
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Mijoz shunday deydi</h2>
          <p className="text-xs text-ink-500">Darslikdan — to'liq e'tirozlar va senariy darsda</p>
          <div className="mt-1 divide-y divide-ink-100">
            {(lesson?.objections || []).slice(0, 3).map((o) => (
              <div key={o.q} className="py-2.5 text-sm">
                <div className="font-semibold text-ink-900">«{o.q}»</div>
                <div className="mt-0.5 text-ink-700">{o.a}</div>
              </div>
            ))}
          </div>
          {lesson && lesson.ask.length > 0 && (
            <>
              <h3 className="mt-3 text-sm font-bold text-ink-900">Albatta so'rang</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-700">
                {lesson.ask.slice(0, 4).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
          {lesson && lesson.remember.length > 0 && (
            <>
              <h3 className="mt-3 text-sm font-bold text-ink-900">Eslab qoling</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-700">
                {lesson.remember.slice(0, 3).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {lesson && (
          <>
            <Link to={`/darslik/${lesson.key}/call`} className="btn-primary">
              <PhoneCall className="h-4 w-4" /> Qo'ng'iroq rejimi
            </Link>
            <Link to={`/darslik/${lesson.key}`} className="btn-secondary">
              <BookOpen className="h-4 w-4" /> To'liq dars va test
            </Link>
          </>
        )}
        <Link to="/proposals/new" className="btn-secondary">
          <FileText className="h-4 w-4" /> Tijorat taklifi
        </Link>
        <Link to="/orders/new" className="btn-secondary">
          <ShoppingCart className="h-4 w-4" /> Buyurtma ochish
        </Link>
      </div>
      {f.updated_at && <p className="text-[11px] text-ink-400">Raqamlar buyurtmalardan avtomatik yangilanadi · oxirgi marta {f.updated_at.slice(0, 10)}</p>}
    </div>
  );
}

function Fact({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl p-3.5 ${warn ? "bg-amber-50 dark:bg-amber-900/30" : "bg-surface ring-1 ring-ink-100"}`}>
      <div className={`font-display text-xl font-extrabold tabular-nums ${warn ? "text-amber-700 dark:text-amber-300" : "text-ink-900"}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-500">{label}</div>
    </div>
  );
}

function Bar({ label, n, max, muted }: { label: string; n: number; max: number; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr_28px] items-center gap-2 text-sm">
      <span className="truncate text-ink-700">{label}</span>
      <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-200">
        <div className={`h-full rounded-full ${muted ? "bg-ink-400" : "bg-brand-600"}`} style={{ width: `${(n / max) * 100}%` }} />
      </div>
      <b className="text-right tabular-nums text-ink-900">{n}</b>
    </div>
  );
}
