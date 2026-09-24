import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Bot, Loader, Play, Send } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";
import { AGENT_NAMES, OfficeScene, type AgentEvent, type AgentId } from "./officeScene";
import "./aiOffice.css";

type Pending = { id: string; summary: string; result?: string; busy?: boolean };

const EXAMPLES = [
  "Bizdan qancha qarzdorlik bor?",
  "Kans Printga qancha qarzimiz bor?",
  "Qaysi buyurtmalar kechikyapti?",
  "Omborda glans qog'oz qancha qoldi?",
];

const KIND_STYLE: Record<AgentEvent["kind"], string> = {
  alert: "border-l-rose-500",
  report: "border-l-emerald-500",
  answer: "border-l-emerald-500",
  question: "border-l-sky-500",
  proposed: "border-l-violet-500",
  action: "border-l-amber-500",
  cancelled: "border-l-ink-300",
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
const dayOf = (iso: string) => new Date(Date.parse(iso) + 5 * 3600 * 1000).toISOString().slice(0, 10);

// A short scripted tour for when nothing is happening — animation only,
// nothing is written anywhere.
const demoEvents = (): AgentEvent[] => {
  const now = new Date().toISOString();
  const e = (agent: AgentId, kind: AgentEvent["kind"], text: string, extra: Partial<AgentEvent> = {}): AgentEvent => ({
    id: `demo-${Math.random()}`, agent, kind, text, created_at: now, source: "demo", ...extra,
  });
  return [
    e("bot", "question", "Bizdan qancha qarzdorlik bor?", { source: "web" }),
    e("bot", "answer", "Namuna: jami qarz hisoblandi", { bubble: "Namuna: jami qarz hisoblandi", visit: "fin" }),
    e("bot", "proposed", "VP-125: Ishlab chiqarishda → Tayyor", { bubble: "Tasdiqlaysizmi? ⏳" }),
    e("bot", "action", "Namuna: VP-125 Tayyor bo'ldi", { bubble: "Bajarildi ✅", visit: "prod" }),
    e("bot", "action", "Namuna: omborga kirim", { bubble: "Bajarildi ✅", visit: "wh", detail: { direction: "in", item: "dona", quantity: 500 } }),
  ];
};

export default function AiOffice() {
  const { isAdmin, user } = useAuth();
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  const queueRef = useRef<AgentEvent[]>([]);
  const playingRef = useRef(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  const [walking, setWalking] = useState(0);
  const [view, setView] = useState<"3d" | "top">("3d");
  const [cmd, setCmd] = useState("");
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);

  const pump = async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    while (queueRef.current.length && sceneRef.current) {
      const ev = queueRef.current.shift()!;
      try {
        await sceneRef.current.play(ev);
      } catch {
        /* an animation glitch must never stop the feed */
      }
    }
    playingRef.current = false;
    setDemoPlaying(false);
  };

  useEffect(() => {
    if (!stageRef.current || !overlayRef.current) return;
    const scene = new OfficeScene(stageRef.current, overlayRef.current);
    scene.onChange = () => setWalking(scene.walkingCount);
    sceneRef.current = scene;

    let first = true;
    const seen = new Set<string>();
    const unsubEvents = onSnapshot(
      query(collection(db, "agent_events"), orderBy("created_at", "desc"), limit(40)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentEvent, "id">) }));
        setEvents(rows);
        if (first) {
          // history is shown in the feed and on the channel screen, not replayed
          first = false;
          rows.forEach((r) => seen.add(r.id));
          scene.seedChannel(
            rows.slice(0, 6).reverse().map((r) => ({
              from: r.kind === "question" ? (r.source === "web" ? "Sayt" : "Kanal") : AGENT_NAMES[r.agent] || r.agent,
              text: r.text,
              me: r.kind === "question",
            })),
          );
          return;
        }
        const fresh = rows.filter((r) => !seen.has(r.id)).reverse();
        fresh.forEach((r) => seen.add(r.id));
        if (fresh.length) {
          queueRef.current.push(...fresh);
          void pump();
        }
      },
      () => setError("Faoliyatni o'qib bo'lmadi — ruxsatingizni tekshiring."),
    );
    const unsubStatus = onSnapshot(collection(db, "agent_status"), (snap) => {
      const next: Record<string, boolean> = {};
      snap.docs.forEach((d) => {
        next[d.id] = Boolean(d.data().alert);
        scene.setAlert(d.id as AgentId, Boolean(d.data().alert));
      });
      setAlerts(next);
    });
    return () => {
      unsubEvents();
      unsubStatus();
      queueRef.current = [];
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeView = (v: "3d" | "top") => {
    setView(v);
    sceneRef.current?.setView(v);
  };

  const api = async (path: string, body: unknown) => {
    const token = await user?.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
    return data;
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setError(null);
    setReply(null);
    setPending([]);
    try {
      const data = await api("/webhooks/assistant", { text: q });
      setReply(data.reply);
      setPending(data.pending || []);
      setCmd("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSending(false);
    }
  };

  const decide = async (p: Pending, ok: boolean) => {
    setPending((list) => list.map((x) => (x.id === p.id ? { ...x, busy: true } : x)));
    try {
      const data = await api("/webhooks/assistant/confirm", { id: p.id, ok });
      setPending((list) => list.map((x) => (x.id === p.id ? { ...x, busy: false, result: data.message } : x)));
    } catch (e) {
      setPending((list) => list.map((x) => (x.id === p.id ? { ...x, busy: false, result: e instanceof Error ? e.message : "Xatolik" } : x)));
    }
  };

  const playDemo = () => {
    if (playingRef.current) return;
    setDemoPlaying(true);
    queueRef.current.push(...demoEvents());
    void pump();
  };

  const today = dayOf(new Date().toISOString());
  const todayCount = events.filter((e) => dayOf(e.created_at) === today).length;
  const alertCount = Object.values(alerts).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">AI Ofis</h1>
          <p className="text-sm text-ink-500">
            Virtual xodimlar jonli: ertalabki hisobotlar, kanaldagi savollar va tasdiqlangan buyruqlar shu yerda harakat bo'lib ko'rinadi.
          </p>
        </div>
        <button className="btn-secondary" onClick={playDemo} disabled={demoPlaying}>
          <Play className="h-4 w-4" /> Namoyish
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-full border border-ink-100 bg-surface px-3 py-1 text-ink-600">6 agent</span>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{6 - walking} stolida ishlayapti</span>
        <span className="rounded-full border border-ink-100 bg-surface px-3 py-1 text-ink-600">{walking} yo'lda</span>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{alertCount} ta e'tibor talab qiladi</span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Bugun {todayCount} ta voqea</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div ref={stageRef} className="ao-stage" role="img" aria-label="3D ofis: 6 ta AI agent o'z stollarida ishlayapti">
            <div ref={overlayRef} className="ao-overlay" />
            <div className="ao-hud">
              <button type="button" className={view === "3d" ? "on" : ""} onClick={() => changeView("3d")}>3D</button>
              <button type="button" className={view === "top" ? "on" : ""} onClick={() => changeView("top")}>Tepadan</button>
              <button type="button" aria-label="Yaqinlashtirish" onClick={() => sceneRef.current?.zoom(-4)}>＋</button>
              <button type="button" aria-label="Uzoqlashtirish" onClick={() => sceneRef.current?.zoom(4)}>－</button>
            </div>
            <div className="ao-hint">Aylantirish uchun suring, g'ildirak bilan yaqinlashtiring</div>
          </div>

          <div className="card space-y-3 p-4">
            {isAdmin ? (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(cmd);
                  }}
                >
                  <input
                    id="ai-office-command"
                    className="input"
                    value={cmd}
                    onChange={(e) => setCmd(e.target.value)}
                    placeholder="Hisobchiga yozing: savol yoki buyruq, masalan «VP-125 ni Tayyor qil»"
                    disabled={sending}
                  />
                  <button className="btn-primary shrink-0" type="submit" disabled={sending || !cmd.trim()}>
                    {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Yuborish
                  </button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((q) => (
                    <button key={q} type="button" className="rounded-full border border-ink-100 px-3 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-50" onClick={() => void send(q)} disabled={sending}>
                      {q}
                    </button>
                  ))}
                </div>
                {sending && <p className="text-sm text-ink-500">Hisobchi o'ylayapti… javob Telegram kanalga ham yoziladi.</p>}
                {reply && (
                  <div className="flex gap-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-800">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <div className="whitespace-pre-wrap">{reply}</div>
                  </div>
                )}
                {pending.map((p) => (
                  <div key={p.id} className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-ink-800">
                    <div className="whitespace-pre-wrap font-medium">{p.summary}</div>
                    {p.result ? (
                      <div className="font-semibold">{p.result}</div>
                    ) : (
                      <div className="flex gap-2">
                        <button className="btn-primary" disabled={p.busy} onClick={() => void decide(p, true)}>✅ Tasdiqlash</button>
                        <button className="btn-secondary" disabled={p.busy} onClick={() => void decide(p, false)}>❌ Bekor</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-ink-500">Hisobchiga buyruqni faqat admin bera oladi. Siz agentlar ishini shu yerda kuzatishingiz mumkin.</p>
            )}
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          </div>
        </div>

        <aside className="card space-y-3 p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Faoliyat</h2>
          {events.length === 0 ? (
            <p className="text-sm text-ink-500">
              Hali voqea yo'q. Ertalab 08:00 da agentlar hisobot yuboradi, Telegram kanalga yoki shu sahifaga yozilgan savollar ham shu yerda ko'rinadi.
            </p>
          ) : (
            <ol className="max-h-[720px] space-y-2 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className={`grid grid-cols-[42px_1fr] gap-2 rounded-xl border-l-4 bg-ink-50/60 px-3 py-2 ${KIND_STYLE[e.kind] || "border-l-ink-200"}`}>
                  <time className="pt-0.5 font-mono text-xs text-ink-500">{timeOf(e.created_at)}</time>
                  <div>
                    <div className="text-xs font-bold text-ink-900">
                      {AGENT_NAMES[e.agent] || e.agent}
                      {e.source === "web" && <span className="ml-1 font-medium text-ink-400">· saytdan</span>}
                    </div>
                    <div className="text-sm text-ink-700">{e.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
