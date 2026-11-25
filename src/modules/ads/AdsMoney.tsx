import { TrendingUp } from "lucide-react";
import { pctLabel, profitOf, type Money } from "../../lib/adsSpend";

// Reklama 2.0, phase 3: the period's ad money → leads → orders → sales →
// profit (the owner's TZ: «har bir kreativdan qancha pul sarflangani …
// qancha lid va sotuv kelgani hamda qancha foyda qolganini bitta ekranda»).
// Leads of the period, their orders within 60 days (meta-webhook/adsAttr.js).
const n0 = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/[\s ]/g, " ");
const mln = (n: number) => (Math.abs(n) >= 1e6 ? `${String(Math.round(n / 1e5) / 10).replace(".", ",")} mln` : n0(n));

export default function AdsMoney({ money, spend, first, from }: { money: Money; spend: number; first: string | null; from: string }) {
  const p = profitOf(money, spend);
  // Bar lengths are real shares: money against the larger of spend and
  // sales, leads against all leads.
  const moneyMax = Math.max(1, spend, money.revenue);
  const leadMax = Math.max(1, money.leads);
  const w = (n: number, max: number) => Math.max(n > 0 ? 2 : 0, (n / max) * 100);
  const steps = [
    { label: "Reklama sarfi", value: `${mln(spend)} so'm`, w: w(spend, moneyMax) },
    { label: "ERP'ga tushgan lid", value: n0(money.leads), w: w(money.leads, leadMax) },
    { label: "Mijozlar bazasida topildi", value: `${n0(money.found)}`, w: w(money.found, leadMax) },
    { label: "Buyurtma bergan lid", value: `${n0(money.ordered)}${p.conv !== null ? ` · ${pctLabel(p.conv)}` : ""}`, w: w(money.ordered, leadMax) },
    { label: "Savdo", value: `${mln(money.revenue)} so'm`, w: w(money.revenue, moneyMax), tone: "good" as const },
    { label: "Tushgan pul", value: `${mln(money.paid)} so'm`, w: w(money.paid, moneyMax), tone: "good" as const },
  ];
  const profitTone = p.profit === null ? "text-ink-900" : p.profit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300";
  return (
    <div className="mt-4 rounded-2xl border border-ink-100 p-4">
      <div className="mb-3 flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 text-ink-500" />
        <div>
          <div className="text-sm font-bold text-ink-900">Pul → savdo → foyda</div>
          <div className="text-xs text-ink-500">Shu davrda kelgan reklama lidlari va ularning 60 kun ichidagi buyurtmalari (telefon bo'yicha)</div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-1.5">
          {steps.map((s) => (
            <div key={s.label} className="grid grid-cols-[150px_1fr_110px] items-center gap-2 text-sm sm:grid-cols-[190px_1fr_130px]">
              <span className="truncate text-ink-700">{s.label}</span>
              <span className="h-3 overflow-hidden rounded bg-ink-100">
                <span className={`block h-full rounded ${s.tone === "good" ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${s.w}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-ink-900">{s.value}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 rounded-xl bg-ink-50/70 p-3">
            <div className="text-xs text-ink-500">Reklamadan keyingi foyda {p.estimated ? "(taxminiy)" : ""}</div>
            <div className={`font-display text-2xl font-extrabold tabular-nums ${profitTone}`}>{p.profit === null ? "—" : `${mln(p.profit)} so'm`}</div>
            <div className="text-[11px] text-ink-500">
              savdo − tannarx{p.cost !== null ? ` (${mln(p.cost)})` : ""} − reklama · ijara, oylik hisobga olinmagan
            </div>
          </div>
          <div className="rounded-xl bg-ink-50/70 p-3">
            <div className="text-xs text-ink-500">ROAS</div>
            <div className="font-bold tabular-nums text-ink-900">{p.roas === null ? "—" : `${String(p.roas).replace(".", ",")}x`}</div>
            <div className="text-[11px] text-ink-500">1 so'm reklamaga savdo</div>
          </div>
          <div className="rounded-xl bg-ink-50/70 p-3">
            <div className="text-xs text-ink-500">ROMI</div>
            <div className={`font-bold tabular-nums ${p.romi !== null && p.romi < 0 ? "text-rose-600" : "text-ink-900"}`}>{p.romi === null ? "—" : pctLabel(p.romi)}</div>
            <div className="text-[11px] text-ink-500">foyda ÷ reklama</div>
          </div>
          <div className="rounded-xl bg-ink-50/70 p-3">
            <div className="text-xs text-ink-500">CAC — 1 yangi mijoz</div>
            <div className="font-bold tabular-nums text-ink-900">{p.cac === null ? "—" : `${n0(p.cac)} so'm`}</div>
            <div className="text-[11px] text-ink-500">{money.newCustomers} yangi · {Math.max(0, money.ordered - money.newCustomers)} qaytgan</div>
          </div>
          <div className="rounded-xl bg-ink-50/70 p-3">
            <div className="text-xs text-ink-500">Buyurtmalar</div>
            <div className="font-bold tabular-nums text-ink-900">{money.orders} ta</div>
            <div className="text-[11px] text-ink-500">{money.ordered} ta liddan</div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-400">
        {money.open ? `${money.open} ta lidning 60 kuni hali tugamagan — savdo o'sishi mumkin. ` : ""}
        {first && from < first ? `ERP'da reklama lidlari ${first} dan bor — undan oldingi sarf lidsiz ko'rinadi. ` : ""}
        Tannarx Marja sahifasida kiritilgan buyurtmalardan{p.estimated ? "; kiritilmaganlariga o'shalarning o'rtacha marjasi qo'yildi" : ""}.
      </p>
    </div>
  );
}
