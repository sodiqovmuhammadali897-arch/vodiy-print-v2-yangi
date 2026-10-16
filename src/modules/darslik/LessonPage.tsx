import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lightbulb, Pencil, PhoneCall, RotateCcw, XCircle } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { useLessons, type LiveLesson } from "./useLessons";
import { isRead, money, score } from "./lessonFacts";
import ScriptText from "./ScriptText";
import LessonEditor from "./LessonEditor";

const TABS = [
  { key: "about", label: "Mahsulot haqida" },
  { key: "kinds", label: "Turlari va material" },
  { key: "price", label: "Narx va muddat" },
  { key: "script", label: "📞 Sotuv senariysi" },
  { key: "objections", label: "E'tirozlar" },
  { key: "faq", label: "Savol-javob" },
  { key: "test", label: "Test" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function LessonPage() {
  const { key = "" } = useParams();
  const { isAdmin } = useAuth();
  const { lessons, progress, markSeen, saveQuiz } = useLessons();
  const lesson = lessons.find((l) => l.key === key);
  const [tab, setTab] = useState<Tab>("about");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (lesson) markSeen(lesson.key, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.key, tab]);

  if (!lesson) {
    return (
      <div className="card p-6 text-sm text-ink-600">
        Dars topilmadi. <Link to="/darslik" className="text-brand-700 underline">Darslikka qaytish</Link>
      </div>
    );
  }
  if (editing) return <LessonEditor lesson={lesson} onClose={() => setEditing(false)} />;

  const p = progress[lesson.key];
  return (
    <div className="space-y-4">
      <Link to="/darslik" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Darslik
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-3xl">{lesson.emoji}</div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-900">{lesson.title}</h1>
          <div className="text-sm text-ink-500">{lesson.category}</div>
        </div>
        {isRead(p) && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> O'qildi{typeof p?.quiz === "number" ? ` · test ${p.quiz}%` : ""}
          </span>
        )}
        <Link to={`/darslik/${lesson.key}/call`} className="btn-primary">
          <PhoneCall className="h-4 w-4" /> Qo'ng'iroq rejimi
        </Link>
        {isAdmin && (
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Tahrirlash
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Minimal tiraj" value={lesson.facts.tiraj ? `${lesson.facts.tiraj} dona` : null} />
        <Fact label="Narx" value={lesson.facts.narx} />
        <Fact label="Muddat" value={lesson.facts.muddat} />
        <Fact label="Kimga" value={lesson.audience} small />
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-100 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-semibold ${
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.label}
            {(p?.seen || []).includes(t.key) && tab !== t.key && <span className="ml-1 text-emerald-600">✓</span>}
          </button>
        ))}
      </div>

      {tab === "about" && <About lesson={lesson} />}
      {tab === "kinds" && <List items={lesson.kinds} />}
      {tab === "price" && <Price lesson={lesson} />}
      {tab === "script" && <Script lesson={lesson} />}
      {tab === "objections" && <QAList items={lesson.objections} quote />}
      {tab === "faq" && <QAList items={lesson.faq} />}
      {tab === "test" && <Test lesson={lesson} best={p?.quiz ?? null} onDone={(pct) => saveQuiz(lesson.key, pct)} />}
    </div>
  );
}

function Fact({ label, value, small }: { label: string; value: string | null; small?: boolean }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-xs text-ink-500">{label}</div>
      {value ? (
        <div className={`font-semibold text-ink-900 ${small ? "text-xs leading-snug" : "text-sm"}`}>{value}</div>
      ) : (
        <div className="text-xs text-amber-700">Mahsulotlarda kiritilmagan</div>
      )}
    </div>
  );
}

