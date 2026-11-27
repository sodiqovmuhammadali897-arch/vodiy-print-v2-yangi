import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { deleteOne, insertOne, listAll, subscribeAll, subscribeOne, updateOne, upsertOne } from "../../lib/firestoreDb";
import Modal from "../../components/ui/Modal";
import { VIDEO_SECTIONS, embedUrl, sortVideos, teamProgress, thumbUrl, videoProblem, youtubeId, type VideoLesson } from "../../lib/videoLessons";
import type { Staff } from "../../lib/permissions";

// Darslik → «Video darslar» (2026-11-27). Unlisted YouTube videos played
// inside the ERP; «Ko'rdim» per person; the owner adds videos and sees who
// watched. Logic in src/lib/videoLessons.ts.
type ProgressDoc = { videos?: Record<string, string> };

export default function VideoPage() {
  const { user, isAdmin } = useAuth();
  const email = user?.email?.toLowerCase() || "";
  const [videos, setVideos] = useState<VideoLesson[] | null>(null);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<VideoLesson | "new" | null>(null);
  const [team, setTeam] = useState<{ email: string; name: string }[]>([]);
  const [watched, setWatched] = useState<Record<string, Record<string, string> | undefined>>({});

  useEffect(() => subscribeAll<VideoLesson>("lesson_videos", (rows) => setVideos(sortVideos(rows))), []);
  useEffect(() => {
    if (!email) return;
    return subscribeOne<ProgressDoc>("lesson_progress", email, (row) => setMine(row?.videos || {}));
  }, [email]);
  // The owner's table: sellers and their marks.
  useEffect(() => {
    if (!isAdmin) return;
    void Promise.all([listAll<Staff>("staff"), listAll<ProgressDoc & { id: string }>("lesson_progress")])
      .then(([staff, prog]) => {
        setTeam(staff.filter((s) => s.report_manager_id).map((s) => ({ email: s.email.toLowerCase(), name: s.full_name || s.email })));
        setWatched(Object.fromEntries(prog.map((p) => [p.id.toLowerCase(), p.videos])));
      })
      .catch(() => undefined);
  }, [isAdmin, mine]);

  const list = videos || [];
  const current = list.find((v) => v.id === params.get("v")) || list[0] || null;
  const doneCount = list.filter((v) => mine[v.id]).length;
  const rows = useMemo(() => teamProgress(list, team, watched), [list, team, watched]);
  const select = (id: string) => setParams({ v: id }, { replace: true });
  const markWatched = (id: string, on: boolean) => {
    if (!email) return;
    const videos = { ...mine };
    if (on) videos[id] = new Date().toISOString();
    else delete videos[id];
    setMine(videos);
    void upsertOne("lesson_progress", email, { email, updated_at: new Date().toISOString(), videos }).catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      <Link to="/darslik" className="btn-ghost -ml-2 inline-flex">
        <ArrowLeft className="h-4 w-4" /> Darslik
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">🎬 Video darslar</h1>
          <p className="text-sm text-ink-500">
            Ko'rib bo'lgach «Ko'rdim»ni bosing · siz {doneCount} / {list.length} ko'rdingiz
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn-primary" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" /> Video qo'shish
          </button>
        )}
      </div>

      {videos === null ? (
        <div className="aspect-video max-w-3xl animate-pulse rounded-2xl bg-ink-100/70" />
      ) : !list.length ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-surface p-10 text-center text-sm text-ink-500">
          {isAdmin ? (
            <>
              Hali video yo'q. YouTube'ga videoni <b>«Ro'yxatsiz» (Unlisted)</b> qilib yuklang, «Ulashish» → «Nusxalash» qilib havolani oling va <b>«Video qo'shish»</b>ni bosing.
            </>
          ) : (
            "Hali video dars qo'shilmagan."
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {current && (
            <section className="min-w-0 rounded-2xl border border-ink-100 bg-surface p-3 shadow-sm sm:p-4">
              <div className="aspect-video overflow-hidden rounded-xl bg-ink-900">
                <iframe
                  key={current.id}
                  src={embedUrl(current.youtube_id)}
                  title={current.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{current.section}</div>
                  <h2 className="font-display text-lg font-extrabold text-ink-900">{current.title}</h2>
                </div>
                {isAdmin && (
                  <span className="flex gap-1">
                    <button type="button" aria-label="Tahrirlash" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-50" onClick={() => setEdit(current)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="O'chirish"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                      onClick={() => window.confirm(`«${current.title}» o'chirilsinmi? (YouTube'dagi video o'chmaydi)`) && void deleteOne("lesson_videos", current.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
              {current.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{current.description}</p>}
              <div className="mt-3">
                {mine[current.id] ? (
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" onClick={() => markWatched(current.id, false)} title="Bekor qilish">
                    <CheckCircle2 className="h-4 w-4" /> Ko'rdingiz
                  </button>
                ) : (
                  <button type="button" className="btn-primary bg-emerald-600 hover:bg-emerald-700" onClick={() => markWatched(current.id, true)}>
                    ✓ Ko'rdim
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="space-y-4">
            <section className="rounded-2xl border border-ink-100 bg-surface p-3 shadow-sm">
              <div className="mb-2 px-1 text-sm font-extrabold text-ink-900">Ro'yxat · {list.length} ta video</div>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {list.map((v) => (
                  <button key={v.id} type="button" onClick={() => select(v.id)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${current?.id === v.id ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-ink-50"}`}>
                    <img src={thumbUrl(v.youtube_id)} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-lg bg-ink-100 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {v.title}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{v.section}</span>
                    </span>
                    <span className="text-base">{mine[v.id] ? "✅" : "⬜"}</span>
                  </button>
                ))}
              </div>
            </section>

            {isAdmin && rows.length > 0 && (
              <section className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                <div className="mb-2 text-sm font-extrabold text-ink-900">Kim ko'rdi</div>
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.email}>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-800">{r.name}</span>
                        <b className="tabular-nums text-ink-900">
                          {r.n}/{r.of}
                        </b>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.of ? (r.n / r.of) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {edit && <VideoForm video={edit === "new" ? null : edit} count={list.length} onClose={() => setEdit(null)} onSaved={(id) => select(id)} />}
    </div>
  );
}

function VideoForm({ video, count, onClose, onSaved }: { video: VideoLesson | null; count: number; onClose: () => void; onSaved: (id: string) => void }) {
  const { user, staff } = useAuth();
  const [f, setF] = useState({
    title: video?.title || "",
    url: video?.url || "",
    section: video?.section || VIDEO_SECTIONS[0],
    description: video?.description || "",
    order: String(video?.order ?? count + 1),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = youtubeId(f.url);
  const save = async () => {
    const p = videoProblem(f);
    if (p) return setError(p);
    setBusy(true);
    const data = { title: f.title.trim(), url: f.url.trim(), youtube_id: id, section: f.section, description: f.description.trim(), order: Number(f.order) || 0 };
    try {
      if (video) {
        await updateOne("lesson_videos", video.id, { ...data, updated_at: new Date().toISOString() });
        onSaved(video.id);
      } else {
        const r = await insertOne("lesson_videos", { ...data, created_by: staff?.full_name || user?.email || "" });
        onSaved(r.id);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={video ? "Videoni tahrirlash" : "Yangi video dars"}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Bekor
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>
            Saqlash
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/40">
          YouTube'ga videoni <b>«Ro'yxatsiz» (Unlisted)</b> qilib yuklang — u qidiruvda chiqmaydi, faqat havola bilan ochiladi. Keyin «Ulashish» → «Nusxalash» qilib havolani shu yerga qo'ying.
        </p>
        <div>
          <label className="label">YouTube havolasi</label>
          <input className="input" autoFocus placeholder="https://youtu.be/…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          {id && <img src={thumbUrl(id)} alt="" className="mt-2 h-24 rounded-lg object-cover" />}
        </div>
        <div>
          <label className="label">Nomi</label>
          <input className="input" placeholder="Masalan: 1-dars. Birinchi qo'ng'iroq" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <div>
            <label className="label">Bo'lim</label>
            <select className="input" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
              {VIDEO_SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tartib №</label>
            <input className="input" inputMode="numeric" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
        <div>
          <label className="label">Izoh (ixtiyoriy)</label>
          <textarea className="input min-h-[80px]" placeholder="Videoda nima o'rgatiladi" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}
