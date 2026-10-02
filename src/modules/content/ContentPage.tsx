import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Copy, History, Lightbulb, Loader2, Mic, Send, Sparkles, Upload } from "lucide-react";
import { subscribeAll } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { normalizeContentResult, type ContentResult } from "../../lib/contentResult";

// Kontent: drop a video, the Marketolog agent (meta-webhook/content.js)
// looks at its frames and answers with a score, what to fix and ready post
// texts. The same works by sending the video to the bot.

type Analysis = {
  id: string;
  status: "processing" | "done" | "failed";
  source: "site" | "telegram";
  by: string;
  file_name: string;
  size?: number | null;
  note?: string;
  duration?: number;
  width?: number;
  height?: number;
  error?: string;
  transcript?: { text: string; language?: string | null; segments?: { start: number; end: number; text: string }[] } | null;
  audio_note?: string | null;
  created_at: string;
  frames?: { t: number; thumb: string | null }[];
  result?: unknown;
};

const SCORE_LABELS: [keyof ContentResult["baholar"], string][] = [
  ["boshlanish", "Boshlanish (0–3 s)"],
  ["ekrandagi_matn", "Ekrandagi matn"],
  ["brend", "Brend va logotip"],
  ["sifat", "Sifat"],
  ["taklif", "Taklif"],
  ["nutq", "Gap (ovoz)"],
];
const MAX = 500 * 1024 * 1024;
const tone = (n: number) => (n >= 8 ? "#10b981" : n >= 6 ? "#f59e0b" : "#f43f5e");
const toneText = (n: number) => (n >= 8 ? "text-emerald-600 dark:text-emerald-400" : n >= 6 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400");
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const when = (iso: string | undefined) => {
  const ms = Date.parse(String(iso || ""));
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms + 5 * 3600e3).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}

