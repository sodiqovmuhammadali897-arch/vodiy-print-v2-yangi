import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, SlidersHorizontal, LayoutGrid, List as ListIcon, BarChart3 } from "lucide-react";
import { listAll, subscribeAll, subscribeWhere, subscribeOne, type Unsubscribe } from "../../lib/firestoreDb";
import { LEAD_SOURCES } from "../../lib/orderConstants";
import { convertLeadToCustomer } from "../../lib/leadConversion";
import { moveLead } from "../../lib/leadStatusChange";
import { useAuth } from "../../lib/AuthContext";
import type { Lead, LeadStatus, LeadTask, Order, Product } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import LeadFormModal from "./LeadFormModal";
import LeadTaskModal from "./LeadTaskModal";
import LostLeadModal from "./LostLeadModal";
import LeadDetailPanel from "./LeadDetailPanel";
import LeadKanbanView from "./LeadKanbanView";
import LeadListView from "./LeadListView";
import LeadAnalyticsView from "./LeadAnalyticsView";
import TodayTasksPanel from "./TodayTasksPanel";
import LeadTaskToasts from "./LeadTaskToasts";

export type LeadFilters = {
  source: string;
  campaign: string;
  product: string;
  dateFrom: string;
  dateTo: string;
  overdueTaskOnly: boolean;
  contactTodayOnly: boolean;
};

const emptyFilters: LeadFilters = {
  source: "",
  campaign: "",
  product: "",
  dateFrom: "",
  dateTo: "",
  overdueTaskOnly: false,
  contactTodayOnly: false,
};

