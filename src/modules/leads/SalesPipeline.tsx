import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Target } from "lucide-react";
import { getOne, listAll, listWhere, updateOne } from "../../lib/firestoreDb";
import {
  LEAD_STATUSES,
  LEAD_STATUS_OPTIONS,
  leadStatusInfo,
  orderStatusToLeadBucket,
  type LeadColumnKey,
} from "../../lib/orderConstants";
import { convertLeadToCustomer } from "../../lib/leadConversion";
import type { Lead, LeadStatus, Order } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { initialsOf } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";
import LeadFormModal from "./LeadFormModal";

const daysAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Bugun";
  if (diff === 1) return "1 kun";
  return `${diff} kun`;
};

export default function SalesPipeline() {
  const { isAdmin, can, user } = useAuth();
  const canEdit = can("leads", "edit");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const load = async () => {
    setLoading(true);
    const email = user?.email?.toLowerCase() || "";
    const [rows, staffRows] = await Promise.all([
      isAdmin ? listAll<Lead>("leads", { orderBy: ["created_at", "desc"] }) : listWhere<Lead>("leads", "assigned_to_email", email, { orderBy: ["created_at", "desc"] }),
      isAdmin ? listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }) : Promise.resolve<Staff[]>([]),
    ]);
    setLeads(rows);
    setStaffList(staffRows);

    const orderIds = Array.from(new Set(rows.map((l) => l.converted_order_id).filter((id): id is string => !!id)));
    const orderRows = await Promise.all(orderIds.map((id) => getOne<Order>("orders", id)));
    const orderMap: Record<string, Order> = {};
    orderRows.forEach((o, i) => {
      if (o) orderMap[orderIds[i]] = o;
    });
    setOrders(orderMap);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (managerFilter !== "all" && l.assigned_to_email !== managerFilter) return false;
      if (q && !`${l.full_name} ${l.phone}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search, managerFilter]);

  const columnFor = (lead: Lead): LeadColumnKey => {
    if (lead.status !== "awaiting_advance") return lead.status;
    const order = lead.converted_order_id ? orders[lead.converted_order_id] : undefined;
    return order ? orderStatusToLeadBucket(order.status) : "awaiting_advance";
  };

  const byStatus = useMemo(() => {
    const map = new Map<LeadColumnKey, Lead[]>();
    for (const s of LEAD_STATUSES) map.set(s.key, []);
    for (const l of filtered) map.get(columnFor(l))?.push(l);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, orders]);

  const changeStatus = async (lead: Lead, next: LeadStatus) => {
    if (next === lead.status) return;
    setBusyId(lead.id);
    try {
      if (next === "awaiting_advance") {
        await convertLeadToCustomer(lead);
      } else if (next === "lost") {
        const reason = prompt("Rad etish sababi:") || "";
        await updateOne("leads", lead.id, {
          status: "lost",
          lost_reason: reason.trim(),
          updated_at: new Date().toISOString(),
        });
      } else {
        await updateOne("leads", lead.id, {
          status: next,
          lost_reason: "",
          updated_at: new Date().toISOString(),
        });
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  };

  const openNew = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Sotuv bo'limi</h1>
          <p className="text-sm text-ink-500">Lid keladi → ishlov beriladi → mijozga aylanadi</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4" /> Yangi lid
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
        {isAdmin && staffList.length > 0 && (
          <select
            className="input w-auto !py-2 text-sm"
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
          >
            <option value="all">Barcha menejerlar</option>
            {staffList.map((s) => (
              <option key={s.email} value={s.email}>
                {s.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <AsyncState
        loading={loading}
        empty={filtered.length === 0}
        emptyLabel="Lidlar mavjud emas"
        emptyDescription="Yuqoridagi tugma orqali birinchi lidingizni qo'shing"
        emptyIcon={<Target className="h-5 w-5" />}
      >
        <div className="flex flex-1 gap-3.5 overflow-x-auto pb-2">
          {LEAD_STATUSES.map((col) => {
            const rows = byStatus.get(col.key) || [];
            return (
              <div key={col.key} className="flex w-64 shrink-0 flex-col rounded-2xl bg-ink-50/70 p-3">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-700">
                    <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
                    {col.label}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-500">
                    {rows.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 overflow-y-auto">
                  {rows.map((lead) => {
                    const converted = lead.status === "awaiting_advance";
                    const order = lead.converted_order_id ? orders[lead.converted_order_id] : undefined;
                    return (
                      <div
                        key={lead.id}
                        className={`rounded-xl border bg-surface p-3 shadow-sm ${
                          converted ? "border-emerald-300" : lead.status === "lost" ? "border-ink-200 opacity-60" : "border-ink-100"
                        }`}
                      >
                        <div className="text-sm font-bold text-ink-900">{lead.full_name}</div>
                        <div className="mt-0.5 text-xs tabular-nums text-ink-500">{lead.phone}</div>
                        {(lead.region || lead.industry) && (
                          <div className="mt-1 text-[11px] text-ink-400">
                            {[lead.region, lead.industry].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {lead.interested_product_name && (
                          <div className="mt-1.5">
                            <span className="chip bg-brand-50 text-brand-700">{lead.interested_product_name}</span>
                          </div>
                        )}
                        {lead.status === "lost" && lead.lost_reason && (
                          <div className="mt-1.5 text-[11px] text-rose-600">Sabab: {lead.lost_reason}</div>
                        )}
                        {converted && !lead.interested_product_name && lead.source && (
                          <div className="mt-1.5">
                            <span className="chip bg-ink-100 text-ink-600">{lead.source}</span>
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center justify-between">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700"
                            title={lead.assigned_to_name}
                          >
                            {lead.assigned_to_name ? initialsOf(lead.assigned_to_name) : "-"}
                          </span>
                          <span className="text-[11px] text-ink-400">{daysAgo(lead.created_at)}</span>
                        </div>

                        {converted ? (
                          <div className="mt-2.5 space-y-1.5">
                            <span className={`inline-flex chip ${leadStatusInfo(columnFor(lead)).cls}`}>
                              {leadStatusInfo(columnFor(lead)).label}
                            </span>
                            {order && (
                              <Link
                                to={`/orders/${order.id}`}
                                className="block rounded-lg bg-ink-50 px-2 py-1.5 text-center text-[11px] font-bold text-ink-600 hover:bg-ink-100"
                              >
                                Buyurtmani ochish →
                              </Link>
                            )}
                          </div>
                        ) : (
                          canEdit && (
                            <select
                              className="input mt-2.5 !py-1.5 text-xs"
                              value={lead.status}
                              disabled={busyId === lead.id}
                              onChange={(e) => changeStatus(lead, e.target.value as LeadStatus)}
                            >
                              {LEAD_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </AsyncState>

      <LeadFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lead={editingLead}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}
