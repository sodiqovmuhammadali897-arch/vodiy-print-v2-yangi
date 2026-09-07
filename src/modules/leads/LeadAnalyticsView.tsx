import { useEffect, useMemo, useState } from "react";
import { listAll } from "../../lib/firestoreDb";
import { LEAD_STATUS_OPTIONS, columnForLead } from "../../lib/orderConstants";
import { formatMoneyShort, initialsOf } from "../../lib/format";
import type { Lead, LeadTask, Order } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";
import TodayUsagePanel from "./TodayUsagePanel";

type Props = {
  leads: Lead[];
  orders: Record<string, Order>;
  staffList: Staff[];
  managerEmail: string;
};

const PALETTE = ["#0062db", "#0ea5e9", "#f59e0b", "#8b5cf6", "#059669", "#94a3b8"];

function KpiTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold" style={{ color: tone }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-500">{hint}</div>
    </div>
  );
}

function BarList({ rows, color = "#0062db" }: { rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <div className="py-4 text-center text-xs text-ink-400">Ma'lumot yo'q</div>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-ink-700">{r.label}</span>
            <span className="font-extrabold tabular-nums text-ink-900">{r.value}</span>
          </div>
          <div className="progress-track h-2">
            <div className="progress-bar" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadAnalyticsView({ leads, orders, staffList, managerEmail }: Props) {
  const [tasks, setTasks] = useState<LeadTask[]>([]);

  useEffect(() => {
    void listAll<LeadTask>("lead_tasks").then(setTasks);
  }, []);

  const scoped = useMemo(
    () => (managerEmail === "all" ? leads : leads.filter((l) => l.assigned_to_email === managerEmail)),
    [leads, managerEmail],
  );

  const total = scoped.length;
  const newCount = scoped.filter((l) => l.status === "new").length;
  const inProgress = scoped.filter((l) => l.status === "info_given" || l.status === "telegram").length;
  const converted = scoped.filter((l) => !!l.converted_order_id);
  const lost = scoped.filter((l) => l.status === "lost");
  const conversionRate = total > 0 ? ((converted.length / total) * 100).toFixed(0) : "0";
  const revenue = converted.reduce((s, l) => s + (l.converted_order_id ? Number(orders[l.converted_order_id]?.total_amount || 0) : 0), 0);
  const avgOrder = converted.length > 0 ? revenue / converted.length : 0;

  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of scoped) m.set(l.source || "Boshqa", (m.get(l.source || "Boshqa") || 0) + 1);
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    const slices: DonutSlice[] = top.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
    if (rest > 0) slices.push({ label: "Boshqa", value: rest, color: PALETTE[PALETTE.length - 1] });
    return slices;
  }, [scoped]);

  const funnelRows = useMemo(
    () =>
      LEAD_STATUS_OPTIONS.filter((s) => s.key !== "lost").map((s) => ({
        label: s.label,
        value: scoped.filter((l) => columnForLead(l, orders) === s.key).length,
      })),
    [scoped, orders],
  );

  const lostReasonRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lost) m.set(l.lost_reason || "Ko'rsatilmagan", (m.get(l.lost_reason || "Ko'rsatilmagan") || 0) + 1);
    return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [lost]);

  const productRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of scoped) {
      if (!l.interested_product_name) continue;
      m.set(l.interested_product_name, (m.get(l.interested_product_name) || 0) + 1);
    }
    return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [scoped]);

  const campaignRows = useMemo(() => {
    const m = new Map<string, { total: number; won: number }>();
    for (const l of scoped) {
      if (!l.campaign_name) continue;
      const row = m.get(l.campaign_name) || { total: 0, won: 0 };
      row.total += 1;
      if (l.converted_order_id) row.won += 1;
      m.set(l.campaign_name, row);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [scoped]);

  const managerRows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return staffList
      .map((s) => {
        const mine = scoped.filter((l) => l.assigned_to_email === s.email);
        const contacted = mine.filter((l) => !!l.first_contact_at);
        const won = mine.filter((l) => !!l.converted_order_id);
        const revenueByMgr = won.reduce((sum, l) => sum + (l.converted_order_id ? Number(orders[l.converted_order_id]?.total_amount || 0) : 0), 0);
        const responseMinutes = contacted
          .map((l) => (new Date(l.first_contact_at as string).getTime() - new Date(l.created_at).getTime()) / 60000)
          .filter((m) => m >= 0);
        const avgResponse = responseMinutes.length > 0 ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length : null;
        const overdue = tasks.filter((t) => t.assigned_to_email === s.email && t.status === "open" && t.due_date < todayStr).length;
        return {
          staff: s,
          total: mine.length,
          contacted: contacted.length,
          won: won.length,
          lost: mine.filter((l) => l.status === "lost").length,
          conversion: mine.length > 0 ? (won.length / mine.length) * 100 : 0,
          avgResponse,
          overdue,
          revenue: revenueByMgr,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [staffList, scoped, orders, tasks]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile label="Jami lidlar" value={String(total)} hint="Joriy tanlov bo'yicha" />
        <KpiTile label="Yangi lidlar" value={String(newCount)} hint="Hali ishlov berilmagan" tone="#0369a1" />
        <KpiTile label="Jarayondagi" value={String(inProgress)} hint="Voronkada harakatda" tone="#92400e" />
        <KpiTile label="Buyurtmaga aylangan" value={String(converted.length)} hint="Konversiya bo'lgan" tone="#047857" />
        <KpiTile label="Yo'qotilgan" value={String(lost.length)} hint="Sabab bilan qayd etilgan" tone="#be123c" />
        <KpiTile label="Konversiya" value={`${conversionRate}%`} hint="Lid → buyurtma" />
        <KpiTile label="Reklama xarajati" value="—" hint="Hali kiritilmagan (Meta integratsiyasi yoki qo'lda kiritish kerak)" />
        <KpiTile label="Lidlar orqali aylanma" value={formatMoneyShort(revenue) + " so'm"} hint="Buyurtmaga aylangan summasi" />
        <KpiTile label="O'rtacha buyurtma" value={avgOrder ? formatMoneyShort(avgOrder) + " so'm" : "—"} hint="Lid → buyurtma o'rtachasi" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Lidlar manbalari</h3>
          <p className="mb-3 text-xs text-ink-500">Jami {total} ta</p>
          <SimpleDonutChart data={sourceCounts} valueFormat="count" size={140} />
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Voronka bo'yicha taqsimot</h3>
          <p className="mb-3 text-xs text-ink-500">Hozirgi holat</p>
          <BarList rows={funnelRows} />
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Yo'qotilgan sabablar</h3>
          <p className="mb-3 text-xs text-ink-500">Jami {lost.length} ta</p>
          <BarList rows={lostReasonRows} color="#f43f5e" />
        </div>
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold text-ink-900">Mahsulotlar bo'yicha lidlar</h3>
          <p className="mb-3 text-xs text-ink-500">Eng ko'p qiziqilgan mahsulotlar</p>
          <BarList rows={productRows} color="#8b5cf6" />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-bold text-ink-900">Managerlar bo'yicha konversiya</h3>
        <p className="mb-3 text-xs text-ink-500">Manager KPI</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Manager</th>
                <th className="table-th">Lid</th>
                <th className="table-th">Aloqa</th>
                <th className="table-th">Buyurtma</th>
                <th className="table-th">Konv.</th>
                <th className="table-th">O'rt. javob</th>
                <th className="table-th">Kechikkan</th>
                <th className="table-th">Tushum</th>
              </tr>
            </thead>
            <tbody>
              {managerRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-td text-center text-ink-400">
                    Ma'lumot yo'q
                  </td>
                </tr>
              )}
              {managerRows.map((r) => (
                <tr key={r.staff.email} className="border-t border-ink-100">
                  <td className="table-td flex items-center gap-2 font-semibold text-ink-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-[9px] font-bold text-white">
                      {initialsOf(r.staff.full_name)}
                    </span>
                    {r.staff.full_name}
                  </td>
                  <td className="table-td tabular-nums">{r.total}</td>
                  <td className="table-td tabular-nums">{r.contacted}</td>
                  <td className="table-td tabular-nums">{r.won}</td>
                  <td className="table-td tabular-nums font-bold" style={{ color: r.conversion >= 40 ? "#047857" : "#92400e" }}>
                    {r.conversion.toFixed(0)}%
                  </td>
                  <td className="table-td tabular-nums">
                    {r.avgResponse === null ? "—" : r.avgResponse < 60 ? `${r.avgResponse.toFixed(0)} daq` : `${(r.avgResponse / 60).toFixed(1)} soat`}
                  </td>
                  <td className="table-td tabular-nums" style={{ color: r.overdue > 0 ? "#be123c" : undefined }}>
                    {r.overdue}
                  </td>
                  <td className="table-td tabular-nums">{formatMoneyShort(r.revenue)} so'm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-bold text-ink-900">Kampaniyalar bo'yicha natija</h3>
        <p className="mb-3 text-xs text-ink-500">Meta / Instagram reklama — xarajat hali kiritilmagan</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Kampaniya</th>
                <th className="table-th">Lid</th>
                <th className="table-th">Buyurtma</th>
                <th className="table-th">Xarajat</th>
                <th className="table-th">CPL</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-td text-center text-ink-400">
                    Kampaniya bilan bog'langan lid yo'q
                  </td>
                </tr>
              )}
              {campaignRows.map(([name, r]) => (
                <tr key={name} className="border-t border-ink-100">
                  <td className="table-td font-semibold text-ink-800">{name}</td>
                  <td className="table-td tabular-nums">{r.total}</td>
                  <td className="table-td tabular-nums">{r.won}</td>
                  <td className="table-td text-ink-400">—</td>
                  <td className="table-td text-ink-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TodayUsagePanel managerEmail={managerEmail} />
    </div>
  );
}
