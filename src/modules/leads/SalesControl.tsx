import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { listAll, listWhere, subscribeWhere } from "../../lib/firestoreDb";
import { formatMoneyShort } from "../../lib/format";
import { tashkentDay } from "../../lib/salesPeriod";
import type { AmoStat } from "../../lib/amoStats";
import type { AmoTaskDoc } from "../../lib/salesKpi";
import type { Manager, Order } from "../../lib/types";
import { attention, buildRows, LIMITS, monthShare, type ControlRow, type Flag, type RecallCall, type StaffLite } from "../../lib/salesControl";

// Sotuv bo'limi → Nazorat (admins): every sales manager's day on one page —
// calls and deals from amoCRM (meta-webhook/amocrm.js), sales, plan and
// unpaid orders from the ERP, old-customer calls from the bot (recall.js).
// Red is past a limit (lib/salesControl.ts LIMITS), yellow worth a look; a
// cell with a list opens it.

const REFRESH_MS = 2 * 60 * 1000;
const mln = formatMoneyShort;
const talk = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)} s ${Math.round((sec % 3600) / 60)} d` : `${Math.round(sec / 60)} d`);
const nowHm = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(11, 16);
const RESULT: Record<string, string> = { order: "✅ buyurtma", later: "🕒 keyinroq", no: "❌ kerak emas", noanswer: "📵 javob bermadi" };

type Detail = { title: string; description?: string; items: { main: string; sub?: string; tag?: string }[] };

function Cell({ flag, children, onClick }: { flag: Flag; children: React.ReactNode; onClick?: () => void }) {
  const tone = flag === "bad" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" : flag === "warn" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "";
  const body = <span className={`inline-block rounded-lg px-2 py-0.5 font-semibold tabular-nums ${tone}`}>{children}</span>;
  return onClick ? (
    <button type="button" onClick={onClick} className="hover:underline">
      {body}
    </button>
  ) : (
    body
  );
}

function PlanBar({ pct, share }: { pct: number | null; share: number }) {
  if (pct === null) return <span className="text-xs text-ink-400">reja yo'q</span>;
  const behind = pct < share * 100 - LIMITS.behindPct;
  return (
    <span className="relative inline-block h-2 w-24 rounded-full bg-ink-100 align-middle">
      <span className={`block h-full rounded-full ${behind ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      <span className="absolute -bottom-1 -top-1 w-0.5 rounded bg-ink-700" style={{ left: `${share * 100}%` }} />
    </span>
  );
}

