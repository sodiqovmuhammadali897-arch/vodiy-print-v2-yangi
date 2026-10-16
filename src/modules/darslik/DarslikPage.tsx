import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Loader } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { listAll } from "../../lib/firestoreDb";
import { PRODUCT_CATEGORIES } from "../../lib/orderConstants";
import { useLessons } from "./useLessons";
import { isRead, lessonState, type LessonProgress } from "./lessonFacts";
import { LESSONS } from "./lessonsData";

const STATE = {
  done: { label: "O'qildi", cls: "bg-emerald-100 text-emerald-800" },
  started: { label: "Davom etyapti", cls: "bg-amber-100 text-amber-800" },
  new: { label: "Boshlanmagan", cls: "bg-ink-100 text-ink-600" },
};

export default function DarslikPage() {
  const { isAdmin } = useAuth();
  const { lessons, progress, loading } = useLessons();
  const [cat, setCat] = useState<string>("");
  const [view, setView] = useState<"lessons" | "team">("lessons");

  const cats = PRODUCT_CATEGORIES.filter((c) => lessons.some((l) => l.category === c));
  const shown = cat ? lessons.filter((l) => l.category === cat) : lessons;
  const read = lessons.filter((l) => isRead(progress[l.key])).length;
  const scores = lessons.map((l) => progress[l.key]?.quiz).filter((q): q is number => typeof q === "number");
  const avg = scores.length ? Math.round(scores.reduce((s, q) => s + q, 0) / scores.length) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Darslik</h1>
          <p className="text-sm text-ink-500">Har bir mahsulot: nima, kimga, qanday sotiladi — senariy, e'tirozlar va test</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Mening natijam: {read} / {lessons.length} o'qildi
          </span>
          {isAdmin && (
            <div className="flex rounded-xl border border-ink-200 bg-surface p-0.5 text-sm">
              {(["lessons", "team"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 font-medium ${view === v ? "bg-brand-600 text-white" : "text-ink-600"}`}
                >
                  {v === "lessons" ? "Darslar" : "Menejerlar natijasi"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "team" && isAdmin ? (
        <TeamResults />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {["", ...cats].map((c) => (
              <button
                key={c || "all"}
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1.5 text-sm ${cat === c ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-surface text-ink-600 hover:bg-ink-50"}`}
              >
                {c || "Hammasi"}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader className="h-4 w-4 animate-spin" /> Mahsulot ma'lumotlari yuklanmoqda…
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((l) => {
              const p = progress[l.key];
              const st = STATE[lessonState(p)];
              const seen = (p?.seen || []).length;
              return (
                <Link key={l.key} to={`/darslik/${l.key}`} className="card flex gap-3 p-4 transition hover:border-brand-300 hover:shadow-md">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-3xl">{l.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900">{l.title}</div>
                    <div className="truncate text-xs text-ink-500">
                      {l.category}
                      {l.facts.tiraj ? ` · ${l.facts.tiraj} donadan` : ""}
                      {l.facts.muddat ? ` · ${l.facts.muddat}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                        {st.label}
                        {typeof p?.quiz === "number" ? ` · test ${p.quiz}%` : ""}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${isRead(p) ? 100 : Math.min(100, (seen / 7) * 100)}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Darslar" value={String(lessons.length)} />
            <Stat label="Siz o'qidingiz" value={`${read}`} />
            <Stat label="O'rtacha test" value={avg === null ? "—" : `${avg}%`} />
            <Stat label="Mahsulotlar ulangan" value={String(new Set(lessons.flatMap((l) => l.facts.products.map((p) => p.id))).size)} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="font-display text-xl font-bold text-ink-900">{value}</div>
    </div>
  );
}

type StaffRow = { id: string; full_name?: string; role?: string; report_manager_id?: string | null; permissions?: Record<string, { view?: boolean }> };
type ProgressRow = { id: string; lessons?: Record<string, LessonProgress>; updated_at?: string };

// Admin: who read what and how they did in the tests.
function TeamResults() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  useEffect(() => {
    void Promise.all([listAll<StaffRow>("staff"), listAll<ProgressRow>("lesson_progress")]).then(([s, p]) => {
      setStaff(s);
      setRows(p);
    });
  }, []);

  const people = useMemo(() => {
    const byEmail = new Map(rows.map((r) => [r.id, r]));
    const sales = staff.filter((s) => s.report_manager_id || s.permissions?.leads?.view || byEmail.has(s.id));
    return sales
      .map((s) => {
        const p = byEmail.get(s.id)?.lessons || {};
        const read = LESSONS.filter((l) => isRead(p[l.key])).length;
        const scores = LESSONS.map((l) => p[l.key]?.quiz).filter((q): q is number => typeof q === "number");
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return { email: s.id, name: s.full_name || s.id, read, avg, last: byEmail.get(s.id)?.updated_at || null };
      })
      .sort((a, b) => b.read - a.read);
  }, [staff, rows]);

  const status = (read: number) =>
    read >= LESSONS.length * 0.8
      ? { t: "A'lo", c: "bg-emerald-100 text-emerald-800" }
      : read >= LESSONS.length * 0.3
        ? { t: "Davom etyapti", c: "bg-amber-100 text-amber-800" }
        : { t: "Orqada", c: "bg-red-100 text-red-800" };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-500">
            <th className="px-4 py-3">Menejer</th>
            <th className="px-4 py-3">O'qildi</th>
            <th className="px-4 py-3">O'rtacha test</th>
            <th className="px-4 py-3">Oxirgi o'qish</th>
            <th className="px-4 py-3">Holat</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const s = status(p.read);
            return (
              <tr key={p.email} className="border-t border-ink-100">
                <td className="px-4 py-2.5 font-medium text-ink-900">{p.name}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {p.read} / {LESSONS.length}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{p.avg === null ? "—" : `${p.avg}%`}</td>
                <td className="px-4 py-2.5 text-ink-500">{p.last ? p.last.slice(0, 10) : "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.c}`}>{s.t}</span>
                </td>
              </tr>
            );
          })}
          {!people.length && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                <BookOpen className="mx-auto mb-1 h-5 w-5" /> Hali hech kim o'qimagan
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-1.5 border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> Dars «o'qildi» — «Mahsulot haqida», «Sotuv senariysi» va «E'tirozlar» ochilganda.
      </div>
    </div>
  );
}