function About({ lesson }: { lesson: LiveLesson }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-3 p-5 text-[15px] leading-relaxed text-ink-700">
        {lesson.about.split(/\n\s*\n/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <div className="rounded-xl bg-ink-50 px-3 py-2 text-sm">
          <b>Kimga sotiladi:</b> {lesson.audience}
        </div>
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Yodda tuting</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
            {lesson.remember.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        {lesson.facts.products.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Tizimdagi mahsulotlar</h3>
            <ul className="space-y-1 text-sm">
              {lesson.facts.products.slice(0, 12).map((pr) => (
                <li key={pr.id}>
                  <Link to={`/products?id=${pr.id}`} className="text-brand-700 hover:underline">
                    {pr.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <div className="card p-5">
      <ul className="space-y-2 text-[15px] text-ink-700">
        {items.map((k, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
            {k}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Price({ lesson }: { lesson: LiveLesson }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ink-900">Narx nimaga bog'liq</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
          {lesson.priceNote.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
      <div className="card overflow-x-auto p-5">
        <h3 className="mb-2 font-semibold text-ink-900">Mahsulotlar narxi (Mahsulotlar bo'limidan)</h3>
        {lesson.facts.products.length ? (
          <table className="w-full text-sm">
            <tbody>
              {lesson.facts.products.slice(0, 12).map((pr) => (
                <tr key={pr.id} className="border-t border-ink-100 first:border-0">
                  <td className="py-1.5 pr-3">{pr.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-600">
                    {pr.base_price ? money(pr.base_price) : "—"}
                    {pr.min_order_qty ? ` · ${pr.min_order_qty} donadan` : ""}
                    {pr.lead_time_days ? ` · ${pr.lead_time_days} kun` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-amber-700">Bu darsga mos mahsulot topilmadi — Mahsulotlar bo'limida nomini tekshiring.</p>
        )}
      </div>
    </div>
  );
}

function Script({ lesson }: { lesson: LiveLesson }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {lesson.steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</div>
            <div className="card flex-1 rounded-tl-sm p-3.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">{s.title}</div>
              <div className="text-[15px] leading-relaxed text-ink-800">
                <ScriptText text={s.say} facts={lesson.facts} />
              </div>
              {s.note && <div className="mt-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">💡 {s.note}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Albatta so'rang</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
            {lesson.ask.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Lightbulb className="mb-1 h-4 w-4" />
          <b>Qo'shimcha sotuv:</b> {lesson.upsell}
        </div>
      </div>
    </div>
  );
}

function QAList({ items, quote }: { items: { q: string; a: string }[]; quote?: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((o, i) => (
        <div key={i} className="card p-4">
          <div className={`mb-1.5 font-semibold ${quote ? "text-orange-700" : "text-ink-900"}`}>{quote ? `Mijoz: «${o.q}»` : o.q}</div>
          <div className="text-[15px] leading-relaxed text-ink-700">{o.a}</div>
        </div>
      ))}
    </div>
  );
}

function Test({ lesson, best, onDone }: { lesson: LiveLesson; best: number | null; onDone: (pct: number) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const all = answers.every((a) => a !== null);
  const pct = score(answers, lesson.quiz.map((q) => q.correct));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {best !== null && <div className="text-sm text-ink-500">Eng yaxshi natijangiz: {best}%</div>}
      {lesson.quiz.map((q, qi) => (
        <div key={qi} className="card p-4">
          <div className="mb-2 font-semibold text-ink-900">
            {qi + 1}. {q.q}
          </div>
          <div className="space-y-1.5">
            {q.options.map((o, oi) => {
              const picked = answers[qi] === oi;
              const right = oi === q.correct;
              const cls = !checked
                ? picked
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-200 hover:bg-ink-50"
                : right
                  ? "border-emerald-400 bg-emerald-50"
                  : picked
                    ? "border-red-300 bg-red-50"
                    : "border-ink-200 opacity-70";
              return (
                <button
                  key={oi}
                  disabled={checked}
                  onClick={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${cls}`}
                >
                  {checked && right && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                  {checked && picked && !right && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                  {o}
                </button>
              );
            })}
          </div>
          {checked && <div className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{q.why}</div>}
        </div>
      ))}
      {!checked ? (
        <button
          className="btn-primary"
          disabled={!all}
          onClick={() => {
            setChecked(true);
            onDone(pct);
          }}
        >
          Natijani ko'rish
        </button>
      ) : (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="font-display text-2xl font-bold text-ink-900">{pct}%</div>
          <div className="flex-1 text-sm text-ink-600">{pct >= 80 ? "Zo'r! Bu mahsulotni ishonch bilan sotasiz." : "Senariy va e'tirozlarni yana bir o'qib chiqing."}</div>
          <button
            className="btn-secondary"
            onClick={() => {
              setAnswers(lesson.quiz.map(() => null));
              setChecked(false);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Qayta topshirish
          </button>
        </div>
      )}
    </div>
  );
}
