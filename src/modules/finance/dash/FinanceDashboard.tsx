import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Globe2,
  Info,
  Megaphone,
  Package,
  PackageCheck,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import type { Customer } from "../../../lib/types";
import type { DateRange } from "../../../lib/dateRange";
import { formatMoneyShort } from "../../../lib/format";
import { monthLabel } from "../../../lib/salesKpi";
import Sparkline from "../../../components/ui/Sparkline";
import {
  breakdown,
  compareSpan,
  dataQuality,
  debtAging,
  debtOf,
  deliveredDays,
  forecast30,
  isProvisional,
  marketing,
  monthSeries,
  monthsBetween,
  pctChange,
  templateStatus,
  totals,
  type AmoMonthLeads,
  type Dim,
  type ExpenseTemplate,
  type FinanceInput,
  type Issue,
} from "../../../lib/financeDash";
import { ColumnChart, Delta, HBars, Legend, Waterfall } from "./charts";
import TemplatesCard from "./TemplatesCard";

type Props = {
  input: FinanceInput;
  range: DateRange;
  customers: Map<string, Customer>;
  templates: ExpenseTemplate[];
  amo: AmoMonthLeads[];
  today: string;
  onChanged: () => void;
  canEdit: boolean;
};

// Reliable sales history starts in July 2026 (the ERP is used for every
// order from then on), so the month charts start there.
const SERIES_FROM = "2026-07";
const short = (m: string) => monthLabel(m).split(" ")[0].slice(0, 3);
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

