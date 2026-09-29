import { db } from "./admin";
import { DEFAULT_WORK_SCHEDULE, type WorkSchedule } from "./types";

// The general schedule (work_schedules/default), with the employee's own
// hours and days off (work_schedules/{email}) on top when they have one.
export const getWorkSchedule = async (email?: string): Promise<WorkSchedule> => {
  const col = db.collection("work_schedules");
  const [general, personal] = await Promise.all([
    col.doc("default").get(),
    email ? col.doc(email.toLowerCase()).get() : Promise.resolve(null),
  ]);
  const schedule = { ...DEFAULT_WORK_SCHEDULE, ...((general.exists ? general.data() : {}) as Partial<WorkSchedule>) };
  const own = personal && personal.exists ? (personal.data() as Partial<WorkSchedule>) : null;
  if (!own) return schedule;
  return {
    ...schedule,
    workStart: own.workStart || schedule.workStart,
    workEnd: own.workEnd || schedule.workEnd,
    offDays: Array.isArray(own.offDays) ? own.offDays : schedule.offDays,
  };
};
