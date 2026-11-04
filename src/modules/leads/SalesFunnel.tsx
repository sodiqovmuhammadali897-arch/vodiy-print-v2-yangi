import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { listAll, subscribeAll } from "../../lib/firestoreDb";
import { exportCsv } from "../../lib/exportCsv";
import { behind, leaks, pct, prevMonth, stepsOf, type FunnelDoc, type FunnelRow } from "../../lib/funnel";
import { monthLabel, num, short } from "../../lib/salesKpi";

// Sotuv bo'limi → «Voronka» (admin): the month's leads from amoCRM to
// money in the ERP — how far they got, where they are lost, per manager
// and source, how fast, and what is out of order in amoCRM. The numbers
// come from amo_funnel/{YYYY-MM} (meta-webhook/amoFunnel.js).

type StaffRow = { id: string; full_name?: string; amo_user_id?: number | string | null };
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const thisMonth = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7);
const pctLabel = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")}%`);

export default function SalesFunnel() {
  const [docs, setDocs] = useState<FunnelDoc[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [who, setWho] = useState<number | null>(null);

  useEffect(() => subscribeAll<FunnelDoc>("amo_funnel", setDocs), []);
  useEffect(() => {
    void listAll<StaffRow>("staff").then(setStaff).catch(() => setStaff([]));
  }, []);

  // Early in a month the last full month says more.
  const months = useMemo(() => (docs || []).map((d) => d.id).sort(), [docs]);
  useEffect(() => {
    if (month || !months.length) return;
    const cur = thisMonth();
    const day = Number(new Date(Date.now() + 5 * 3600e3).toISOString().slice(8, 10));
    const want = day < 10 && months.includes(prevMonth(cur)) ? prevMonth(cur) : months.includes(cur) ? cur : months[months.length - 1];
    setMonth(want);
  }, [months, month]);

  const doc = (docs || []).find((d) => d.id === month) || null;
  const staffName = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of staff) if (s.amo_user_id && s.full_name) m.set(Number(s.amo_user_id), s.full_name);
    return m;
  }, [staff]);
  const nameOf = (u: { id: number; name: string }) => staffName.get(u.id) || u.name;

  if (!docs)
    return (
      <div className="flex justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!docs.length || !doc || !month)
    return <div className="card p-6 text-sm text-ink-500">Voronka hali hisoblanmagan — server amoCRM tarixini yuklab, 30 daqiqa ichida tayyorlaydi.</div>;

  const user = who !== null ? doc.users.find((u) => u.id === who) || null : null;
  const row: FunnelRow = user || doc.all;
  const steps = stepsOf(doc, row);
  const teamSteps = stepsOf(doc, doc.all);
  const lk = leaks(steps);
  const max = Math.max(1, ...steps.map((s) => s.n || 0));
  const canPrev = months.includes(prevMonth(month));
  const canNext = months.includes(nextMonth(month));

  const exportReport = () =>
    exportCsv(
      `voronka-${month}`,
      ["Menejer", "Lid", "Gaplashildi", "Ma'lumot", "Taklif", "Buyurtma", "To'landi", "Yutildi (amoCRM)", "Yo'qotildi", "Sababsiz", "Buyurtma summasi", "Birinchi qo'ng'iroq, daq", "Lid → buyurtma, kun"],
      [...doc.users.map((u) => ({ ...u, name: nameOf(u) })), { ...doc.all, id: -1, name: "Jamoa" }].map((u) => [
        u.name,
        u.leads,
        u.talked ?? "",
        doc.info_key ? u.reached[doc.info_key] || 0 : "",
        doc.offer_key ? u.reached[doc.offer_key] || 0 : "",
        u.ordered,
        u.paid,
        u.won,
        u.lost,
        u.lost_no_reason,
        Math.round(u.order_sum),
        u.first_call_min ?? "",
        u.lead_to_order_days ?? "",
      ]),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Sotuv voronkasi · {monthLabel(month)}</h1>
          <p className="text-sm text-ink-500">Shu oyda kelgan lidlar pulgacha qayergacha yetdi — va qayerda yo'qotyapmiz</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary px-2.5" disabled={!canPrev} onClick={() => setMonth(prevMonth(month))} aria-label="Oldingi oy">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-sm font-semibold text-ink-800">{monthLabel(month)}</span>
          <button type="button" className="btn-secondary px-2.5" disabled={!canNext} onClick={() => setMonth(nextMonth(month))} aria-label="Keyingi oy">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="btn-secondary" onClick={exportReport}>
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ id: null as number | null, label: "Hammasi" }, ...doc.users.map((u) => ({ id: u.id as number | null, label: nameOf(u) }))].map((c) => (
          <button
            key={String(c.id)}
            type="button"
            onClick={() => setWho(c.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${who === c.id ? "border-ink-900 bg-ink-900 text-white dark:border-ink-800 dark:bg-ink-800 dark:text-ink-50" : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* The funnel */}
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink-900">
            {monthLabel(month)}da kelgan {num(row.leads)} lid qayergacha yetdi
          </h2>
          <div className="text-sm text-ink-500">
            Liddan pulgacha: <b className="font-display text-xl text-emerald-700 dark:text-emerald-400">{pctLabel(pct(row.paid, row.leads))}</b> · {row.paid} mijoz to'ladi
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((s, i) => (
            <div key={s.key} className="relative">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-700">
                {s.title}
                <span className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider ${s.source === "ERP" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"}`}>
                  {s.source}
                </span>
              </div>
              <div className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink-900">{s.n === null ? "—" : num(s.n)}</div>
              <div className="mt-2 flex h-28 items-end">
                <div
                  className={`w-full rounded-t-xl ${s.source === "ERP" ? "bg-gradient-to-b from-emerald-400 to-emerald-700" : "bg-gradient-to-b from-brand-500 to-brand-700"} ${s.n === null ? "opacity-20" : ""}`}
                  style={{ height: `${Math.max(4, ((s.n ?? max * 0.04) / max) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs text-ink-500">
                {i === 0 ? (
                  "oy davomida kelgan"
                ) : s.n === null ? (
                  doc.calls_known ? "" : "bu oy qo'ng'iroqlari yuklanmagan"
                ) : (
                  <>
                    {s.conv !== null && (
                      <b className={`mr-1 ${s.conv >= 70 ? "text-emerald-700 dark:text-emerald-400" : s.conv < 50 ? "text-rose-600" : "text-ink-700"}`}>{s.conv > 100 ? "↑" : `${s.conv}%`}</b>
                    )}
                    {s.drop !== null && s.drop > 0 && (
                      <>
                        <b className="text-rose-600">−{num(s.drop)}</b> {s.dropText}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* Managers */}
        <div className="card overflow-hidden p-0">
          <div className="p-5 pb-2">
            <h2 className="font-display text-base font-bold text-ink-900">Menejerlar bo'yicha</h2>
            <p className="text-xs text-ink-500">Har bosqichdan keyingisiga o'tish foizi. Qizil — jamoa o'rtachasidan {10} punktdan ko'p past.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2 text-left">Menejer</th>
                  <th className="px-2 py-2 text-right">Lid</th>
                  {teamSteps.slice(1).map((s) => (
                    <th key={s.key} className="px-2 py-2 text-right">
                      {s.title}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right">Lid → pul</th>
                  <th className="px-4 py-2 text-right">Lid → buyurtma</th>
                </tr>
              </thead>
              <tbody>
                {doc.users.map((u) => {
                  const st = stepsOf(doc, u);
                  return (
                    <tr key={u.id} className="border-t border-ink-100">
                      <td className="px-4 py-2.5 font-semibold text-ink-900">{nameOf(u)}</td>
                      <td className="px-2 py-2.5 text-right">{num(u.leads)}</td>
                      {st.slice(1).map((s, i) => {
                        const bad = behind(s.conv, teamSteps[i + 1].conv);
                        return (
                          <td key={s.key} className={`px-2 py-2.5 text-right ${bad ? "bg-rose-50 font-bold text-rose-600 dark:bg-rose-900/25" : ""}`}>
                            {s.conv === null ? "—" : s.conv > 100 ? "↑" : `${s.conv}%`}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2.5 text-right font-semibold">{pctLabel(pct(u.paid, u.leads))}</td>
                      <td className="px-4 py-2.5 text-right">{u.lead_to_order_days === null ? "—" : `${u.lead_to_order_days} kun`}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-ink-100 bg-ink-50/60 text-ink-500 dark:bg-ink-200/30">
                  <td className="px-4 py-2.5 font-semibold">Jamoa</td>
                  <td className="px-2 py-2.5 text-right">{num(doc.all.leads)}</td>
                  {teamSteps.slice(1).map((s) => (
                    <td key={s.key} className="px-2 py-2.5 text-right">
                      {s.conv === null ? "—" : s.conv > 100 ? "↑" : `${s.conv}%`}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right font-semibold">{pctLabel(pct(doc.all.paid, doc.all.leads))}</td>
                  <td className="px-4 py-2.5 text-right">{doc.all.lead_to_order_days === null ? "—" : `${doc.all.lead_to_order_days} kun`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Leaks */}
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Qayerda yo'qotyapmiz</h2>
          <p className="text-xs text-ink-500">Eng katta teshiklar — {user ? nameOf(user) : "jamoa"}</p>
          <div className="mt-2 divide-y divide-ink-100">
            {lk.map((l) => (
              <div key={l.from} className="flex gap-3 py-3">
                <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-rose-50 px-1.5 text-sm font-extrabold tabular-nums text-rose-600 dark:bg-rose-900/30">{num(l.lost)}</span>
                <div className="text-sm">
                  <b className="text-ink-900">
                    {l.from} → {l.to}: o'tmadi
                  </b>
                  <div className="text-xs text-ink-500">{leakHint(l.to)}</div>
                </div>
              </div>
            ))}
            {row.lost_no_reason > 0 && (
              <div className="flex gap-3 py-3">
                <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-amber-50 px-1.5 text-sm font-extrabold tabular-nums text-amber-700 dark:bg-amber-900/30">{num(row.lost_no_reason)}</span>
                <div className="text-sm">
                  <b className="text-ink-900">Yo'qotilgan — sababi yozilmagan</b>
                  <div className="text-xs text-ink-500">
                    {row.lost} ta yo'qotilgandan {pctLabel(pct(row.lost_no_reason, row.lost))} ida sabab yo'q. amoCRM'da sababni majburiy qiling — nega ketayotganini bilamiz.
                  </div>
                </div>
              </div>
            )}
            {!lk.length && !row.lost_no_reason && <p className="py-3 text-sm text-ink-500">Teshik topilmadi</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Manba bo'yicha</h2>
          <p className="text-xs text-ink-500">Liddan buyurtmagacha (jamoa)</p>
          <div className="mt-2 space-y-2">
            {doc.sources.slice(0, 6).map((s) => {
              const p = pct(s.ordered, s.leads) || 0;
              const best = Math.max(1, ...doc.sources.slice(0, 6).map((x) => pct(x.ordered, x.leads) || 0));
              return (
                <div key={s.name} className="grid grid-cols-[110px_1fr_88px] items-center gap-2 text-sm">
                  <span className="truncate text-ink-700">{s.name}</span>
                  <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-200">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${(p / best) * 100}%` }} />
                  </div>
                  <b className="text-right tabular-nums text-ink-900">
                    {pctLabel(p)} · {num(s.leads)}
                  </b>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">Tezlik</h2>
          <p className="text-xs text-ink-500">O'rtacha (median)</p>
          <div className="mt-1 divide-y divide-ink-100 text-sm">
            <Kv label="Lid → birinchi qo'ng'iroq" value={row.first_call_min === null ? "—" : row.first_call_min < 120 ? `${row.first_call_min} daq` : `${Math.round(row.first_call_min / 60)} soat`} />
            <Kv label="Lid → buyurtma" value={row.lead_to_order_days === null ? "—" : `${row.lead_to_order_days} kun`} />
            <Kv label="Buyurtma → birinchi to'lov" value={doc.speed.order_to_paid_days === null ? "—" : `${doc.speed.order_to_paid_days} kun`} />
            <Kv label="Buyurtmalar summasi" value={row.order_sum ? `${short(row.order_sum)} so'm` : "—"} />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-base font-bold text-ink-900">amoCRM tartibi</h2>
          <p className="text-xs text-ink-500">Voronka to'g'ri ishlashi uchun</p>
          <div className="mt-1 divide-y divide-ink-100 text-sm">
            <Kv label="Birinchi bosqichda 2 kundan ortiq" value={`${num(doc.hygiene.stuck_first_stage)} lid`} bad={doc.hygiene.stuck_first_stage > 20} />
            <Kv label="Ishlatilmagan bosqichlar" value={doc.hygiene.unused_stages.length ? doc.hygiene.unused_stages.join(", ") : "yo'q ✓"} bad={doc.hygiene.unused_stages.length > 0} />
            <Kv label="ERP buyurtma / amoCRM'da yutildi" value={`${doc.hygiene.erp_orders} / ${doc.hygiene.amo_won}`} bad={doc.hygiene.erp_orders > doc.hygiene.amo_won * 1.5} />
            <Kv label="Sababsiz yo'qotilgan" value={`${doc.hygiene.lost_no_reason} / ${doc.hygiene.lost}`} bad={doc.hygiene.lost_no_reason > 0} />
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-500">
        «Gaplashildi» — lid yoki uning kontakti bilan {doc.talk_sec} soniyadan uzun qo'ng'iroq. Bosqichlar amoCRM tarixidan: keyin yo'qotilgan lid ham o'tgan bosqichlarida sanaladi. «Buyurtma» — lid telefoni ERP'dagi
        mijozga mos, lid kelgandan {doc.window_days} kun ichida buyurtma bor. Har 30 daqiqada yangilanadi
        {doc.updated_at ? ` · ${doc.updated_at.slice(0, 16).replace("T", " ")}` : ""}.
      </p>
    </div>
  );
}

const leakHint = (to: string) =>
  to.startsWith("Gaplash")
    ? "Javobsiz qo'ng'iroqlar va birinchi bosqichda turib qolganlar: lidga 15 daqiqada qo'ng'iroq."
    : to.startsWith("Ma'lumot")
      ? "Birinchi suhbatdan keyin keyingi qadam yo'q. Darslik: «Kontakt + Ramka» → SPIN savollar."
      : to.startsWith("Taklif")
        ? "Ma'lumot berildi, lekin narx yoki maket yuborilmadi — bosqichni amoCRM'da suring."
        : to.startsWith("Buyurtma")
          ? "Taklifdan keyin qaytish: 2–3 kunda qo'ng'iroq, e'tirozni so'rang."
          : "Buyurtma bor, pul yo'q — avans yoki to'lov sanasini kelishing.";

function Kv({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <span className="text-ink-700">{label}</span>
      <b className={`text-right tabular-nums ${bad ? "text-rose-600" : "text-ink-900"}`}>{value}</b>
    </div>
  );
}