export default function SalesControl() {
  const today = tashkentDay(new Date().toISOString());
  const month = today.slice(0, 7);
  const [stats, setStats] = useState<AmoStat[]>([]);
  const [tasks, setTasks] = useState<AmoTaskDoc[]>([]);
  const [staff, setStaff] = useState<StaffLite[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recall, setRecall] = useState<RecallCall[]>([]);
  const [hm, setHm] = useState(nowHm());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeWhere<AmoStat>("amo_stats", "month", month, setStats, undefined, () => setStats([])), [month]);
  useEffect(() => subscribeWhere<AmoTaskDoc>("amo_tasks", "month", month, setTasks, undefined, () => setTasks([])), [month]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [s, m, o, r] = await Promise.all([
        listAll<StaffLite & { id: string }>("staff").catch(() => []),
        listAll<Manager>("managers").catch(() => []),
        listAll<Order>("orders").catch(() => []),
        listWhere<RecallCall>("recall_calls", "day", today).catch(() => []),
      ]);
      if (!alive) return;
      setStaff(s);
      setManagers(m);
      setOrders(o);
      setRecall(r);
      setHm(nowHm());
      setLoaded(true);
    };
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [today]);

  const rows = useMemo(() => buildRows({ staff, managers, stats, tasks, orders, recall, today, nowHm: hm }), [staff, managers, stats, tasks, orders, recall, today, hm]);
  const share = monthShare(today);
  const sum = (f: (r: ControlRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = {
    todaySales: sum((r) => r.todaySales),
    todayOrders: sum((r) => r.todayOrders),
    monthSales: sum((r) => r.monthSales),
    plan: sum((r) => r.plan),
    calls: sum((r) => r.calls),
    missed: sum((r) => r.missed.length),
    noTask: sum((r) => r.noTaskCount),
    stale: sum((r) => r.staleCount),
    debt: sum((r) => r.debtSum),
    debtOrders: sum((r) => r.debt.length),
    tasksDue: sum((r) => r.tasksDue),
    tasksOpen: sum((r) => r.tasksOpen),
    recall: sum((r) => r.recall.length),
    recallDone: sum((r) => r.recall.filter((c) => c.status === "done").length),
  };
  const alerts = attention(rows);

  const open = {
    missed: (r: ControlRow) =>
      setDetail({ title: `${r.name} · javobsiz qo'ng'iroqlar`, description: "Kiruvchi qo'ng'iroq, hali qayta qo'ng'iroq qilinmagan.", items: r.missed.map((m) => ({ main: `${m.at} — ${m.lead_name || m.phone || "noma'lum"}`, sub: m.phone, tag: `${m.waiting_min} daqiqa kutyapti` })) }),
    noTask: (r: ControlRow) =>
      setDetail({
        title: `${r.name} · vazifasiz bitimlar`,
        description: `Keyingi vazifa yo'q: ${r.noTaskCount} ta${r.noTaskCount > r.noTask.length ? ` (eng kattalari ${r.noTask.length} tasi)` : ""}. amoCRM'da vazifa qo'yilsa, 2 daqiqada ro'yxatdan chiqadi.`,
        items: r.noTask.map((l) => ({ main: `${l.name} — ${mln(l.price)}`, sub: [l.stage, l.updated && `oxirgi harakat ${l.updated}`].filter(Boolean).join(" · "), tag: "vazifa yo'q" })),
      }),
    stale: (r: ControlRow) =>
      setDetail({
        title: `${r.name} · 3+ kun harakatsiz bitimlar`,
        description: `${r.staleCount} ta ochiq bitimda 3 kundan beri hech narsa o'zgarmagan.`,
        items: r.stale.map((l) => ({ main: `${l.name} — ${mln(l.price)}`, sub: [l.stage, l.updated && `oxirgi harakat ${l.updated}`].filter(Boolean).join(" · ") })),
      }),
    debt: (r: ControlRow) =>
      setDetail({
        title: `${r.name} · to'lanmagan buyurtmalar`,
        description: "Topshirilgan yoki yopilgan, lekin qoldig'i bor buyurtmalar.",
        items: r.debt.map((d) => ({ main: `${d.number || "—"} · ${d.title} — ${mln(d.remaining)}`, sub: `${d.days} kun oldin`, tag: d.days > LIMITS.oldDebtDays ? "eski qarz" : undefined })),
      }),
    recall: (r: ControlRow) =>
      setDetail({
        title: `${r.name} · eski mijozlar bugun`,
        items: r.recall.map((c) => ({ main: c.customer_name, sub: c.status === "done" ? RESULT[c.result || ""] || c.result : "hali belgilanmagan", tag: c.status === "done" ? undefined : "kutilmoqda" })),
      }),
  };

  if (!loaded) return <div className="py-16 text-center text-ink-500">Yuklanmoqda...</div>;

  const kpis: { label: string; value: string; sub: string; bad?: boolean }[] = [
    { label: "Savdo bugun", value: mln(total.todaySales), sub: `${total.todayOrders} buyurtma` },
    { label: "Oy boshidan", value: mln(total.monthSales), sub: total.plan ? `rejaning ${Math.round((total.monthSales / total.plan) * 100)}% · oyning ${Math.round(share * 100)}%` : "reja qo'yilmagan" },
    { label: "Qo'ng'iroqlar", value: String(total.calls), sub: `vazifalar: ${total.tasksDue - total.tasksOpen}/${total.tasksDue}` },
    { label: "Javobsiz", value: String(total.missed), sub: "qayta qo'ng'iroq qilinmagan", bad: total.missed > 0 },
    { label: "Vazifasiz bitim", value: String(total.noTask), sub: `3+ kun harakatsiz: ${total.stale}`, bad: total.noTask > 0 },
    { label: "To'lanmagan", value: mln(total.debt), sub: `${total.debtOrders} buyurtma` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-900">Sotuv nazorati</h2>
        <p className="text-sm text-ink-500">Bugun, {today.split("-").reverse().join(".")} · {hm} holati · amoCRM va ERP'dan har 2 daqiqada yangilanadi</p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Diqqat · {alerts.length} ta
          </div>
          {alerts.map((a) => (
            <div key={a.name}>
              <b>{a.name}:</b> {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.bad ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10" : "border-ink-100 bg-surface"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{k.label}</div>
            <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${k.bad ? "text-rose-600 dark:text-rose-400" : "text-ink-900"}`}>{k.value}</div>
            <div className="text-xs text-ink-500">{k.sub}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-500">Menejerlar topilmadi: amoCRM ulanmagan yoki xodimlarga Manager profili va reja qo'yilmagan.</div>
      ) : (
        <>
          {/* Computers: one table. */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">Menejer</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">Qo'ng'iroq</th>
                  <th className="px-3 py-2 text-left">Birinchisi</th>
                  <th className="px-3 py-2 text-left">Javobsiz</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">Ochiq bitim</th>
                  <th className="px-3 py-2 text-left">Vazifasiz</th>
                  <th className="px-3 py-2 text-left">3+ kun</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">Vazifalar</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">Oy boshidan</th>
                  <th className="px-3 py-2 text-left">Reja</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">To'lanmagan</th>
                  <th className="border-l border-ink-100 px-3 py-2 text-left">Eski mijoz</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-t border-ink-100">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-ink-900">{r.name}</div>
                      <div className="text-xs text-ink-500">{r.plan ? `Reja ${mln(r.plan)}` : "reja yo'q"}</div>
                    </td>
                    <td className="whitespace-nowrap border-l border-ink-100 px-3 py-3">
                      <Cell flag={r.flags.calls}>{r.calls}</Cell> <span className="text-xs text-ink-500">{talk(r.talkSec)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Cell flag={r.flags.first}>{r.first || "—"}</Cell>
                    </td>
                    <td className="px-3 py-3">
                      <Cell flag={r.flags.missed} onClick={r.missed.length ? () => open.missed(r) : undefined}>{r.missed.length}</Cell>
                    </td>
                    <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{r.open}</td>
                    <td className="px-3 py-3">
                      <Cell flag={r.flags.noTask} onClick={r.noTaskCount ? () => open.noTask(r) : undefined}>{r.noTaskCount}</Cell>
                    </td>
                    <td className="px-3 py-3">
                      <Cell flag={r.flags.stale} onClick={r.staleCount ? () => open.stale(r) : undefined}>{r.staleCount}</Cell>
                    </td>
                    <td className="border-l border-ink-100 px-3 py-3">
                      <Cell flag={r.flags.tasks}>
                        {r.tasksDue - r.tasksOpen}/{r.tasksDue}
                      </Cell>
                    </td>
                    <td className="whitespace-nowrap border-l border-ink-100 px-3 py-3 tabular-nums">
                      {mln(r.monthSales)}
                      {r.todaySales > 0 && <div className="text-xs text-emerald-600">bugun +{mln(r.todaySales)}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <PlanBar pct={r.pct} share={share} />{" "}
                      {r.pct !== null && (
                        <span className="text-xs">
                          <Cell flag={r.flags.plan}>{Math.round(r.pct)}%</Cell> → {r.forecast ? mln(r.forecast) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="border-l border-ink-100 px-3 py-3">
                      <Cell flag={r.flags.debt} onClick={r.debt.length ? () => open.debt(r) : undefined}>{r.debt.length ? mln(r.debtSum) : "0"}</Cell>
                    </td>
                    <td className="border-l border-ink-100 px-3 py-3">
                      <Cell flag={r.flags.recall} onClick={r.recall.length ? () => open.recall(r) : undefined}>
                        {r.recall.length ? `${r.recall.filter((c) => c.status === "done").length}/${r.recall.length}` : "—"}
                      </Cell>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-ink-200 bg-ink-50 font-semibold">
                  <td className="px-3 py-3">Jami</td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{total.calls}</td>
                  <td />
                  <td className="px-3 py-3 tabular-nums">{total.missed}</td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{sum((r) => r.open)}</td>
                  <td className="px-3 py-3 tabular-nums">{total.noTask}</td>
                  <td className="px-3 py-3 tabular-nums">{total.stale}</td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">
                    {total.tasksDue - total.tasksOpen}/{total.tasksDue}
                  </td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{mln(total.monthSales)}</td>
                  <td className="px-3 py-3 tabular-nums">{total.plan ? `${Math.round((total.monthSales / total.plan) * 100)}%` : "—"}</td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{mln(total.debt)}</td>
                  <td className="border-l border-ink-100 px-3 py-3 tabular-nums">{total.recall ? `${total.recallDone}/${total.recall}` : "—"}</td>
                </tr>
              </tbody>
            </table>
            <div className="flex flex-wrap gap-4 px-4 py-3 text-xs text-ink-500">
              <span>
                <Cell flag="bad">qizil</Cell> chegaradan oshgan
              </span>
              <span>
                <Cell flag="warn">sariq</Cell> e'tibor bering
              </span>
              <span>│ chiziq — bugungi kunga to'g'ri keladigan joy ({Math.round(share * 100)}%) · → shu sur'atda oy oxiri</span>
              <span>Raqamni bosing — ro'yxat ochiladi</span>
            </div>
          </div>

          {/* Phones: a card per manager. */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => {
              const chip = (label: string, value: React.ReactNode, flag: Flag, onClick?: () => void) => (
                <button
                  type="button"
                  disabled={!onClick}
                  onClick={onClick}
                  className={`rounded-xl px-3 py-2 text-left ${flag === "bad" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" : flag === "warn" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-ink-50 text-ink-900"}`}
                >
                  <div className="font-display text-base font-extrabold tabular-nums">{value}</div>
                  <div className="text-[11px] text-ink-500">{label}</div>
                </button>
              );
              return (
                <div key={r.email} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ink-900">{r.name}</div>
                    {r.pct !== null && <Cell flag={r.flags.plan}>{Math.round(r.pct)}%</Cell>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {chip("qo'ng'iroq", r.calls, r.flags.calls)}
                    {chip("javobsiz", r.missed.length, r.flags.missed, r.missed.length ? () => open.missed(r) : undefined)}
                    {chip("vazifasiz", r.noTaskCount, r.flags.noTask, r.noTaskCount ? () => open.noTask(r) : undefined)}
                    {chip("oy boshidan", mln(r.monthSales), null)}
                    {chip("to'lanmagan", r.debt.length ? mln(r.debtSum) : "0", r.flags.debt, r.debt.length ? () => open.debt(r) : undefined)}
                    {chip("eski mijoz", r.recall.length ? `${r.recall.filter((c) => c.status === "done").length}/${r.recall.length}` : "—", r.flags.recall, r.recall.length ? () => open.recall(r) : undefined)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title || ""} description={detail?.description}>
        <div className="space-y-2">
          {detail?.items.length === 0 && <div className="text-sm text-ink-500">Ro'yxat bo'sh.</div>}
          {detail?.items.map((it, i) => (
            <div key={i} className="rounded-xl border border-ink-100 px-3 py-2.5">
              <div className="text-sm font-semibold text-ink-900">{it.main}</div>
              {it.sub && <div className="text-xs text-ink-500">{it.sub}</div>}
              {it.tag && <span className="mt-1 inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{it.tag}</span>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
