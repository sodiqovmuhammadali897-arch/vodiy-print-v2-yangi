import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  History,
  MessageSquare,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  Trophy,
  User,
} from "lucide-react";
import {
  deleteOne,
  listAll,
  subscribeAll,
  subscribeWhere,
} from "../../lib/firestoreDb";
import type { Holiday, Task, TaskStatus } from "../../lib/types";
import {
  TASK_PRIORITY,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  changeTaskStatus,
  priorityOf,
  statusOf,
} from "../../lib/taskStatus";
import {
  TaskComments,
  TaskFiles,
  TaskRating,
  TemplatesPanel,
  uploadTaskFiles,
} from "./TaskExtras";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { deadlineInfo } from "../../lib/workingDays";
import { formatDate, formatDateTime } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";
import TaskFormModal from "./TaskFormModal";

type Scope = "mine" | "given" | "all";
type Filter = "open" | "overdue" | TaskStatus | "all";

const mergeById = (a: Task[], b: Task[]) => [
  ...new Map([...a, ...b].map((t) => [t.id, t])).values(),
];

export default function Tasks() {
  const { user, staff: me, isAdmin } = useAuth();
  const email = (user?.email || "").toLowerCase();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>(isAdmin ? "all" : "mine");
  const [person, setPerson] = useState("");
  const [statusFilter, setStatusFilter] = useState<Filter>("open");
  const [finishing, setFinishing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<{
    id: string;
    kind: "comments" | "files";
  } | null>(null);
  const [proof, setProof] = useState<File[]>([]);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "recurring" | "rating">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setScope(isAdmin ? "all" : "mine"), [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }),
      listAll<Holiday>("holidays"),
    ]).then(([s, h]) => {
      if (cancelled) return;
      setStaff(s);
      setHolidays(h);
    });

    // Admins see every task; everyone else the tasks given to them and
    // the ones they gave (Firestore rules allow exactly that).
    const unsubs: (() => void)[] = [];
    if (isAdmin) {
      unsubs.push(
        subscribeAll<Task>("tasks", (rows) => {
          setTasks(rows);
          setLoading(false);
        }),
      );
    } else if (email) {
      let toMe: Task[] = [];
      let byMe: Task[] = [];
      unsubs.push(
        subscribeWhere<Task>("tasks", "assigned_to_email", email, (rows) => {
          toMe = rows;
          setTasks(mergeById(toMe, byMe));
          setLoading(false);
        }),
        subscribeWhere<Task>("tasks", "assigned_by_email", email, (rows) => {
          byMe = rows;
          setTasks(mergeById(toMe, byMe));
          setLoading(false);
        }),
      );
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [isAdmin, email]);

  const reloadMine = async () => {
    // Realtime subscriptions keep the list current.
  };

  const isOverdue = (t: Task) =>
    statusOf(t) !== "done" &&
    Boolean(deadlineInfo(t.due_date, holidays)?.overdue);

  // Tasks in the chosen scope (and person, for admins) — the cards count these.
  const inScope = useMemo(
    () =>
      tasks.filter((t) => {
        const to = t.assigned_to_email.toLowerCase() === email;
        const by = (t.assigned_by_email || "").toLowerCase() === email;
        if (scope === "mine" && !to) return false;
        if (scope === "given" && !by) return false;
        if (person && t.assigned_to_email.toLowerCase() !== person)
          return false;
        return true;
      }),
    [tasks, scope, person, email],
  );

  const counts = useMemo(() => {
    const c = { new: 0, in_progress: 0, done: 0, overdue: 0 };
    for (const t of inScope) {
      c[statusOf(t)]++;
      if (isOverdue(t)) c.overdue++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, holidays]);

  const filtered = useMemo(
    () =>
      inScope.filter((t) =>
        statusFilter === "all"
          ? true
          : statusFilter === "open"
            ? statusOf(t) !== "done"
            : statusFilter === "overdue"
              ? isOverdue(t)
              : statusOf(t) === statusFilter,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope, statusFilter, holidays],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (statusOf(a) !== statusOf(b))
          return (
            TASK_STATUS_ORDER[statusOf(a)] - TASK_STATUS_ORDER[statusOf(b)]
          );
        const pa = TASK_PRIORITY[priorityOf(a)].rank;
        const pb = TASK_PRIORITY[priorityOf(b)].rank;
        if (pa !== pb) return pa - pb;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db_ = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db_;
      }),
    [filtered],
  );

  const actor = { email, name: me?.full_name || email };
  const move = async (task: Task, status: TaskStatus, text = "") => {
    setBusyId(task.id);
    setFinishError(null);
    try {
      // Proof photos go in first, so the "done" notice can include them.
      if (status === "done" && proof.length)
        await uploadTaskFiles(task.id, proof, actor);
      await changeTaskStatus(task, status, actor, text.trim());
      setFinishing(null);
      setNote("");
      setProof([]);
      void reloadMine();
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusyId(null);
    }
  };

  // In-page confirmation — browser confirm() dialogs can be blocked.
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const remove = async (id: string) => {
    setConfirmDel(null);
    await deleteOne("tasks", id);
  };

  const CARDS: {
    key: Filter;
    label: string;
    value: number;
    tone: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "new",
      label: "Yangi",
      value: counts.new,
      tone: "text-sky-700 bg-sky-50 ring-sky-200",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      key: "in_progress",
      label: "Bajarilmoqda",
      value: counts.in_progress,
      tone: "text-amber-800 bg-amber-50 ring-amber-200",
      icon: <Play className="h-4 w-4" />,
    },
    {
      key: "done",
      label: "Bajarildi",
      value: counts.done,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      key: "overdue",
      label: "Kechikkan",
      value: counts.overdue,
      tone: "text-rose-700 bg-rose-50 ring-rose-200",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ];
  const SCOPES: { key: Scope; label: string }[] = [
    ...(isAdmin ? [{ key: "all" as Scope, label: "Hammasi" }] : []),
    { key: "mine", label: "Menga berilgan" },
    { key: "given", label: "Men bergan" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <ClipboardList className="h-6 w-6 text-brand-600" /> Vazifalar
          </h1>
          <p className="text-sm text-ink-500">
            {isAdmin
              ? "Barcha xodimlarning vazifalari"
              : "Sizga berilgan va siz bergan vazifalar"}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yangi vazifa
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ink-100">
        {(
          [
            [
              "list",
              "Vazifalar",
              <ClipboardList key="l" className="h-4 w-4" />,
            ],
            [
              "recurring",
              "Takrorlanuvchi",
              <Repeat key="r" className="h-4 w-4" />,
            ],
            ...(isAdmin
              ? [["rating", "Reyting", <Trophy key="t" className="h-4 w-4" />]]
              : []),
          ] as [typeof view, string, React.ReactNode][]
        ).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-semibold transition ${
              view === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {view === "recurring" && (
        <TemplatesPanel isAdmin={isAdmin} email={email} />
      )}
      {view === "rating" && isAdmin && (
        <TaskRating tasks={tasks} staff={staff} holidays={holidays} />
      )}

      {view === "list" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CARDS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  setStatusFilter(statusFilter === c.key ? "open" : c.key)
                }
                className={`rounded-2xl px-4 py-3 text-left ring-1 transition ${c.tone} ${statusFilter === c.key ? "ring-2" : "ring-transparent hover:ring-1"}`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                  {c.icon} {c.label}
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                  {c.value}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-ink-100 p-1">
              {SCOPES.map((sc) => (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => setScope(sc.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${scope === sc.key ? "bg-surface text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"}`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
            {isAdmin && (
              <select
                className="input w-auto"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              >
                <option value="">Barcha xodimlar</option>
                {staff.map((p) => (
                  <option key={p.email} value={p.email.toLowerCase()}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            )}
            <select
              className="input w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Filter)}
            >
              <option value="open">
                Bajarilmaganlar ({counts.new + counts.in_progress})
              </option>
              <option value="new">Yangi ({counts.new})</option>
              <option value="in_progress">
                Bajarilmoqda ({counts.in_progress})
              </option>
              <option value="overdue">Kechikkan ({counts.overdue})</option>
              <option value="done">Bajarildi ({counts.done})</option>
              <option value="all">Barchasi ({inScope.length})</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <AsyncState
              loading={loading}
              empty={sorted.length === 0}
              emptyLabel="Vazifalar mavjud emas"
              emptyIcon={<ClipboardList className="h-5 w-5" />}
            >
              <div className="divide-y divide-ink-100">
                {sorted.map((t) => {
                  const dl = deadlineInfo(t.due_date, holidays);
                  const isMine = t.assigned_to_email.toLowerCase() === email;
                  const st = statusOf(t);
                  // Firestore rules: the assignee, or an admin, can move a task;
                  // whoever gave it (or an admin) can edit or delete it.
                  const canMove = isMine || isAdmin;
                  const canManage =
                    isAdmin ||
                    (t.assigned_by_email || "").toLowerCase() === email;
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {priorityOf(t) === "high" && (
                            <span className={`chip ${TASK_PRIORITY.high.chip}`}>
                              🔴 Shoshilinch
                            </span>
                          )}
                          <span
                            className={`font-semibold ${priorityOf(t) === "low" ? "text-ink-600" : "text-ink-900"}`}
                          >
                            {t.title}
                          </span>
                          <span className={`chip ${TASK_STATUS[st].chip}`}>
                            {TASK_STATUS[st].label}
                          </span>
                          {t.template_id && (
                            <span className="chip gap-1 bg-violet-50 text-violet-700">
                              <Repeat className="h-3 w-3" /> Takroriy
                            </span>
                          )}
                          {t.order_id && (
                            <Link
                              to={`/orders/${t.order_id}`}
                              className="chip bg-brand-50 text-brand-700 hover:underline"
                            >
                              📦 {t.order_number || "Buyurtma"}
                            </Link>
                          )}
                          {t.customer_id && (
                            <Link
                              to={`/customers/${t.customer_id}`}
                              className="chip gap-1 bg-ink-100 text-ink-700 hover:underline"
                            >
                              <User className="h-3 w-3" />{" "}
                              {t.customer_name || "Mijoz"}
                            </Link>
                          )}
                          {st !== "done" && dl?.overdue && (
                            <span className="chip gap-1 bg-rose-100 text-rose-700">
                              <AlertTriangle className="h-3 w-3" /> Kechikkan
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">
                            {t.description}
                          </p>
                        )}
                        {st === "done" && t.result_note && (
                          <p className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-900">
                            <b>Natija:</b> {t.result_note}
                          </p>
                        )}
                        <div className="mt-1.5 text-xs text-ink-500">
                          Xodim:{" "}
                          <span className="font-medium text-ink-700">
                            {t.assigned_to_name}
                          </span>
                          {t.assigned_by_name &&
                            ` · Bergan: ${t.assigned_by_email?.toLowerCase() === email ? "siz" : t.assigned_by_name}`}
                          {t.due_date && ` · Muddat: ${formatDate(t.due_date)}`}
                          {st !== "new" &&
                            t.started_at &&
                            ` · Ishga olindi: ${formatDateTime(t.started_at)}`}
                          {st === "done" &&
                            t.completed_at &&
                            ` · Bajarildi: ${formatDateTime(t.completed_at)}`}
                          {(t.history?.length || 0) > 0 && (
                            <button
                              type="button"
                              className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                              onClick={() =>
                                setHistoryOpen(
                                  historyOpen === t.id ? null : t.id,
                                )
                              }
                            >
                              <History className="h-3 w-3" /> Tarix
                            </button>
                          )}
                          <button
                            type="button"
                            className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                            onClick={() =>
                              setPanel(
                                panel?.id === t.id && panel.kind === "comments"
                                  ? null
                                  : { id: t.id, kind: "comments" },
                              )
                            }
                          >
                            <MessageSquare className="h-3 w-3" /> Izohlar
                            {t.comment_count ? ` (${t.comment_count})` : ""}
                          </button>
                          <button
                            type="button"
                            className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                            onClick={() =>
                              setPanel(
                                panel?.id === t.id && panel.kind === "files"
                                  ? null
                                  : { id: t.id, kind: "files" },
                              )
                            }
                          >
                            <Paperclip className="h-3 w-3" /> Fayllar
                            {t.file_count ? ` (${t.file_count})` : ""}
                          </button>
                        </div>
                        {panel?.id === t.id && panel.kind === "comments" && (
                          <TaskComments task={t} actor={actor} />
                        )}
                        {panel?.id === t.id && panel.kind === "files" && (
                          <TaskFiles task={t} actor={actor} canAdd />
                        )}
                        {historyOpen === t.id && (
                          <ol className="mt-2 space-y-1 border-l-2 border-ink-100 pl-3 text-xs text-ink-600">
                            {(t.history || []).map((h, i) => (
                              <li key={i}>
                                <span
                                  className={`chip mr-1.5 ${TASK_STATUS[h.status]?.chip || ""}`}
                                >
                                  {TASK_STATUS[h.status]?.label || h.status}
                                </span>
                                {formatDateTime(h.at)} ·{" "}
                                {h.by_name || h.by_email}
                                {h.note && (
                                  <span className="text-ink-500">
                                    {" "}
                                    — {h.note}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                        {finishing === t.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              className="input min-w-[240px] flex-1"
                              placeholder="Nima qilindi? (ixtiyoriy: izoh yoki havola)"
                              value={note}
                              autoFocus
                              onChange={(e) => setNote(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && move(t, "done", note)
                              }
                            />
                            <label className="btn-secondary cursor-pointer">
                              <Paperclip className="h-4 w-4" />{" "}
                              {proof.length
                                ? `${proof.length} ta rasm`
                                : "Rasm / isbot"}
                              <input
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) =>
                                  setProof([...(e.target.files || [])])
                                }
                              />
                            </label>
                            <button
                              className="btn-primary"
                              onClick={() => move(t, "done", note)}
                              disabled={busyId === t.id}
                            >
                              <CheckCircle2 className="h-4 w-4" />{" "}
                              {busyId === t.id ? "Saqlanmoqda…" : "Tasdiqlash"}
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setFinishing(null);
                                setProof([]);
                                setFinishError(null);
                              }}
                            >
                              Bekor
                            </button>
                          </div>
                        )}
                        {finishing === t.id && finishError && (
                          <p className="mt-1 text-xs text-rose-700">
                            {finishError}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {canMove && st === "new" && (
                          <button
                            className="btn-secondary"
                            onClick={() => move(t, "in_progress")}
                            disabled={busyId === t.id}
                          >
                            <Play className="h-4 w-4" /> Ishga oldim
                          </button>
                        )}
                        {canMove && st !== "done" && finishing !== t.id && (
                          <button
                            className="btn-primary"
                            onClick={() => {
                              setFinishing(t.id);
                              setNote("");
                            }}
                            disabled={busyId === t.id}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Bajardim
                          </button>
                        )}
                        {canManage && st === "done" && (
                          <button
                            className="btn-ghost text-xs"
                            onClick={() =>
                              move(t, "in_progress", "Qayta ochildi")
                            }
                            disabled={busyId === t.id}
                          >
                            Qayta ochish
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              className="btn-ghost"
                              onClick={() => {
                                setEditing(t);
                                setModalOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {confirmDel === t.id ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-xs text-ink-600">
                                  O'chirilsinmi?
                                </span>
                                <button
                                  className="btn-secondary !px-2 !py-1 text-xs"
                                  onClick={() => setConfirmDel(null)}
                                >
                                  Yo'q
                                </button>
                                <button
                                  className="btn-primary !bg-rose-600 !px-2 !py-1 text-xs"
                                  onClick={() => remove(t.id)}
                                >
                                  Ha
                                </button>
                              </span>
                            ) : (
                              <button
                                className="btn-ghost text-rose-600 hover:bg-rose-50"
                                onClick={() => setConfirmDel(t.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AsyncState>
          </div>
        </>
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editing}
        staff={staff}
        onSaved={() => {
          setModalOpen(false);
          void reloadMine();
        }}
      />
    </div>
  );
}
