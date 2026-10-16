import { useState, type ReactNode } from "react";
import { ArrowLeft, Loader, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { lessonByKey, type Lesson, type LessonStep, type QA, type QuizQ } from "./lessonsData";
import { resetLesson, saveLesson, type LiveLesson } from "./useLessons";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const input = "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// Admin: edit a lesson's text. Saved to lessons/{key}; «Asl matn» drops the
// edit and goes back to the starting text in lessonsData.ts.
export default function LessonEditor({ lesson, onClose }: { lesson: LiveLesson; onClose: () => void }) {
  const { user } = useAuth();
  const [d, setD] = useState<Lesson>(() => {
    const { facts: _f, edited: _e, ...rest } = lesson;
    return JSON.parse(JSON.stringify(rest)) as Lesson;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Lesson>(k: K, v: Lesson[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { key: _k, ...fields } = d;
      await saveLesson(lesson.key, fields, user?.email || "");
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Tahrirlar o'chiriladi va dars asl matnga qaytadi. Davom etilsinmi?")) return;
    setBusy(true);
    await resetLesson(lesson.key).catch(() => undefined);
    setBusy(false);
    onClose();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Bekor qilish
      </button>
      <h1 className="font-display text-2xl font-bold text-ink-900">
        {lesson.emoji} {lesson.title} — tahrirlash
      </h1>
      <p className="text-sm text-ink-500">
        Senariy matnida <code>{"{narx}"}</code>, <code>{"{tiraj}"}</code>, <code>{"{muddat}"}</code> — Mahsulotlar bo'limidagi raqamlar bilan o'zi to'ldiriladi.
      </p>

      <Box title="Asosiy">
        <Field label="Nomi">
          <input className={input} value={d.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Belgi (emoji)">
          <input className={input} value={d.emoji} onChange={(e) => set("emoji", e.target.value)} />
        </Field>
        <Field label="Kimga sotiladi">
          <input className={input} value={d.audience} onChange={(e) => set("audience", e.target.value)} />
        </Field>
        <Field label="Qaysi mahsulotlarga tegishli (nomidagi so'zlar, har biri yangi qatorda)">
          <textarea className={input} rows={2} value={d.match.join("\n")} onChange={(e) => set("match", lines(e.target.value))} />
        </Field>
      </Box>

      <Box title="Mahsulot haqida">
        <textarea className={input} rows={6} value={d.about} onChange={(e) => set("about", e.target.value)} />
        <Field label="Yodda tuting (har biri yangi qatorda)">
          <textarea className={input} rows={3} value={d.remember.join("\n")} onChange={(e) => set("remember", lines(e.target.value))} />
        </Field>
      </Box>

      <Box title="Turlari va material (har biri yangi qatorda)">
        <textarea className={input} rows={5} value={d.kinds.join("\n")} onChange={(e) => set("kinds", lines(e.target.value))} />
      </Box>
      <Box title="Narx nimaga bog'liq (har biri yangi qatorda)">
        <textarea className={input} rows={4} value={d.priceNote.join("\n")} onChange={(e) => set("priceNote", lines(e.target.value))} />
      </Box>
      <Box title="Albatta so'rang (har biri yangi qatorda)">
        <textarea className={input} rows={4} value={d.ask.join("\n")} onChange={(e) => set("ask", lines(e.target.value))} />
      </Box>

      <Box title="Sotuv senariysi — qadamlar">
        <Rows<LessonStep>
          items={d.steps}
          onChange={(v) => set("steps", v)}
          blank={{ title: "", say: "", note: "" }}
          render={(s, up) => (
            <>
              <input className={input} placeholder="Qadam nomi (masalan: Taklif)" value={s.title} onChange={(e) => up({ ...s, title: e.target.value })} />
              <textarea className={input} rows={3} placeholder="Menejer nima deydi" value={s.say} onChange={(e) => up({ ...s, say: e.target.value })} />
              <input className={input} placeholder="Maslahat (ixtiyoriy)" value={s.note || ""} onChange={(e) => up({ ...s, note: e.target.value })} />
            </>
          )}
        />
        <Field label="Qo'shimcha sotuv">
          <textarea className={input} rows={2} value={d.upsell} onChange={(e) => set("upsell", e.target.value)} />
        </Field>
      </Box>

      <Box title="E'tirozlar (mijoz nima deydi — javob)">
        <QARows items={d.objections} onChange={(v) => set("objections", v)} qLabel="Mijoz: «Qimmat ekan»" />
      </Box>
      <Box title="Savol-javob">
        <QARows items={d.faq} onChange={(v) => set("faq", v)} qLabel="Savol" />
      </Box>

      <Box title="Test">
        <Rows<QuizQ>
          items={d.quiz}
          onChange={(v) => set("quiz", v)}
          blank={{ q: "", options: ["", "", "", ""], correct: 0, why: "" }}
          render={(q, up) => (
            <>
              <input className={input} placeholder="Savol" value={q.q} onChange={(e) => up({ ...q, q: e.target.value })} />
              {q.options.map((o, oi) => (
                <label key={oi} className="flex items-center gap-2">
                  <input type="radio" checked={q.correct === oi} onChange={() => up({ ...q, correct: oi })} title="To'g'ri javob" />
                  <input className={input} placeholder={`${oi + 1}-variant`} value={o} onChange={(e) => up({ ...q, options: q.options.map((x, i) => (i === oi ? e.target.value : x)) })} />
                </label>
              ))}
              <input className={input} placeholder="Nega to'g'ri (tushuntirish)" value={q.why} onChange={(e) => up({ ...q, why: e.target.value })} />
            </>
          )}
        />
        <p className="text-xs text-ink-500">Doiracha — to'g'ri javob.</p>
      </Box>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Bekor qilish
          </button>
          {lesson.edited && lessonByKey(lesson.key) && (
            <button className="btn-ghost ml-auto text-ink-500" disabled={busy} onClick={() => void reset()}>
              <RotateCcw className="h-4 w-4" /> Asl matn
            </button>
          )}
          {msg && <span className="text-sm text-red-600">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function Rows<T>({ items, onChange, blank, render }: { items: T[]; onChange: (v: T[]) => void; blank: T; render: (item: T, update: (v: T) => void) => ReactNode }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-500">
            <span>{i + 1}</span>
            <button className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="O'chirish">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {render(it, (v) => onChange(items.map((x, n) => (n === i ? v : x))))}
        </div>
      ))}
      <button className="btn-secondary" onClick={() => onChange([...items, JSON.parse(JSON.stringify(blank)) as T])}>
        <Plus className="h-4 w-4" /> Qo'shish
      </button>
    </div>
  );
}

function QARows({ items, onChange, qLabel }: { items: QA[]; onChange: (v: QA[]) => void; qLabel: string }) {
  return (
    <Rows<QA>
      items={items}
      onChange={onChange}
      blank={{ q: "", a: "" }}
      render={(o, up) => (
        <>
          <input className={input} placeholder={qLabel} value={o.q} onChange={(e) => up({ ...o, q: e.target.value })} />
          <textarea className={input} rows={3} placeholder="Javob" value={o.a} onChange={(e) => up({ ...o, a: e.target.value })} />
        </>
      )}
    />
  );
}