function Card({ title, sub, icon, children, right, id }: { title: string; sub?: ReactNode; icon?: ReactNode; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {icon && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">{icon}</span>}
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">{title}</h2>
            {sub && <p className="text-xs text-ink-500">{sub}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Kpi({ title, value, icon, tone, delta, goodWhenUp = true, spark, hint, badge }: { title: string; value: number | null; icon: ReactNode; tone: string; delta: number | null; goodWhenUp?: boolean; spark: number[]; hint: ReactNode; badge?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
        <div className="flex flex-col items-end gap-1">
          {badge}
          <Delta value={delta} goodWhenUp={goodWhenUp} />
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</div>
      <div className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-ink-900">{value === null ? "—" : formatMoneyShort(value)}</div>
      <div className="mt-0.5 min-h-[16px] text-xs text-ink-500">{hint}</div>
      {spark.length >= 2 && (
        <div className="mt-2 opacity-80">
          <Sparkline data={spark} color="currentColor" height={28} />
        </div>
      )}
    </div>
  );
}

const ISSUE_STYLE: Record<Issue["level"], { icon: ReactNode; cls: string; label: string }> = {
  critical: { icon: <AlertTriangle className="h-4 w-4" />, cls: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200", label: "Muhim" },
  warning: { icon: <AlertCircle className="h-4 w-4" />, cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200", label: "Diqqat" },
  info: { icon: <Info className="h-4 w-4" />, cls: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-200", label: "Ma'lumot" },
};
const AGING_COLOR: Record<string, string> = { not_due: "bg-[#0ca30c]", d7: "bg-[#fab219]", d30: "bg-[#ec835a]", d60: "bg-[#d03b3b]", d60p: "bg-[#a32a2a]" };
const DIMS: { key: Dim; label: string; icon: ReactNode }[] = [
  { key: "region", label: "Viloyat", icon: <Globe2 className="h-3.5 w-3.5" /> },
  { key: "source", label: "Manba", icon: <Megaphone className="h-3.5 w-3.5" /> },
  { key: "product", label: "Mahsulot", icon: <Package className="h-3.5 w-3.5" /> },
];

export default function FinanceDashboard({ input, range, customers, templates, amo, today, onChanged, canEdit }: Props) {
  const [dim, setDim] = useState<Dim>("region");
  const [allSlices, setAllSlices] = useState(false);
  const span = useMemo(() => ({ from: range.from, to: range.to }), [range]);
  const prev = useMemo(() => compareSpan({ from: range.from, to: range.to }, range.preset), [range]);
  const delivered = useMemo(() => deliveredDays(input.orders, input.history), [input.orders, input.history]);
  const cur = useMemo(() => totals(input, span, delivered), [input, span, delivered]);
  const before = useMemo(() => totals(input, prev, delivered), [input, prev, delivered]);
  const months = useMemo(() => monthsBetween(SERIES_FROM, today).slice(-12), [today]);
  const series = useMemo(() => monthSeries(input, months, delivered), [input, months, delivered]);
  const thisMonth = today.slice(0, 7);
  const tmplStates = useMemo(() => templateStatus(templates, input.expenses, thisMonth), [templates, input.expenses, thisMonth]);
  const spanDays = Math.round((Date.parse(span.to) - Date.parse(span.from)) / 86400000) + 1;
  const issues = useMemo(
    () => dataQuality(input, span, cur, { customers, templates: span.from <= `${thisMonth}-28` && span.to >= `${thisMonth}-01` ? tmplStates : [], monthLike: spanDays >= 28 }),
    [input, span, cur, customers, tmplStates, thisMonth, spanDays],
  );
  const provisional = input.withCost && isProvisional(issues);
  const slices = useMemo(() => breakdown(input, dim, span, prev, customers), [input, dim, span, prev, customers]);
  const aging = useMemo(() => debtAging(input.orders, today), [input.orders, today]);
  const debtTotal = useMemo(() => input.orders.filter((o) => o.status !== "cancelled" && !o.is_draft).reduce((s, o) => s + debtOf(o), 0), [input.orders]);
  const outlook = useMemo(() => forecast30(input.orders, templates, input.expenses, today), [input.orders, templates, input.expenses, today]);
  const ads = useMemo(() => marketing(input, months.slice(-4), amo), [input, months, amo]);
  const last6 = series.slice(-6);
  const spark = (f: (m: (typeof series)[number]) => number | null) => last6.map((m) => f(m) ?? 0);

  const kpis = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <div className="text-[#2a78d6] dark:text-[#3987e5]">
        <Kpi title="Buyurtmalar" value={cur.booked} icon={<ShoppingBag className="h-5 w-5" />} tone="bg-[#2a78d6]/10" delta={pctChange(cur.booked, before.booked)} spark={spark((m) => m.booked)} hint={`${cur.orders} ta · o'rtacha ${formatMoneyShort(cur.avgCheck)}`} />
      </div>
      <div className="text-[#6250d6] dark:text-[#9085e9]">
        <Kpi title="Topshirilgan" value={cur.delivered} icon={<PackageCheck className="h-5 w-5" />} tone="bg-[#6250d6]/10" delta={pctChange(cur.delivered, before.delivered)} spark={spark((m) => m.delivered)} hint="«Yetkazildi» bo'lgan buyurtmalar" />
      </div>
      <div className="text-[#1baf7a] dark:text-[#199e70]">
        <Kpi title="Tushgan pul" value={cur.collected} icon={<Wallet className="h-5 w-5" />} tone="bg-[#1baf7a]/10" delta={pctChange(cur.collected, before.collected)} spark={spark((m) => m.collected)} hint="To'lov sanasi bo'yicha" />
      </div>
      {input.withCost ? (
        <div className="text-[#0e8a4f] dark:text-[#22b067]">
          <Kpi title="Yalpi foyda" value={cur.gross} icon={<TrendingUp className="h-5 w-5" />} tone="bg-[#0e8a4f]/10" delta={cur.gross !== null && before.gross !== null ? pctChange(cur.gross, before.gross) : null} spark={spark((m) => m.gross)} hint={cur.margin !== null ? `Marja ${pct(cur.margin)}` : "Tannarx kiritilmagan"} />
        </div>
      ) : (
        <div className="text-[#eb6834] dark:text-[#d95926]">
          <Kpi title="Xarajatlar" value={cur.expenses} icon={<Receipt className="h-5 w-5" />} tone="bg-[#eb6834]/10" delta={pctChange(cur.expenses, before.expenses)} goodWhenUp={false} spark={spark((m) => m.expenses)} hint="Kiritilgan xarajatlar" />
        </div>
      )}
      <div className="col-span-2 text-ink-700 md:col-span-1">
        <Kpi
          title="Sof foyda"
          value={cur.net}
          icon={<PiggyBank className="h-5 w-5" />}
          tone="bg-ink-100"
          delta={pctChange(cur.net, before.net)}
          spark={spark((m) => m.net)}
          hint={input.withCost ? "Savdo − tannarx − xarajat" : "Savdo − xarajat"}
          badge={
            provisional ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Dastlabki</span>
            ) : input.withCost ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> To'liq
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );

  const quality = issues.length > 0 && (
    <Card
      title="Ma'lumot sifati"
      sub={provisional ? "Sof foyda «dastlabki»: quyidagilar to'ldirilmaguncha yakuniy emas" : "Hisob ishonchli, lekin yaxshilash mumkin"}
      icon={<Sparkles className="h-4 w-4" />}
    >
      <div className="grid gap-2 md:grid-cols-2">
        {issues.map((i) => {
          const st = ISSUE_STYLE[i.level];
          return (
            <div key={i.key} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${st.cls}`}>
              <span className="mt-0.5">{st.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{i.title}</div>
                <div className="text-xs opacity-80">{i.detail}</div>
              </div>
              {i.link && (
                <Link to={i.link} className="inline-flex shrink-0 items-center gap-0.5 self-center text-xs font-bold underline-offset-2 hover:underline">
                  Tuzatish <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {i.action === "expense" && (
                <a href="#doimiy-xarajatlar" className="inline-flex shrink-0 items-center gap-0.5 self-center text-xs font-bold underline-offset-2 hover:underline">
                  Kiritish <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const trend = (
    <Card title="Savdo va tushgan pul" sub={`Oyma-oy · ${monthLabel(months[0])} dan`} icon={<TrendingUp className="h-4 w-4" />} right={<Legend items={[{ label: "Buyurtmalar", color: "blue" }, { label: "Tushgan pul", color: "aqua" }]} />}>
      <ColumnChart labels={series.map((m) => short(m.month))} series={[{ label: "Buyurtmalar", color: "blue", values: series.map((m) => m.booked) }, { label: "Tushgan pul", color: "aqua", values: series.map((m) => m.collected) }]} note={(i) => <div className="mt-1 text-ink-500">{series[i].orders} ta buyurtma · o'rtacha {formatMoneyShort(series[i].avgCheck)}</div>} />
    </Card>
  );

  const profitTrend = input.withCost && (
    <Card title="Foyda dinamikasi" sub="Tannarx sentabr 2026 dan yuritiladi" icon={<PiggyBank className="h-4 w-4" />} right={<Legend items={[{ label: "Yalpi foyda", color: "aqua" }, { label: "Sof foyda", color: "blue" }]} />}>
      <ColumnChart
        labels={series.map((m) => short(m.month))}
        series={[
          // A month with no cost typed has no profit to show.
          { label: "Yalpi foyda", color: "aqua", values: series.map((m) => (m.costTracked && m.gross !== null ? m.gross : null)) },
          { label: "Sof foyda", color: "blue", values: series.map((m) => (m.costTracked && m.gross !== null ? m.net : null)) },
        ]}
        note={(i) => (
          <div className="mt-1 text-ink-500">
            {!series[i].costTracked ? "Bu oyda tannarx yuritilmagan" : series[i].gross === null ? "Tannarx hali kiritilmagan" : `Marja ${pct(series[i].margin)} · xarajat ${formatMoneyShort(series[i].opex)}`}
            {series[i].costTracked && series[i].opex === 0 && <div className="text-amber-700">Xarajat kiritilmagan — sof foyda baland</div>}
          </div>
        )}
      />
    </Card>
  );

  const waterfall = input.withCost && (
    <Card title="Savdodan foydagacha" sub="Tanlangan davr" icon={<Receipt className="h-4 w-4" />}>
      <Waterfall
        steps={[
          { label: "Savdo", value: cur.booked, kind: "start" },
          { label: "Tannarx", value: cur.cost || 0, kind: "minus" },
          { label: "Xarajat", value: cur.opex, kind: "minus" },
          { label: "Sof foyda", value: cur.net, kind: "result" },
        ]}
      />
      {cur.untrackedRevenue > 0 && <p className="mt-1 text-xs text-ink-500">{formatMoneyShort(cur.untrackedRevenue)} savdo sentabrdan oldingi — tannarxsiz.</p>}
      {cur.missingLines > 0 && <p className="mt-1 text-xs text-amber-700">{cur.missingLines} ta qator tannarxsiz ({formatMoneyShort(cur.missingRevenue)}).</p>}
    </Card>
  );

  const shown = allSlices ? slices : slices.slice(0, 8);
  const sliceMax = Math.max(1, ...slices.map((s) => s.revenue));
  const breakdownCard = (
    <Card
      title="Kesimlar"
      sub="Tanlangan davr va undan oldingi shuncha muddat bilan solishtirish"
      icon={<Globe2 className="h-4 w-4" />}
      right={
        <div className="inline-flex rounded-xl bg-ink-100 p-1">
          {DIMS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setDim(d.key);
                setAllSlices(false);
              }}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${dim === d.key ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      }
    >
      {slices.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Bu davrda savdo yo'q</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="py-2 pr-2 font-bold">{DIMS.find((d) => d.key === dim)!.label}</th>
                <th className="hidden px-2 py-2 text-right font-bold sm:table-cell">Buyurtma</th>
                <th className="px-2 py-2 text-right font-bold">Savdo</th>
                <th className="hidden px-2 py-2 text-right font-bold md:table-cell">O'rtacha chek</th>
                {dim !== "product" && <th className="hidden px-2 py-2 text-right font-bold lg:table-cell">Median</th>}
                {dim === "product" && input.withCost && <th className="hidden px-2 py-2 text-right font-bold md:table-cell">Marja</th>}
                <th className="py-2 pl-2 text-right font-bold">O'zgarish</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.key} className="border-b border-ink-50 last:border-0">
                  <td className="py-2 pr-2">
                    <div className="font-medium text-ink-900">{s.key}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-[160px] rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(s.revenue / sliceMax) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-ink-500">{s.share.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="hidden px-2 py-2 text-right tabular-nums text-ink-700 sm:table-cell">{s.orders}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-ink-900">{formatMoneyShort(s.revenue)}</td>
                  <td className="hidden whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-700 md:table-cell">{formatMoneyShort(s.avg)}</td>
                  {dim !== "product" && <td className="hidden whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-700 lg:table-cell">{formatMoneyShort(s.median)}</td>}
                  {dim === "product" && input.withCost && <td className="hidden px-2 py-2 text-right tabular-nums text-ink-700 md:table-cell">{pct(s.margin)}</td>}
                  <td className="py-2 pl-2 text-right">
                    <Delta value={s.prevRevenue > 0 ? s.change : s.revenue > 0 ? null : 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {slices.length > shown.length && (
            <button type="button" className="mt-2 text-sm font-semibold text-brand-600" onClick={() => setAllSlices(true)}>
              Yana {slices.length - shown.length} tasi
            </button>
          )}
        </div>
      )}
    </Card>
  );

  const agingCard = (
    <Card title="Qarzlar muddati" sub={`Mijozlar qarzi bugun: ${formatMoneyShort(debtTotal)}`} icon={<CalendarClock className="h-4 w-4" />} right={<a href="#qarzdorlik" className="text-xs font-semibold text-brand-600 hover:underline">Ro'yxat →</a>}>
      <HBars rows={aging.map((b) => ({ key: b.key, label: b.label, value: b.sum, sub: `${b.n} ta` }))} colorOf={(k) => AGING_COLOR[k]} />
      <p className="mt-3 text-xs text-ink-500">Muddat — buyurtmaning deadline'i, bo'lmasa buyurtmadan 14 kun keyin.</p>
    </Card>
  );

  const forecastCard = (
    <Card title="Keyingi 30 kun" sub="Taxminiy pul oqimi" icon={<CalendarClock className="h-4 w-4" />} right={<Legend items={[{ label: "Kutilayotgan tushum", color: "aqua" }, { label: "Rejali chiqim", color: "orange" }]} />}>
      <ColumnChart height={180} labels={outlook.weeks.map((w) => w.label)} series={[{ label: "Kutilayotgan tushum", color: "aqua", values: outlook.weeks.map((w) => w.inflow) }, { label: "Rejali chiqim", color: "orange", values: outlook.weeks.map((w) => w.outflow) }]} />
      <p className="mt-2 text-xs text-ink-500">
        Tushum — muddati shu kunlarga to'g'ri keladigan qarzlar; chiqim — kiritilmagan doimiy xarajatlar.
        {outlook.overdue > 0 && (
          <>
            {" "}
            Muddati o'tgan <b className="text-rose-600">{formatMoneyShort(outlook.overdue)}</b> ({outlook.overdueOrders} ta) bu yerga qo'shilmagan — kafolatsiz.
          </>
        )}
      </p>
    </Card>
  );

  const adsCard = input.withCost && (
    <Card title="Reklama samarasi" sub="Reklama xarajati, amoCRM lidlari va yangi mijozlar" icon={<Megaphone className="h-4 w-4" />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="py-2 pr-2 font-bold">Oy</th>
              <th className="px-2 py-2 text-right font-bold">Reklama</th>
              <th className="px-2 py-2 text-right font-bold">Lid</th>
              <th className="px-2 py-2 text-right font-bold">1 lid</th>
              <th className="px-2 py-2 text-right font-bold">Yangi mijoz</th>
              <th className="py-2 pl-2 text-right font-bold">1 mijoz</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.month} className="border-b border-ink-50 last:border-0">
                <td className="py-2 pr-2 text-ink-800">{short(a.month)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{a.spend ? formatMoneyShort(a.spend) : <span className="text-amber-700">kiritilmagan</span>}</td>
                <td className="px-2 py-2 text-right tabular-nums">{a.leads || "—"}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{a.cpl === null ? "—" : formatMoneyShort(a.cpl)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{a.newCustomers}</td>
                <td className="whitespace-nowrap py-2 pl-2 text-right font-semibold tabular-nums">{a.cac === null ? "—" : formatMoneyShort(a.cac)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-500">«1 lid» = reklama ÷ lidlar; «1 mijoz» = reklama ÷ birinchi marta buyurtma bergan mijozlar. Reklama Xarajatlar'da «Reklama» turida kiritilsa hisoblanadi.</p>
    </Card>
  );

  return (
    <div className="space-y-5">
      {kpis}
      <p className="-mt-2 text-xs text-ink-500">
        ↑↓ — {prev.from.split("-").reverse().join(".")} – {prev.to.split("-").reverse().join(".")} bilan solishtirish.
      </p>
      {quality}
      <div className={`grid gap-4 [&>*]:min-w-0 ${input.withCost ? "lg:grid-cols-2" : ""}`}>
        {trend}
        {profitTrend}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        {breakdownCard}
        <div className="space-y-4">
          {waterfall}
          <TemplatesCard states={tmplStates} month={thisMonth} today={today} canEdit={canEdit} onChanged={onChanged} />
        </div>
      </div>
      <div className={`grid gap-4 md:grid-cols-2 [&>*]:min-w-0 ${input.withCost ? "xl:grid-cols-3" : ""}`}>
        {agingCard}
        {forecastCard}
        {adsCard}
      </div>
    </div>
  );
}
