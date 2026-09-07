import { useEffect } from "react";
import { increment } from "firebase/firestore";
import { upsertOne } from "./firestoreDb";

const TICK_MS = 60_000;

const todayStr = (): string => new Date().toISOString().slice(0, 10);

// Runs once for the whole authenticated app (mounted in Layout). Every
// minute the tab is actually visible, it bumps today's activity_daily
// doc for the signed-in staff member by 60s — never counts a
// backgrounded or minimized tab, since a real "how long were they using
// the app" number is the point, not "how long was the tab open".
export const useActivityHeartbeat = (email: string | null, fullName: string) => {
  useEffect(() => {
    if (!email) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const date = todayStr();
      void upsertOne("activity_daily", `${date}_${email}`, {
        email,
        full_name: fullName,
        date,
        seconds: increment(TICK_MS / 1000),
        updated_at: new Date().toISOString(),
      });
    };

    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [email, fullName]);
};
