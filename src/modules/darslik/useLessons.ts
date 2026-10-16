import { useEffect, useMemo, useState } from "react";
import { arrayUnion } from "firebase/firestore";
import { useAuth } from "../../lib/AuthContext";
import { deleteOne, listAll, subscribeAll, subscribeOne, upsertOne } from "../../lib/firestoreDb";
import { LESSONS, type Lesson } from "./lessonsData";
import { lessonFacts, type FactProduct, type LessonFacts, type LessonProgress } from "./lessonFacts";

export type LiveLesson = Lesson & { facts: LessonFacts; edited: boolean };
type Override = Partial<Lesson> & { id: string; updated_at?: string; updated_by?: string };
type ProgressDoc = { lessons?: Record<string, LessonProgress> };

// The lessons (starting text + admin edits from lessons/{key}) with their
// live product numbers, and this person's progress.
export function useLessons() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() || "";
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [products, setProducts] = useState<FactProduct[]>([]);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAll<Override>("lessons", setOverrides), []);
  useEffect(() => {
    void listAll<FactProduct>("products")
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!email) return;
    return subscribeOne<ProgressDoc>("lesson_progress", email, (row) => setProgress(row?.lessons || {}));
  }, [email]);

  const lessons: LiveLesson[] = useMemo(() => {
    const byKey = new Map(overrides.map((o) => [o.id, o]));
    return LESSONS.map((base) => {
      const o = byKey.get(base.key);
      const { id: _id, updated_at: _u, updated_by: _b, ...fields } = o || ({ id: "" } as Override);
      const merged = { ...base, ...fields, key: base.key } as Lesson;
      return { ...merged, facts: lessonFacts(merged, products), edited: Boolean(o) };
    });
  }, [overrides, products]);

  const markSeen = (key: string, tab: string) => {
    if (!email || (progress[key]?.seen || []).includes(tab)) return;
    void upsertOne("lesson_progress", email, {
      email,
      updated_at: new Date().toISOString(),
      lessons: { [key]: { seen: arrayUnion(tab), read_at: new Date().toISOString() } },
    }).catch(() => undefined);
  };

  const saveQuiz = (key: string, pct: number) => {
    if (!email) return;
    const best = Math.max(pct, Number(progress[key]?.quiz ?? -1));
    void upsertOne("lesson_progress", email, {
      email,
      updated_at: new Date().toISOString(),
      lessons: { [key]: { quiz: best, quiz_at: new Date().toISOString() } },
    }).catch(() => undefined);
  };

  return { lessons, progress, loading, markSeen, saveQuiz };
}

// Admin: save an edited lesson / go back to the starting text.
export const saveLesson = (key: string, fields: Partial<Lesson>, by: string) =>
  upsertOne("lessons", key, { ...fields, updated_at: new Date().toISOString(), updated_by: by });
export const resetLesson = (key: string) => deleteOne("lessons", key);
