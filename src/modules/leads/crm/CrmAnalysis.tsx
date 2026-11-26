import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Modal from "../../../components/ui/Modal";
import { formatMoneyShort } from "../../../lib/format";
import { ANALYSIS_PERIODS, analysisSpan, crmAnalysis, type AnalysisPeriod, type Row } from "../../../lib/crmAnalysis";
import { columnLabel, columnOf } from "../../../lib/crm";
import type { Lead } from "../../../lib/types";
import type { CrmData } from "./useCrm";
import { useLeadHref } from "./leadLink";

// Sotuv bo'limi → Tahlil → «ERP tahlili» (step 4): the leads that came in a
// period — how far they got, which sources and managers turn them into
// orders, why they were lost. Every number opens its leads.
const pct = (x: number) => `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;

export default function CrmAnalysis({ crm }: { crm: CrmData }) {
  const leadHref = useLeadHref();
  const [period, setPeriod] = useState<AnalysisPeriod>("month");
  const [owner, setOwner] = useState(crm.isAdmin ? "" : crm.email);
  const [list, setList] = useState<{ title: string; leads: Lead[] } | null>(null);
  const a = useMemo(() => crmAnalysis({ leads: crm.leads || [], orders: crm.orders, span: analysisSpan(period), owner }), [crm.leads, crm.orders, period, owner]);
  const open = (title: string, pick: (l: Lead) => boolean) => setList({ title, leads: a.cohort.filter(pick) });
  const t = a.total;
  const max = Math.max(1, a.funnel[0]?.n || 0);

  if (!crm.leads) return <div className="h-40 animate-pulse rounded-3xl bg-ink-100/70" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-ink-200 bg-surface p-1">
          {ANALYSIS_PERIODS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === k ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>
              {label}
            </button>
          ))}
        </div>
        {crm.isAdmin && (
          <select className="input w-auto py-1.5 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Hamma menejerlar</option>
            {crm.sellers.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-ink-500">Davrda kelgan lidlar bo'yicha{a.fromAmo ? ` · ${a.fromAmo} tasi amoCRM'dan ko'chirilgan` : ""}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Lidlar" value={t.leads} sub={`${t.open} tasi hali ochiq`} onClick={() => open("Davrdagi lidlar", () => true)} />
        <Kpi label="Buyurtma bo'ldi" value={t.won} sub={`konversiya ${pct(t.conv)}`} tone="good" onClick={() => open("Buyurtma bo'lgan lidlar", a.isWon)} />
        <Kpi label="Savdo" value={t.sum ? formatMoneyShort(t.sum) : "—"} sub="shu lidlarning buyurtmalari" tone="good" onClick={() => open("Buyurtma bo'lgan lidlar", a.isWon)} />
        <Kpi label="Yo'qotildi" value={t.lost} sub={t.leads ? `${pct(t.lost / t.leads)} lidlar` : "—"} tone="bad" onClick={() => open("Yo'qotilgan lidlar", a.isLost)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Voronka" hint="lid qaysi bosqichgacha yetdi">
          <div className="space-y-1.5">
            {a.funnel.map((f, i) => (
              <button key={f.key} type="button" onClick={() => open(`«${f.label}» bosqichiga yetganlar`, (l) => a.reached(l, f.i))} className="grid w-full grid-cols-[120px_1fr_70px] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-ink-50">
                <span className="truncate text-ink-700">{f.label}</span>
                <span className="h-4 rounded bg-ink-100">
                  <span className="block h-full rounded" style={{ width: `${(f.n / max) * 100}%`, background: f.color, minWidth: f.n ? 4 : 0 }} />
                </span>
                <span className="text-right tabular-nums">
                  <b className="text-ink-900">{f.n}</b>
                  {i > 0 && a.funnel[i - 1].n ? <span className="ml-1 text-ink-400">{pct(f.n / a.funnel[i - 1].n)}</span> : null}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-400">Yo'qotilgan lid qaysi bosqichda yopilgani saqlanmagan — u faqat birinchi qatorda sanaladi.</p>
        </Card>
        <Card title="Nega yo'qotdik" hint={`${t.lost} ta lid`}>
          {a.reasons.length ? (
            <div className="space-y-1.5">
              {a.reasons.map((r) => (
                <button key={r.label} type="button" onClick={() => open(`Yo'qotildi: ${r.label}`, (l) => a.isLost(l) && (l.lost_reason || "Sababsiz") === r.label)} className="grid w-full grid-cols-[150px_1fr_32px] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-ink-50">
                  <span className="truncate text-ink-700">{r.label}</span>
                  <span className="h-3.5 rounded bg-ink-100">
                    <span className="block h-full rounded bg-rose-400" style={{ width: `${(r.n / Math.max(1, a.reasons[0].n)) * 100}%` }} />
                  </span>
                  <b className="text-right tabular-nums text-ink-900">{r.n}</b>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-400">Bu davrda yo'qotilgan lid yo'q</p>
          )}
        </Card>
      </div>

      <RowsTable title="Manbalar" hint="qayerdan kelgan lid buyurtma bo'ladi" rows={a.sources} onPick={(r, what) => open(`${r.label}${what ? ` · ${what}` : ""}`, (l) => (l.source || "Boshqa") === r.key && (what === "buyurtma" ? a.isWon(l) : what === "yo'qotildi" ? a.isLost(l) : true))} />
      {!owner && <RowsTable title="Menejerlar" hint="kimning lidi buyurtmaga aylanadi" rows={a.managers} onPick={(r, what) => open(`${r.label}${what ? ` · ${what}` : ""}`, (l) => (l.assigned_to_email || "") === r.key && (what === "buyurtma" ? a.isWon(l) : what === "yo'qotildi" ? a.isLost(l) : true))} />}

      <Modal open={!!list} onClose={() => setList(null)} title={list ? `${list.title} · ${list.leads.length}` : ""} size="lg">
        <div className="max-h-[60vh] divide-y divide-ink-100 overflow-y-auto">
          {list?.leads.map((l) => {
            const col = columnOf(l, crm.orders);
            return (
              <Link key={l.id} to={leadHref(l.id)} onClick={() => setList(null)} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 py-2 text-sm hover:bg-ink-50">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{l.brand || l.full_name || l.phone || l.lead_number}</span>
                <span className="text-xs text-ink-500">{[l.lead_number, l.source, l.assigned_to_name, l.status === "lost" ? `yo'qotildi: ${l.lost_reason || "—"}` : col ? columnLabel(col) : "bekor"].filter(Boolean).join(" · ")}</span>
              </Link>
            );
          })}
          {!list?.leads.length && <p className="p-6 text-center text-sm text-ink-500">Lid yo'q</p>}
        </div>
      </Modal>
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick }: { label: string; value: number | string; sub: string; tone?: "good" | "bad"; onClick: () => void }) {
  const color = value === 0 || !tone ? "text-ink-900" : tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-ink-100 bg-surface px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-sm">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-3xl font-extrabold leading-none ${color}`}>{value}</div>
      <div className="mt-1.5 text-xs text-ink-500">{sub}</div>
    </button>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-4">
      <h3 className="mb-3 font-display text-sm font-extrabold text-ink-900">
        {title} {hint && <span className="ml-1 font-sans text-xs font-normal text-ink-500">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}

function RowsTable({ title, hint, rows, onPick }: { title: string; hint: string; rows: Row[]; onPick: (r: Row, what: "" | "buyurtma" | "yo'qotildi") => void }) {
  return (
    <Card title={title} hint={hint}>
      {rows.length ? (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-2 py-1.5 font-semibold" />
                <th className="px-2 py-1.5 text-right font-semibold">Lid</th>
                <th className="px-2 py-1.5 text-right font-semibold">Buyurtma</th>
                <th className="px-2 py-1.5 text-right font-semibold">Konversiya</th>
                <th className="px-2 py-1.5 text-right font-semibold">Savdo</th>
                <th className="px-2 py-1.5 text-right font-semibold">Yo'qotildi</th>
                <th className="px-2 py-1.5 text-right font-semibold">Ochiq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.key || "none"}>
                  <td className="max-w-[180px] truncate px-2 py-1.5 font-semibold text-ink-900">{r.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <button type="button" className="hover:underline" onClick={() => onPick(r, "")}>
                      {r.leads}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <button type="button" className="font-semibold text-emerald-700 hover:underline disabled:font-normal disabled:text-ink-400 dark:text-emerald-300" disabled={!r.won} onClick={() => onPick(r, "buyurtma")}>
                      {r.won}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-700">{r.leads ? pct(r.conv) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-700">{r.sum ? formatMoneyShort(r.sum) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <button type="button" className="text-rose-600 hover:underline disabled:text-ink-400" disabled={!r.lost} onClick={() => onPick(r, "yo'qotildi")}>
                      {r.lost}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-500">{r.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-ink-400">Bu davrda lid yo'q</p>
      )}
    </Card>
  );
}
