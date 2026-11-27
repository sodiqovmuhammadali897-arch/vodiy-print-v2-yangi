import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/AuthContext";
import { subscribeSince } from "../lib/firestoreDb";
import { formatMoney } from "../lib/format";
import { CELEBRATE_EVENT, firstName, isFresh, type CelebrateDetail, type Celebration as Row } from "../lib/celebrate";

// Mounted once in the Layout. A new order I saved → the dialog with the sound
// and confetti (window event from the order wizard); one typed by someone
// else for MY Managerlar record → the same dialog; anyone else's → a toast
// for 6 s (live from `celebrations`). See src/lib/celebrate.ts.
const COLORS = ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#fb923c"];

export default function Celebration() {
  const { user, staff } = useAuth();
  const me = (user?.email || "").toLowerCase();
  const myManagerId = staff?.report_manager_id || "";
  const [mine, setMine] = useState<CelebrateDetail | null>(null);
  const [toasts, setToasts] = useState<(Row & { id: string })[]>([]);
  const since = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());

  const show = (d: CelebrateDetail) => {
    setMine(d);
    try {
      const a = new Audio("/yangi-buyurtma.mp3");
      a.volume = 0.8;
      void a.play().catch(() => undefined);
    } catch {
      // no sound on this device
    }
  };

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<CelebrateDetail>).detail;
      if (d) show(d);
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => window.removeEventListener(CELEBRATE_EVENT, on);
  }, []);

  useEffect(() => {
    if (!me) return;
    return subscribeSince<Row>("celebrations", "created_at", since.current, (rows) => {
      const fresh = rows.filter((r) => isFresh(r, since.current) && !seen.current.has(r.id) && String(r.created_by_email).toLowerCase() !== me);
      if (!fresh.length) return;
      for (const r of fresh) seen.current.add(r.id);
      // An order typed for me by someone else (the owner): my full dialog.
      const forMe = myManagerId ? fresh.filter((r) => r.manager_id === myManagerId) : [];
      const last = forMe[forMe.length - 1];
      if (last) show({ ...last, kpi: Number(last.kpi) || 0, ratePct: Number(last.rate_pct) || 0, mine: true, hasManager: true });
      const others = fresh.filter((r) => !forMe.includes(r));
      if (!others.length) return;
      setToasts((cur) => [...cur, ...others].slice(-3));
      for (const r of others) window.setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== r.id)), 6500);
    });
  }, [me, myManagerId]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        rot: Math.random() * 360,
        color: COLORS[i % COLORS.length],
      })),
    [mine], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return createPortal(
    <>
      {mine && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Tabrik">
          <div className="modal-backdrop absolute inset-0 bg-ink-900/50" onClick={() => setMine(null)} />
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {confetti.map((c, i) => (
              <span key={i} className="vp-confetti" style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }} />
            ))}
          </div>
          <div className="modal-pop relative w-full max-w-[440px] rounded-3xl bg-surface p-7 text-center shadow-2xl">
            <div className="text-6xl leading-none">🎉</div>
            {mine.mine ? (
              <>
                <h2 className="mt-3 font-display text-2xl font-extrabold text-ink-900">Tabriklayman, {firstName(mine.manager_name || mine.created_by_name)}!</h2>
                <p className="mt-1 text-sm text-ink-600">Yangi buyurtmangiz bilan!</p>
              </>
            ) : (
              <>
                <h2 className="mt-3 font-display text-2xl font-extrabold text-ink-900">Tabriklaymiz!</h2>
                <p className="mt-1 text-sm text-ink-600">{mine.hasManager ? `${firstName(mine.manager_name)} yangi buyurtma oldi` : "Yangi buyurtma kiritildi"}</p>
              </>
            )}
            <div className="my-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-700 dark:bg-ink-800/40">
              {[mine.customer, mine.order_numbers.join(", ")].filter(Boolean).join(" · ")}
              <br />
              Buyurtma summasi: <b className="text-ink-900">{formatMoney(mine.total)}</b>
            </div>
            {(mine.mine || mine.hasManager) && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-lime-600 px-4 py-3 text-white">
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-90">{mine.mine ? "Sizning KPI'ingizga qo'shildi" : `${firstName(mine.manager_name)}ning KPI'siga qo'shildi`}</div>
              <div className="mt-0.5 font-display text-4xl font-extrabold" data-no-count>
                +{formatMoney(mine.kpi)}
              </div>
              <div className="text-xs opacity-90">summaning {String(mine.ratePct).replace(".", ",")} %i</div>
            </div>
            )}
            <button type="button" className="btn-primary mt-5 px-6" onClick={() => setMine(null)} autoFocus>
              Rahmat! 💪
            </button>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="fixed right-3 top-3 z-[65] flex w-[340px] max-w-[calc(100vw-24px)] flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className="modal-pop flex items-center gap-3 rounded-2xl border-l-4 border-emerald-500 bg-surface px-4 py-3 shadow-xl">
              <span className="text-3xl">🏆</span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-ink-900">{firstName(t.manager_name) || "Jamoa"} yangi buyurtma oldi!</div>
                <div className="truncate text-xs text-ink-600">{[t.customer, formatMoney(t.total)].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>,
    document.body,
  );
}