export default function SalesPipeline() {
  const { isAdmin, can, user } = useAuth();
  const canEdit = can("leads", "edit");
  const email = user?.email?.toLowerCase() || "";

  const [view, setView] = useState<"kanban" | "list" | "analytics">("kanban");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openTasks, setOpenTasks] = useState<LeadTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [filters, setFilters] = useState<LeadFilters>(emptyFilters);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [taskModalLead, setTaskModalLead] = useState<Lead | null>(null);
  const [lostModalLead, setLostModalLead] = useState<Lead | null>(null);

  // ── real-time leads ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    let unsub: Unsubscribe;
    if (isAdmin) {
      unsub = subscribeAll<Lead>("leads", (rows) => {
        setLeads(rows);
        setLoading(false);
      }, { orderBy: ["created_at", "desc"] });
    } else if (email) {
      unsub = subscribeWhere<Lead>("leads", "assigned_to_email", email, (rows) => {
        setLeads(rows);
        setLoading(false);
      }, { orderBy: ["created_at", "desc"] });
    } else {
      setLoading(false);
      unsub = () => {};
    }
    return () => unsub();
  }, [isAdmin, email]);

  // ── real-time linked orders (one listener per converted lead) ──────
  const orderUnsubsRef = useRef<Record<string, Unsubscribe>>({});
  useEffect(() => {
    const needed = new Set(leads.map((l) => l.converted_order_id).filter((id): id is string => !!id));
    const current = orderUnsubsRef.current;
    for (const id of Object.keys(current)) {
      if (!needed.has(id)) {
        current[id]();
        delete current[id];
        setOrders((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
    for (const id of needed) {
      if (!current[id]) {
        current[id] = subscribeOne<Order>("orders", id, (order) => {
          setOrders((prev) => (order ? { ...prev, [id]: order } : prev));
        });
      }
    }
  }, [leads]);
  useEffect(() => () => Object.values(orderUnsubsRef.current).forEach((u) => u()), []);

  // ── staff / products / open tasks (for filters) ─────────────────
  useEffect(() => {
    void listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }).then(setStaffList);
    void listAll<Product>("products", { orderBy: ["name", "asc"] }).then(setProducts);
  }, []);
  useEffect(() => {
    if (!email) return;
    const unsub = isAdmin
      ? subscribeAll<LeadTask>("lead_tasks", setOpenTasks)
      : subscribeWhere<LeadTask>("lead_tasks", "assigned_to_email", email, setOpenTasks);
    return () => unsub();
  }, [isAdmin, email]);

  const overdueLeadIds = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return new Set(openTasks.filter((t) => t.status === "open" && t.due_date < todayStr).map((t) => t.lead_id));
  }, [openTasks]);

  // ── filtering ────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);
    return leads.filter((l) => {
      if (managerFilter !== "all" && l.assigned_to_email !== managerFilter) return false;
      if (q) {
        const hay = `${l.full_name} ${l.brand} ${l.phone} ${l.telegram} ${l.lead_number || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.source && l.source !== filters.source) return false;
      if (filters.campaign && l.campaign_name !== filters.campaign) return false;
      if (filters.product && l.interested_product_id !== filters.product) return false;
      if (filters.dateFrom && l.created_at < filters.dateFrom) return false;
      if (filters.dateTo && l.created_at > filters.dateTo + "T23:59:59") return false;
      if (filters.overdueTaskOnly && !overdueLeadIds.has(l.id)) return false;
      if (filters.contactTodayOnly && (!l.next_contact_at || l.next_contact_at.slice(0, 10) !== todayStr)) return false;
      return true;
    });
  }, [leads, search, managerFilter, filters, overdueLeadIds]);

  const campaignOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.campaign_name).filter(Boolean))),
    [leads],
  );

  // ── actions ──────────────────────────────────────────────────────
  const actor = { email, name: user?.email || email };

  const openNew = () => {
    setEditingLead(null);
    setFormOpen(true);
  };
  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
    setSelectedLead(null);
  };

  const handleDrop = async (lead: Lead, columnKey: LeadStatus | "cancelled") => {
    if (!canEdit) return;
    if (columnKey === "cancelled") return;
    if (columnKey === "lost") {
      setLostModalLead(lead);
      return;
    }
    try {
      await moveLead(lead, columnKey, actor);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    }
  };

  const handleConvert = async (lead: Lead) => {
    try {
      await convertLeadToCustomer(lead, actor.email, actor.name);
      setSelectedLead(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    }
  };

  const selectedOrder = selectedLead?.converted_order_id ? orders[selectedLead.converted_order_id] || null : null;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Lidlar</h1>
          <p className="text-sm text-ink-500">Target, Instagram, Facebook, Telegram — barcha manbalardan tushgan lidlar</p>
        </div>
        <div className="flex items-center gap-2">
          <TodayTasksPanel />
          <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
            <ViewTab active={view === "kanban"} onClick={() => setView("kanban")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Kanban" />
            <ViewTab active={view === "list"} onClick={() => setView("list")} icon={<ListIcon className="h-3.5 w-3.5" />} label="Ro'yxat" />
            <ViewTab active={view === "analytics"} onClick={() => setView("analytics")} icon={<BarChart3 className="h-3.5 w-3.5" />} label="Analitika" />
          </div>
          {canEdit && (
            <button className="btn-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> Yangi lid
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon, brend, Telegram yoki lid ID..."
            className="w-64 bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
        {isAdmin && staffList.length > 0 && (
          <select className="input w-auto !py-2 text-sm" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="all">Barcha menejerlar</option>
            {staffList.map((s) => (
              <option key={s.email} value={s.email}>
                {s.full_name}
              </option>
            ))}
          </select>
        )}
        <button className="btn-ghost" onClick={() => setFilterPanelOpen((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" /> Filtrlar
        </button>
      </div>

      {filterPanelOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3.5 sm:grid-cols-4">
          <div>
            <label className="label">Manba</label>
            <select className="input !py-2 text-sm" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
              <option value="">Barchasi</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kampaniya</label>
            <select className="input !py-2 text-sm" value={filters.campaign} onChange={(e) => setFilters((f) => ({ ...f, campaign: e.target.value }))}>
              <option value="">Barchasi</option>
              {campaignOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mahsulot</label>
            <select className="input !py-2 text-sm" value={filters.product} onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}>
              <option value="">Barchasi</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="label">Sana — dan</label>
              <input className="input !py-2 text-sm" type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div>
              <label className="label">Sana — gacha</label>
              <input className="input !py-2 text-sm" type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
            <input type="checkbox" checked={filters.overdueTaskOnly} onChange={(e) => setFilters((f) => ({ ...f, overdueTaskOnly: e.target.checked }))} />
            Vazifasi kechikkanlar
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
            <input type="checkbox" checked={filters.contactTodayOnly} onChange={(e) => setFilters((f) => ({ ...f, contactTodayOnly: e.target.checked }))} />
            Keyingi aloqasi bugun
          </label>
          <button className="btn-ghost text-xs" onClick={() => setFilters(emptyFilters)}>
            Filtrlarni tozalash
          </button>
        </div>
      )}

      {view === "kanban" && (
        <LeadKanbanView
          leads={filteredLeads}
          orders={orders}
          loading={loading}
          canEdit={canEdit}
          onOpen={setSelectedLead}
          onEdit={openEdit}
          onAddTask={setTaskModalLead}
          onDrop={handleDrop}
        />
      )}
      {view === "list" && (
        <LeadListView leads={filteredLeads} orders={orders} loading={loading} onOpen={setSelectedLead} />
      )}
      {view === "analytics" && (
        <LeadAnalyticsView leads={leads} orders={orders} staffList={staffList} managerEmail={isAdmin ? managerFilter : email} />
      )}

      <LeadDetailPanel
        lead={selectedLead}
        order={selectedOrder}
        onClose={() => setSelectedLead(null)}
        onEdit={openEdit}
        onAddTask={setTaskModalLead}
        onLost={setLostModalLead}
        onConvert={handleConvert}
        onChanged={() => {
          if (selectedLead) {
            const fresh = leads.find((l) => l.id === selectedLead.id);
            if (fresh) setSelectedLead(fresh);
          }
        }}
      />

      <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        lead={editingLead}
        onSaved={() => setFormOpen(false)}
      />
      <LeadTaskModal
        open={!!taskModalLead}
        onClose={() => setTaskModalLead(null)}
        lead={taskModalLead}
        onSaved={() => setTaskModalLead(null)}
      />
      <LostLeadModal
        open={!!lostModalLead}
        onClose={() => setLostModalLead(null)}
        lead={lostModalLead}
        onDone={() => {
          setLostModalLead(null);
          setSelectedLead(null);
        }}
      />

      {email && <LeadTaskToasts email={email} />}
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
        active ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
