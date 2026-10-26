import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Router } from "react-router-dom";
import { createBrowserHistory, type BrowserHistory } from "@remix-run/router";
import { loadRoute } from "../../pages";
import { canAnimate, navKind, navTabs } from "../../lib/pageTransition";

type ViewTransitionDocument = Document & { startViewTransition: (update: () => Promise<void> | void) => { finished: Promise<void> } };

// BrowserRouter, but every page change runs inside a View Transition: the
// browser keeps a picture of the old page, React draws the new one, and
// index.css moves the two by the kind set on <html data-nav>. Back and
// forward buttons go through here too.
export default function TransitionRouter({ children }: { children: ReactNode }) {
  const historyRef = useRef<BrowserHistory>();
  if (!historyRef.current) historyRef.current = createBrowserHistory({ v5Compat: true });
  const history = historyRef.current;
  const [state, setState] = useState({ action: history.action, location: history.location });
  const current = useRef(state.location.pathname);
  // The newest address: a quick second tap must not be undone by the
  // first transition finishing late.
  const latest = useRef(state);

  useLayoutEffect(
    () =>
      history.listen((update) => {
        const from = current.current;
        const to = update.location.pathname;
        current.current = to;
        latest.current = { action: update.action, location: update.location };
        if (from === to || !canAnimate()) return setState(latest.current);
        const root = document.documentElement;
        root.dataset.nav = navKind(from, to, update.action, navTabs(), window.matchMedia("(min-width: 1024px)").matches);
        const t = (document as ViewTransitionDocument).startViewTransition(async () => {
          // A page not downloaded yet gets up to 0.3 s, so the new picture
          // is the page and not its spinner.
          await Promise.race([loadRoute(to), new Promise((r) => setTimeout(r, 300))]);
          flushSync(() => setState(latest.current));
        });
        t.finished.finally(() => {
          if (current.current === to) delete root.dataset.nav;
        });
      }),
    [history],
  );

  return (
    <Router location={state.location} navigationType={state.action} navigator={history}>
      {children}
    </Router>
  );
}
