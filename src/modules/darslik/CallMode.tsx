import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useLessons } from "./useLessons";
import ScriptText from "./ScriptText";

// Qo'ng'iroq rejimi: the script one step at a time in large type, for
// reading during a call on the phone. "Mijoz nima dedi?" opens the ready
// answer to that objection.
export default function CallMode() {
  const { key = "" } = useParams();
  const { lessons } = useLessons();
  const lesson = lessons.find((l) => l.key === key);
  const [i, setI] = useState(0);
  const [reply, setReply] = useState<number | null>(null);

  if (!lesson) return <div className="card p-6 text-sm">Dars topilmadi.</div>;
  const step = lesson.steps[i];
  const last = i === lesson.steps.length - 1;
  const go = (n: number) => {
    setI(n);
    setReply(null);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-xl flex-col gap-3">
      <div className="rounded-2xl bg-brand-600 p-4 text-white">
        <div className="flex items-center justify-between text-xs opacity-85">
          <span>
            📞 Qo'ng'iroq rejimi · {lesson.emoji} {lesson.title}
          </span>
          <Link to={`/darslik/${lesson.key}`} aria-label="Yopish" className="rounded-lg p-1 hover:bg-white/15">
            <X className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-1 font-display text-xl font-bold">
          {i + 1}-qadam: {step.title}
        </div>
        <div className="mt-3 flex gap-1">
          {lesson.steps.map((_, n) => (
            <button key={n} onClick={() => go(n)} className={`h-1.5 flex-1 rounded-full ${n <= i ? "bg-white" : "bg-white/30"}`} aria-label={`${n + 1}-qadam`} />
          ))}
        </div>
      </div>

      <div className="card p-5 text-lg leading-relaxed text-ink-800">
        <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">Siz aytasiz</div>
        <ScriptText text={step.say} facts={lesson.facts} />
        {step.note && <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">💡 {step.note}</div>}
      </div>

      <div className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Mijoz nima dedi?</div>
      <div className="grid grid-cols-2 gap-2">
        {lesson.objections.map((o, n) => (
          <button
            key={n}
            onClick={() => setReply(reply === n ? null : n)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${reply === n ? "border-orange-300 bg-orange-50 text-orange-800" : "border-ink-200 bg-surface text-ink-700"}`}
          >
            «{o.q}»
          </button>
        ))}
      </div>
      {reply !== null && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[15px] leading-relaxed text-emerald-950">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">Javob: «{lesson.objections[reply].q}»</div>
          {lesson.objections[reply].a}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-2">
        <button className="btn-secondary flex-1 justify-center py-3" disabled={i === 0} onClick={() => go(i - 1)}>
          <ArrowLeft className="h-4 w-4" /> Orqaga
        </button>
        {last ? (
          <Link to={`/darslik/${lesson.key}`} className="btn-primary flex-1 justify-center py-3">
            Tugatish
          </Link>
        ) : (
          <button className="btn-primary flex-1 justify-center py-3" onClick={() => go(i + 1)}>
            Keyingi <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
