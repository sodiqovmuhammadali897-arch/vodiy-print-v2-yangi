import { db } from "./admin";
import { DEFAULT_WORK_SCHEDULE, type WorkSchedule } from "./types";

export const getWorkSchedule = async (): Promise<WorkSchedule> => {
  const snap = await db.collection("work_schedules").doc("default").get();
  if (!snap.exists) return DEFAULT_WORK_SCHEDULE;
  return { ...DEFAULT_WORK_SCHEDULE, ...(snap.data() as Partial<WorkSchedule>) };
};
