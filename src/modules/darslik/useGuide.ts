import { useEffect, useMemo, useState } from "react";
import { arrayUnion } from "firebase/firestore";
import { useAuth } from "../../lib/AuthContext";
import { listAll, subscribeAll, subscribeOne, upsertOne } from "../../lib/firestoreDb";
import { TOP, type GuideFacts, type GuideMeta, type GuideProgress } from "../../lib/guide";

type ProgressDoc = { guide?: GuideProgress };

// The guide's live facts (guide_facts, written by the server) and this
// person's marks on the path (lesson_progress/{email}.guide).
export function useGuide() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() || "";
  const [docs, setDocs] = useState<(GuideFacts | GuideMeta)[] | null>(null);
  const [mine, setMine] = useState<GuideProgress>({});
  const [images, setImages] = useState<Map<string, string>>(new Map());

  // Pictures come from the catalog (they are too big for the facts docs).
  useEffect(() => {
    void listAll<{ id: string; image_url?: string }>("products")
      .then((ps) => setImages(new Map(ps.filter((p) => p.image_url).map((p) => [p.id, p.image_url as string]))))
      .catch(() => setImages(new Map()));
  }, []);

  useEffect(() => subscribeAll<GuideFacts | GuideMeta>("guide_facts", setDocs), []);
  useEffect(() => {
    if (!email) return;
    return subscribeOne<ProgressDoc>("lesson_progress", email, (row) => setMine(row?.guide || {}));
  }, [email]);

  const { families, meta } = useMemo(() => {
    const all = docs || [];
    const meta = (all.find((d) => d.id === "_meta") as GuideMeta | undefined) || null;
    const families = (all.filter((d) => d.id !== "_meta") as GuideFacts[]).sort((a, b) => a.rank - b.rank);
    return { families, meta };
  }, [docs]);

  const save = (patch: Record<string, unknown>) => {
    if (!email) return;
    void upsertOne("lesson_progress", email, { email, updated_at: new Date().toISOString(), guide: patch }).catch(() => undefined);
  };
  const markSeen = (key: string) => {
    if (!(mine.seen || []).includes(key)) save({ seen: arrayUnion(key) });
  };
  const markSituations = () => save({ situations_at: new Date().toISOString() });
  const markShadow = () => save({ shadow_at: new Date().toISOString() });

  return { loading: docs === null, families, top: families.slice(0, TOP), meta, mine, images, markSeen, markSituations, markShadow };
}
