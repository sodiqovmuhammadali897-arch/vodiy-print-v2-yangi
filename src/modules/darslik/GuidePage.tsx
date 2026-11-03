import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { guidePath, SITUATIONS, type GuideFacts } from "../../lib/guide";
import { num, short } from "../../lib/salesKpi";
import { useLessons } from "./useLessons";
import { useGuide } from "./useGuide";

// Darslik → Mahsulot qo'llanmasi: where a new seller starts. The 5-day
// path, the ten products that bring most of the sales, the customer
// situations, and (admin) the catalog gaps.

const TINT = ["bg-brand-50 text-brand-700", "bg-emerald-50 text-emerald-700", "bg-violet-50 text-violet-700", "bg-amber-50 text-amber-700", "bg-ink-100 text-ink-700", "bg-rose-50 text-rose-700"];

export default function GuidePage() {
  const { isAdmin } = useAuth();
  const { loading, families, top, meta, mine, markSituations, markShadow } = useGuide();
  const { progress } = useLessons();
  const [q, setQ] = useState("");
  const { days, ready } = guidePath(top, mine, progress);
  const byKey = useMemo(() => new Map(families.map((f) => [f.key, f])), [families]);
  const found = q.trim()
    ? families.filter((f) => [f.title, ...f.models.map((m) => m.name)].some((s) => s.toLowerCase().includes(q.trim().toLowerCase())))
    : null;
  const done = days.filter((d) => d.state === "done").length;
  const rest = families.slice(top.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/darslik" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Darslik
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink-900">Mahsulot qo'llanmasi</h1>
          <p className="max-w-2xl text-sm text-ink-500">
            {meta?.products_active || 72} ta mahsulotni yodlash shart emas: avval sotuvning {meta?.top10_share ? `${meta.top10_share}%` : "katta qismini"} beradigan 10 tasi, keyin mijoz vaziyatlari.
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Mahsulot qidirish…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Mahsulot qidirish" />
        </label>
      </div>

      {found && (
        <div className="card p-4">
          {!found.length ? (
            <p className="text-sm text-ink-500">Topilmadi</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {found.map((f) => (
                <Link key={f.key} to={`/darslik/qollanma/${f.key}`} className="rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
                  {f.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The path */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 p-4 text-white shadow-lg shadow-brand-900/20 sm:col-span-3 xl:col-span-1">
          <div className="text-xs font-semibold text-white/85">Sizning yo'lingiz</div>
          <div className="font-display text-3xl font-extrabold">{ready ? "Tayyor ✓" : `${done} / 5 kun`}</div>
          <div className="text-xs text-white/85">{ready ? "Siz sotishga tayyorsiz" : "Beshtasidan o'tsangiz — «sotishga tayyor»"}</div>
          <div className="mt-3 h-2 rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${(done / 5) * 100}%` }} />
          </div>
        </div>
        {days.map((d) => (
          <div
            key={d.n}
            className={`rounded-2xl p-3.5 ${d.state === "done" ? "bg-emerald-50 dark:bg-emerald-900/25" : d.state === "now" ? "bg-surface ring-2 ring-brand-500" : "bg-surface ring-1 ring-ink-100"}`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-wider ${d.state === "done" ? "text-emerald-700 dark:text-emerald-300" : d.state === "now" ? "text-brand-700 dark:text-brand-300" : "text-ink-500"}`}>
              {d.n}-kun{d.state === "done" ? " ✓" : d.state === "now" ? " · hozir" : ""}
            </div>
            <div className="mt-1 font-display text-[15px] font-extrabold text-ink-900">{d.title}</div>
            <p className="mt-0.5 text-xs text-ink-500">{d.text}</p>
            {d.total > 1 && (
              <div className="mt-2 text-[11px] font-semibold tabular-nums text-ink-600">
                {d.done} / {d.total}
              </div>
            )}
            {d.n === 3 && d.state !== "done" && top[0] && (
              <Link to={`/darslik/${top[0].lesson}`} className="mt-1.5 inline-block text-xs font-semibold text-brand-700 hover:underline">
                Darsni ochish →
              </Link>
            )}
            {d.n === 5 && d.state === "now" && (
              <button type="button" className="mt-1.5 text-xs font-semibold text-brand-700 hover:underline" onClick={markShadow}>
                Bajardim
              </button>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-ink-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !families.length ? (
        <div className="card p-6 text-sm text-ink-500">Raqamlar tayyorlanmoqda — server bir necha daqiqada hisoblab chiqadi.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="card p-5">
            <h2 className="font-display text-base font-bold text-ink-900">Avval shu {top.length} ta mahsulot</h2>
            <p className="mb-3 text-xs text-ink-500">
              {meta?.since ? `${monthName(meta.since)}dan beri` : ""} sotuv bo'yicha. Raqam — odatdagi tiraj va boshlang'ich dona narxi.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {top.map((f) => (
                <ProductTile key={f.key} f={f} seen={(mine.seen || []).includes(f.key)} />
              ))}
            </div>
            {rest.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-ink-500">Qolgan mahsulotlar</div>
                <div className="flex flex-wrap gap-1.5">
                  {rest.map((f) => (
                    <Link key={f.key} to={`/darslik/qollanma/${f.key}`} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-200/60">
                      {f.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">Mijoz kim? — {SITUATIONS.length} vaziyat</h2>
                <p className="text-xs text-ink-500">Mijoz mahsulot nomini emas, vaziyatini aytadi</p>
              </div>
              {mine.situations_at ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> o'qildi
                </span>
              ) : (
                <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={markSituations}>
                  O'qib chiqdim
                </button>
              )}
            </div>
            <div className="mt-2 divide-y divide-ink-100">
              {SITUATIONS.map((s, i) => (
                <div key={s.key} className="flex gap-3 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-base font-extrabold ${TINT[i % TINT.length]} dark:bg-ink-200/60`}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-ink-900">{s.title}</div>
                    <p className="mt-0.5 text-xs text-ink-500">{s.why}</p>
                    <p className="mt-1 text-xs text-ink-700">
                      <b>So'rang:</b> {s.ask}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.families.map((k) => {
                        const f = byKey.get(k);
                        return f ? (
                          <Link key={k} to={`/darslik/qollanma/${k}`} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-200/60">
                            {f.title}
                          </Link>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAdmin && meta && (meta.no_image > 0 || meta.no_category > 0 || meta.duplicate_names.length > 0 || meta.lines_without_catalog > 0) && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <b>Rahbar uchun — katalogni to'ldirish:</b>{" "}
          {[
            meta.no_image ? `${meta.no_image} ta mahsulotda rasm yo'q` : "",
            meta.no_category ? `${meta.no_category} tasida toifa yo'q` : "",
            meta.duplicate_names.length ? `ikki marta: ${meta.duplicate_names.join(", ")}` : "",
            meta.lines ? `buyurtma qatorlarining ${Math.round((meta.lines_without_catalog / meta.lines) * 100)}% i katalogdan tanlanmagan (qo'lda yozilgan)` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          .{" "}
          <Link to="/products" className="font-semibold underline">
            Mahsulotlar →
          </Link>
        </div>
      )}
    </div>
  );
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] || m;

function ProductTile({ f, seen }: { f: GuideFacts; seen: boolean }) {
  const img = f.models.find((m) => m.image_url)?.image_url;
  return (
    <Link to={`/darslik/qollanma/${f.key}`} className="group relative rounded-2xl bg-ink-50 p-3 transition hover:bg-surface hover:shadow-md hover:ring-2 hover:ring-brand-500 dark:bg-ink-200/40">
      <span className="absolute left-2 top-2 z-10 rounded-md bg-surface px-1.5 text-[11px] font-extrabold text-brand-700">{f.rank}</span>
      {seen && <Check className="absolute right-2 top-2 z-10 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" />}
      <div className="flex h-16 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 to-ink-100 dark:from-ink-200 dark:to-ink-100">
        {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-semibold text-ink-400">rasm yo'q</span>}
      </div>
      <div className="mt-2 font-display text-sm font-extrabold text-ink-900">{f.title}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-ink-500 tabular-nums">
        {short(f.revenue)} · {f.orders} buyurtma
        <br />
        {f.qty_median ? `odatda ${num(f.qty_median)} dona` : "hali sotilmagan"}
        {f.price_from ? (
          <>
            <br />
            donasi {num(f.price_from)} dan
          </>
        ) : null}
      </div>
    </Link>
  );
}
