import { fillScript, type LessonFacts } from "./lessonFacts";

const LABEL = { narx: "narx", tiraj: "tiraj", muddat: "muddat" };

// Script text with {narx}/{tiraj}/{muddat} filled from the products; a
// missing number shows as an amber gap ("narx yo'q") to fill in Mahsulotlar.
export default function ScriptText({ text, facts }: { text: string; facts: LessonFacts }) {
  return (
    <>
      {fillScript(text, facts).map((p, i) =>
        !p.fact ? (
          <span key={i}>{p.text}</span>
        ) : p.missing ? (
          <span key={i} title="Mahsulotlar bo'limida bu ma'lumot yo'q" className="rounded bg-amber-100 px-1 text-amber-800">
            [{LABEL[p.fact]} yo'q]
          </span>
        ) : (
          <b key={i} className="text-ink-900">
            {p.text}
          </b>
        ),
      )}
    </>
  );
}
