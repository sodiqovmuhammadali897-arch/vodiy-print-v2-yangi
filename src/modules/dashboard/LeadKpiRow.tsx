import { useEffect, useState } from "react";
import { PlusCircle, MessageCircleWarning, UserX, Clock, ClipboardCheck, CircleCheck as CheckCircle2 } from "lucide-react";
import { listAll, listWhere } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { startOfDay } from "../../lib/workdays";
import type { Lead, Task } from "../../lib/types";
import StatCard from "../../components/ui/StatCard";

export default function LeadKpiRow() {
  const { user, isAdmin, can } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const canSeeAllLeads = isAdmin || can("leads", "view");
  const canSeeAllTasks = isAdmin || can("tasks", "view");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [leadRows, taskRows] = await Promise.all([
        canSeeAllLeads
          ? listAll<Lead>("leads")
          : email
            ? listWhere<Lead>("leads", "assigned_to_email", email)
            : Promise.resolve([]),
        canSeeAllTasks
          ? listAll<Task>("tasks")
          : email
            ? listWhere<Task>("tasks", "assigned_to_email", email)
            : Promise.resolve([]),
      ]);
      if (!cancelled) {
        setLeads(leadRows);
        setTasks(taskRows);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeeAllLeads, canSeeAllTasks, email]);

  const dayStart = startOfDay(new Date()).toISOString();
  const todayDateStr = dayStart.slice(0, 10);

  const todayLeads = leads.filter((l) => l.created_at >= dayStart).length;
  const uncontacted = leads.filter((l) => l.status === "new").length;
  const unassigned = leads.filter((l) => !l.assigned_to_email && l.status !== "lost" && l.status !== "awaiting_advance").length;

  const overdueTasks = tasks.filter((t) => t.status === "new" && !!t.due_date && t.due_date < todayDateStr).length;
  const dueTodayTasks = tasks.filter((t) => t.status === "new" && t.due_date === todayDateStr).length;
  const doneTodayTasks = tasks.filter((t) => t.status === "done" && !!t.completed_at && t.completed_at >= dayStart).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title="Bugungi lidlar"
        value={todayLeads}
        hint="Bugun tushgan yangi lidlar"
        tone="sky"
        icon={<PlusCircle className="h-5 w-5" />}
      />
      <StatCard
        title="Gaplashilmagan lidlar"
        value={uncontacted}
        hint={`"Yangi" holatda, hali bog'lanilmagan`}
        tone="amber"
        icon={<MessageCircleWarning className="h-5 w-5" />}
      />
      <StatCard
        title="Ega tayinlanmagan lidlar"
        value={unassigned}
        hint="Menejer biriktirilmagan"
        tone="violet"
        icon={<UserX className="h-5 w-5" />}
      />
      <StatCard
        title="Kechiktirilgan vazifalar"
        value={overdueTasks}
        hint="Muddati o'tgan, hali yopilmagan"
        tone="rose"
        icon={<Clock className="h-5 w-5" />}
      />
      <StatCard
        title="Bugun bajarilishi kerak"
        value={dueTodayTasks}
        hint="Bugungi muddat bilan, ochiq"
        tone="amber"
        icon={<ClipboardCheck className="h-5 w-5" />}
      />
      <StatCard
        title="Bugun bajarilgan"
        value={doneTodayTasks}
        hint="Vazifalar, bugun yopilgan"
        tone="emerald"
        icon={<CheckCircle2 className="h-5 w-5" />}
      />
    </div>
  );
}
