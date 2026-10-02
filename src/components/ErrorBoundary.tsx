import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

// A page that throws while rendering shows this instead of a blank screen;
// the menu and the other pages keep working. `resetKey` (the route) clears
// it when the user goes elsewhere.
type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Page crashed", error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A new deploy removed the old page files: a reload fetches the new ones.
    const stale = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-surface p-6 text-center shadow-sm dark:border-rose-900">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="mt-3 font-display text-lg font-bold text-ink-900">{stale ? "Sayt yangilandi" : "Bu sahifada xatolik yuz berdi"}</h2>
        <p className="mt-1 text-sm text-ink-500">
          {stale ? "Yangi versiyani yuklash uchun sahifani yangilang." : "Boshqa bo'limlar ishlayapti. Sahifani yangilab ko'ring; takrorlansa, shu yozuvni skrinshot qilib yuboring."}
        </p>
        {!stale && <p className="mt-3 break-words rounded-xl bg-ink-50 px-3 py-2 font-mono text-xs text-ink-600">{this.state.error.message}</p>}
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
          <RotateCw className="h-4 w-4" /> Sahifani yangilash
        </button>
      </div>
    );
  }
}
