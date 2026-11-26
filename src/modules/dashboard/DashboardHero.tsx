import { Rocket } from "lucide-react";

// The mission line, kept short so the day's numbers show on the first
// screen (2026-11-26, the owner approved the compact banner).
export default function DashboardHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-800/10 bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 px-6 py-4 text-white shadow-pop">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur sm:flex">
          <Rocket className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-extrabold leading-snug sm:text-xl">Birgalikda Farg'ona vodiysining eng yaxshi poligrafiya kompaniyasini quramiz.</h1>
          <p className="text-sm text-white/75">Siz jamoamizning eng muhim bo'lagisiz.</p>
        </div>
      </div>
    </section>
  );
}
