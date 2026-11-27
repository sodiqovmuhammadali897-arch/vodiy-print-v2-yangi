// Darslik → «Video darslar» (owner, 2026-11-27: «darsliklar bo'limiga video
// dars joylamoqchiman … YouTube qilamiz»). A video is an unlisted YouTube
// video: the owner pastes its link, the ERP plays it inside. Each person
// marks «Ko'rdim» (lesson_progress/{email}.videos.{id}); the owner sees who
// watched what.

export type VideoLesson = {
  id: string;
  title: string;
  description: string;
  section: string;
  youtube_id: string;
  url: string;
  order: number;
  created_at?: string;
};

export const VIDEO_SECTIONS = ["Qo'ng'iroq tartibi", "E'tirozlar", "Mahsulot", "Dastur (ERP)", "Boshqa"];

// The 11-character id from any YouTube link (watch, youtu.be, shorts, embed,
// live) or the bare id. "" when it is not a YouTube link.
export function youtubeId(input: string): string {
  const s = String(input || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return "";
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.split("/")[1] || "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      if (m) id = m[2];
    }
  }
  return /^[\w-]{11}$/.test(id) ? id : "";
}

export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

// By section order, then the owner's number, then title.
export function sortVideos(list: VideoLesson[]): VideoLesson[] {
  const rank = (s: string) => {
    const i = VIDEO_SECTIONS.indexOf(s);
    return i < 0 ? VIDEO_SECTIONS.length : i;
  };
  return [...list].sort((a, b) => (a.order || 0) - (b.order || 0) || rank(a.section) - rank(b.section) || a.title.localeCompare(b.title));
}

// The owner's table: how many of the videos each person marked as watched.
export function teamProgress(videos: Pick<VideoLesson, "id">[], people: { email: string; name: string }[], watched: Record<string, Record<string, string> | undefined>) {
  const ids = new Set(videos.map((v) => v.id));
  return people
    .map((p) => {
      const mine = watched[p.email.toLowerCase()] || {};
      const n = Object.keys(mine).filter((id) => ids.has(id)).length;
      return { ...p, n, of: ids.size };
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

export function videoProblem(f: { title: string; url: string }): string | null {
  if (!f.title.trim()) return "Video nomini yozing.";
  if (!youtubeId(f.url)) return "Bu YouTube havolasi emas. YouTube'da «Ulashish» → «Nusxalash» qilib qo'ying.";
  return null;
}
