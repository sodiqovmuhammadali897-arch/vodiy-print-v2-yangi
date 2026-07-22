import { Sparkles, Rocket } from "lucide-react";

export default function DashboardHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-800/10 bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-8 text-white shadow-pop sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-8 hidden opacity-80 sm:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
          <Rocket className="h-8 w-8 text-white" />
        </div>
      </div>
      <div className="relative max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Bizning missiya
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[42px]">
          Birgalikda Farg'ona vodiysining eng yaxshi poligrafiya kompaniyasini quramiz.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
          Katta maqsadlarga yolg'iz erishib bo'lmaydi. Farg'ona vodiysining eng
          yaxshi poligrafiya kompaniyasi bo'lish yo'lida Siz jamoamizning eng
          muhim bo'lagisiz.
        </p>
      </div>
    </section>
  );
}
