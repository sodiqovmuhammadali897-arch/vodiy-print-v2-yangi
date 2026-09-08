import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Send, Pencil, ClipboardPlus, X, CircleCheck } from "lucide-react";
import { subscribeWhere } from "../../lib/firestoreDb";
import { formatDateTime, formatMoney } from "../../lib/format";
import { leadStatusInfo, leadTaskTypeLabel, LEAD_STATUS_OPTIONS, columnForLead } from "../../lib/orderConstants";
import { completeLeadTaskWithFollowUp } from "../../lib/leadTasks";
import { moveLead } from "../../lib/leadStatusChange";
import { useAuth } from "../../lib/AuthContext";
import type { Lead, LeadActivity, LeadTask, LeadStatus, Order } from "../../lib/types";

type Props = {
  lead: Lead | null;
  order: Order | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onAddTask: (lead: Lead) => void;
  onLost: (lead: Lead) => void;
  onConvert: (lead: Lead) => void;
  onChanged: () => void;
};

export default function LeadDetailPanel({ lead, order, onClose, onEdit, onAddTask, onLost, onConvert, onChanged }: Props) {
  const { user, staff } = useAuth();
  const [tab, setTab] = useState<"info" | "tasks" | "activity">("info");
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = !!lead;

  useEffect(() => {
    if (!lead) return;
    setTab("info");
    const unsubTasks = subscribeWhere<LeadTask>("lead_tasks", "lead_id", lead.id, setTasks, { orderBy: ["created_at", "desc"] });
    const unsubActivities = subscribeWhere<LeadActivity>("lead_activities", "lead_id", lead.id, setActivities, {
      orderBy: ["created_at", "desc"],
    });
    return () => {
      unsubTasks();
      unsubActivities();
    };
  }, [lead?.id]);

  const complete = async (task: LeadTask) => {
    setBusyId(task.id);
    const actorEmail = user?.email?.toLowerCase() || "";
    const actorName = staff?.full_name || actorEmail;
    await completeLeadTaskWithFollowUp(task, actorEmail, actorName);
    setBusyId(null);
    onChanged();
  };

  const changeStatus = async (next: LeadStatus) => {
    if (!lead) return;
    const actorEmail = user?.email?.toLowerCase() || "";
    const actorName = staff?.full_name || actorEmail;
    try {
      await moveLead(lead, next, { email: actorEmail, name: actorName });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    }
  };

  const column = lead ? columnForLead(lead, order ? { [order.id]: order } : {}) : null;
  const info = column ? leadStatusInfo(column) : null;
  const isPreConversion = lead ? lead.status === "new" || lead.status === "info_given" || lead.status === "telegram" : false;
  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink-900/35 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[92vw] flex-col bg-surface shadow-pop transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {lead && (
          <>
            <div className="border-b border-ink-100 px-5 pb-3.5 pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-bold text-ink-400">{lead.lead_number}</div>
                  <div className="font-display text-lg font-bold text-ink-900">{lead.full_name}</div>
                  {lead.brand && <div className="text-xs text-ink-500">{lead.brand}</div>}
                </div>
                <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-600 hover:bg-ink-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {info && (
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: info.bg, color: info.text }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: info.dot }} />
                  {info.label}
                </span>
              )}
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <a
                  href={lead.phone ? `tel:${lead.phone.replace(/\s/g, "")}` : undefined}
                  className="flex flex-col items-center gap-1 rounded-xl border border-ink-100 bg-ink-50 py-2 text-[9.5px] font-bold text-ink-600"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Qo'ng'iroq
                </a>
                <a
                  href={lead.telegram ? `https://t.me/${lead.telegram.replace(/^@/, "")}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1 rounded-xl border border-ink-100 bg-ink-50 py-2 text-[9.5px] font-bold text-ink-600"
                >
                  <Send className="h-3.5 w-3.5" />
                  Telegram
                </a>
                <button
                  onClick={() => onEdit(lead)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-ink-100 bg-ink-50 py-2 text-[9.5px] font-bold text-ink-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Tahrirlash
                </button>
                <button
                  onClick={() => onAddTask(lead)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-ink-100 bg-ink-50 py-2 text-[9.5px] font-bold text-ink-600"
                >
                  <ClipboardPlus className="h-3.5 w-3.5" />
                  Vazifa
                </button>
              </div>
            </div>

            <div className="flex gap-4 border-b border-ink-100 px-5">
              {(["info", "tasks", "activity"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 py-2.5 text-xs font-bold ${
                    tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
                  }`}
                >
                  {t === "info" ? "Ma'lumot" : t === "tasks" ? `Vazifalar (${openTasks.length})` : "Faoliyat"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "info" && (
                <div>
                  <Field label="Telefon" value={lead.phone} />
                  <Field label="Telegram" value={lead.telegram || "-"} />
                  <Field label="Qiziqqan mahsulot" value={lead.interested_product_name || "-"} />
                  <Field label="Manba" value={lead.source || "-"} />
                  {lead.campaign_name && <Field label="Kampaniya" value={lead.campaign_name} />}
                  <Field label="Manager" value={lead.assigned_to_name || "-"} />
                  <Field label="Yaratilgan" value={formatDateTime(lead.created_at)} muted />
                  <Field label="Oxirgi aloqa" value={lead.last_contact_at ? formatDateTime(lead.last_contact_at) : "-"} muted />
                  <Field label="Keyingi aloqa" value={lead.next_contact_at ? formatDateTime(lead.next_contact_at) : "-"} highlight={!!lead.next_contact_at} />
                  <Field label="Taxminiy summa" value={lead.estimated_amount ? formatMoney(lead.estimated_amount) : "-"} />
                  {lead.status === "lost" && (
                    <Field label="Yo'qotilgan sababi" value={`${lead.lost_reason}${lead.lost_comment ? " — " + lead.lost_comment : ""}`} highlight />
                  )}
                  {lead.note && <div className="mt-3.5 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">"{lead.note}"</div>}

                  {lead.status !== "lost" && (
                    <div className="mt-4">
                      <label className="label">Statusni o'zgartirish</label>
                      <select className="input" value={column || lead.status} onChange={(e) => changeStatus(e.target.value as LeadStatus)}>
                        {LEAD_STATUS_OPTIONS.filter((o) => o.key !== "lost").map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!isPreConversion && lead.status !== "lost" && order && (
                    <Link
                      to={`/orders/${order.id}`}
                      className="mt-4 block rounded-xl bg-ink-50 px-3 py-2.5 text-center text-xs font-bold text-ink-600 hover:bg-ink-100"
                    >
                      Buyurtmani ochish →
                    </Link>
                  )}
                </div>
              )}

              {tab === "tasks" && (
                <div>
                  {tasks.length === 0 && <div className="py-6 text-center text-sm text-ink-400">Vazifalar yo'q</div>}
                  {openTasks.map((t) => (
                    <div key={t.id} className="flex gap-2.5 border-b border-ink-100 py-2.5">
                      <button
                        disabled={busyId === t.id}
                        onClick={() => complete(t)}
                        className="mt-0.5 h-[19px] w-[19px] shrink-0 rounded-md border-2 border-ink-300 hover:border-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink-800">{leadTaskTypeLabel(t.type)}</div>
                        <div className={`mt-0.5 text-[11px] ${t.due_date < new Date().toISOString().slice(0, 10) ? "font-bold text-rose-600" : "text-ink-500"}`}>
                          {t.due_date}, {t.due_time} · {t.assigned_to_name}
                        </div>
                        {t.note && <div className="mt-0.5 text-[11px] text-ink-500">{t.note}</div>}
                      </div>
                    </div>
                  ))}
                  {doneTasks.map((t) => (
                    <div key={t.id} className="flex gap-2.5 border-b border-ink-100 py-2.5 opacity-60">
                      <div className="mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
                        <CircleCheck className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink-800">{leadTaskTypeLabel(t.type)}</div>
                        <div className="mt-0.5 text-[11px] text-ink-500">Bajarildi · {t.completed_at ? formatDateTime(t.completed_at) : ""}</div>
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn-secondary mt-3 w-full justify-center"
                    onClick={() => onAddTask(lead)}
                  >
                    <ClipboardPlus className="h-4 w-4" />
                    Vazifa qo'shish
                  </button>
                </div>
              )}

              {tab === "activity" && (
                <div>
                  {activities.length === 0 && <div className="py-6 text-center text-sm text-ink-400">Faoliyat yo'q</div>}
                  {activities.map((a) => (
                    <div key={a.id} className="flex gap-2.5 pb-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink-800">{a.text}</div>
                        <div className="text-[10.5px] text-ink-400">
                          {a.actor_name} · {formatDateTime(a.created_at)}
                        </div>
                        {a.kind === "call" && a.call_recording_url && (
                          <audio className="mt-1.5 h-8 w-full max-w-xs" controls preload="none" src={a.call_recording_url} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isPreConversion && (
              <div className="flex gap-2 border-t border-ink-100 px-5 py-3.5">
                <button className="btn-danger" onClick={() => onLost(lead)}>
                  Yo'qotilgan
                </button>
                <button className="btn-primary flex-[2] justify-center" onClick={() => onConvert(lead)}>
                  Buyurtmaga aylantirish →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <span className="text-xs text-ink-500">{label}</span>
      <span
        className={`text-right text-sm font-semibold ${muted ? "text-ink-400 font-normal" : highlight ? "text-amber-700" : "text-ink-800"}`}
      >
        {value}
      </span>
    </div>
  );
}