export default function ContentPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeAll<Analysis>("content_analyses", setRows, { orderBy: ["created_at", "desc"] }), []);
  const current = rows.find((r) => r.id === selected) || (selected ? null : rows[0]) || null;

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) return setError("Bu video fayl emas");
    if (f.size > MAX) return setError(`Video ${Math.round(f.size / 1048576)} MB — 500 MB gacha bo'lishi kerak`);
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const token = await user?.getIdToken();
      const id = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/webhooks/content/analyze");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
        if (note.trim()) xhr.setRequestHeader("X-Note", encodeURIComponent(note.trim()));
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          const body = (() => {
            try {
              return JSON.parse(xhr.responseText || "{}");
            } catch {
              return {};
            }
          })();
          if (xhr.status === 202 && body.id) resolve(body.id);
          else reject(new Error(body.error || (xhr.status === 413 ? "Fayl juda katta" : `Yuklab bo'lmadi (${xhr.status})`)));
        };
        xhr.onerror = () => reject(new Error("Internet uzildi — qayta urinib ko'ring"));
        xhr.send(file);
      });
      setSelected(id);
      setFile(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
          <Sparkles className="h-3.5 w-3.5" /> Marketolog agent
        </div>
        <h1 className="mt-1 font-display text-[28px] font-extrabold leading-tight text-ink-900">Kontent</h1>
        <p className="text-sm text-ink-500">Videoni tashlang — agent tahlil qiladi, tavsiya va tayyor post matnini beradi</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            onClick={() => input.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${drag ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40" : "border-ink-200 hover:border-violet-400 hover:bg-ink-50/60"}`}
          >
            <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
              <Upload className="h-5 w-5" />
            </span>
            <div className="mt-3 font-display text-base font-bold text-ink-900">{file ? file.name : "Videoni shu yerga tashlang yoki tanlang"}</div>
            <div className="mt-1 text-xs text-ink-500">
              {file ? `${Math.round(file.size / 1048576)} MB` : "MP4 yoki MOV · 500 MB gacha · telefondan ham bo'ladi · tavsiya: vertikal 9:16, 15–30 soniya"}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" placeholder="Izoh (ixtiyoriy): kimga, qaysi mahsulot, aksiya…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" disabled={!file || progress !== null} onClick={() => void upload()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {progress !== null ? `Yuklanmoqda ${progress}%` : "Tahlil qilish"}
            </button>
          </div>
          {progress !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200/70">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <div className="mt-2 text-sm font-semibold text-rose-600">{error}</div>}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
            <Send className="h-3 w-3" /> Telegramda ham bo'ladi: botga (shaxsiy chat yoki 📣 Marketing mavzusi) video yuboring — 20 MB gacha.
          </p>
        </Card>

        <Card className="!p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
            <History className="h-4 w-4 text-ink-400" /> Oxirgi tahlillar
          </div>
          <div className="max-h-[260px] space-y-1 overflow-y-auto">
            {rows.slice(0, 30).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${current?.id === r.id ? "bg-violet-50 dark:bg-violet-950/40" : "hover:bg-ink-50"}`}
              >
                {Array.isArray(r.frames) && (r.frames[2]?.thumb || r.frames[0]?.thumb) ? (
                  <img src={`data:image/jpeg;base64,${r.frames[2]?.thumb || r.frames[0]?.thumb}`} alt="" className="h-10 w-7 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="inline-flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-400">
                    <Clapperboard className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-800">{r.file_name || "video"}</span>
                  <span className="block text-[11px] text-ink-400">
                    {when(r.created_at)} · {r.source === "telegram" ? "Telegram" : "sayt"} · {r.by}
                  </span>
                </span>
                {r.status === "done" && normalizeContentResult(r.result) ? (
                  <span className={`font-display text-sm font-extrabold tabular-nums ${toneText(normalizeContentResult(r.result)!.umumiy_baho)}`}>{normalizeContentResult(r.result)!.umumiy_baho}</span>
                ) : r.status === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                ) : (
                  <span className="text-[11px] font-bold text-rose-500">xato</span>
                )}
              </button>
            ))}
            {!rows.length && <div className="px-2 py-4 text-sm text-ink-400">Hali tahlil yo'q</div>}
          </div>
        </Card>
      </div>

      {current && <AnalysisView a={current} />}
    </div>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  const [copied, setCopied] = useState<number | null>(null);
  if (a.status === "processing") {
    return (
      <Card className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
        <div>
          <div className="font-semibold text-ink-900">Agent «{a.file_name}» ni ko'ryapti…</div>
          <div className="text-xs text-ink-500">Kadrlar ajratilyapti va tahlil qilinyapti — odatda 1–2 daqiqa. Sahifani yopsangiz ham natija saqlanadi.</div>
        </div>
      </Card>
    );
  }
  const parsed = normalizeContentResult(a.result);
  // Saved before the fix: frames are there but the answer came back empty.
  const r = parsed && (parsed.tavsiyalar.length || parsed.matnlar.length || parsed.qisqa_xulosa) ? parsed : null;
  if (a.status === "failed" || !r) {
    return <Card className="text-sm text-rose-600">«{a.file_name}» ni tahlil qilib bo'lmadi: {a.error || "AI javobi to'liq kelmagan — videoni qayta yuklang"}</Card>;
  }
  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-ink-400" />
              <h3 className="truncate font-display text-[15px] font-bold text-ink-900">{a.file_name}</h3>
            </div>
            <p className="text-xs text-ink-500">
              {Number(a.duration) ? `${Number(a.duration).toFixed(0)} s` : ""}
              {a.width ? ` · ${a.width}×${a.height}` : ""}
              {a.size ? ` · ${Math.round(a.size / 1048576)} MB` : ""} · {when(a.created_at)} · {a.by}
              {a.note ? ` · «${a.note}»` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {r.reklamaga_mos && <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🎯 Reklamaga mos</span>}
            <div className="text-right">
              <div className={`font-display text-3xl font-extrabold tabular-nums ${toneText(r.umumiy_baho)}`}>
                {r.umumiy_baho}
                <span className="text-base text-ink-400">/10</span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-700">{r.qisqa_xulosa}</p>
        {Array.isArray(a.frames) && a.frames.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {a.frames.map((f) => (
              <div key={f.t} className="relative shrink-0">
                {f.thumb ? <img src={`data:image/jpeg;base64,${f.thumb}`} alt="" className="h-32 rounded-xl object-cover" /> : <div className="h-32 w-20 rounded-xl bg-ink-100" />}
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">{mmss(f.t)}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`mt-4 grid grid-cols-2 gap-3 ${r.baholar.nutq ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-5"}`}>
          {SCORE_LABELS.map(([k, label]) => {
            const s = r.baholar?.[k];
            if (!s) return null;
            return (
              <div key={k} className="rounded-2xl bg-ink-50/70 p-3">
                <div className="text-[11px] font-semibold text-ink-500">{label}</div>
                <div className={`font-display text-xl font-extrabold ${toneText(s.ball)}`}>{s.ball}/10</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200/70">
                  <div className="h-full rounded-full" style={{ width: `${s.ball * 10}%`, background: tone(s.ball) }} />
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-ink-500">{s.izoh}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {a.transcript?.text && (
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink-900">
            <Mic className="h-4 w-4 text-sky-500" /> Videoda aytilgan gap
            <span className="text-xs font-normal text-ink-400">avtomatik yozib olingan — kichik xatolari bo'lishi mumkin</span>
          </div>
          {a.transcript.segments && a.transcript.segments.length ? (
            <div className="space-y-1.5">
              {a.transcript.segments.map((sg, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="w-12 shrink-0 font-semibold tabular-nums text-ink-400">{mmss(sg.start)}</span>
                  <span className="text-ink-800">{sg.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-800">{a.transcript.text}</p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink-900">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Tavsiyalar
          </div>
          <ul className="space-y-2">
            {r.tavsiyalar.map((t, i) => (
              <li key={i} className="flex gap-2.5 rounded-xl bg-ink-50/70 p-3 text-sm text-ink-700">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-extrabold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="rounded-xl border border-ink-100 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Qayerga</span>
              <div className="text-ink-800">{r.qayerga}</div>
            </div>
            <div className="rounded-xl border border-ink-100 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Qachon</span>
              <div className="text-ink-800">{r.vaqt}</div>
            </div>
          </div>
          {!a.transcript?.text && <p className="mt-3 text-[11px] text-ink-400">{a.audio_note || "Ovoz tahlil qilinmadi"} — faqat tasvir baholandi.</p>}
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink-900">
            <Sparkles className="h-4 w-4 text-violet-500" /> Tayyor matnlar
          </div>
          <div className="space-y-3">
            {r.matnlar.map((m, i) => {
              const full = `${m.matn}\n\n${m.heshteglar}`;
              return (
                <div key={i} className="rounded-2xl border border-ink-100 p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="rounded-lg bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {i + 1}-variant · {m.uslub}
                    </span>
                    <button type="button" onClick={() => void copy(i, full)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-50 hover:text-ink-900">
                      {copied === i ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === i ? "Nusxalandi" : "Nusxalash"}
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-sm text-ink-800">{m.matn}</p>
                  <p className="mt-1.5 text-sm text-blue-600 dark:text-blue-400">{m.heshteglar}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
