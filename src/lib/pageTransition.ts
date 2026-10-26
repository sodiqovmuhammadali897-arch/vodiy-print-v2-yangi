// How the page moves when the address changes, and where each page was
// scrolled to. Phones: a tab slides in from the side it sits on, a deeper
// page is pushed in from the right and slides back out on «orqaga», like
// an iPhone. Computers: the new page fades in, rising a little. The
// browser's View Transitions draw both pages at once; without them the
// page keeps its plain slide-in (index.css .page-enter).
import { tabOf } from "./tabBar";

export type NavKind = "tab-left" | "tab-right" | "push" | "pop" | "fade";

const depth = (path: string) => path.split("/").filter(Boolean).length;

export const navKind = (from: string, to: string, action: "PUSH" | "POP" | "REPLACE", tabs: string[], wide: boolean): NavKind => {
  if (wide) return "fade";
  const a = tabOf(from, tabs);
  const b = tabOf(to, tabs);
  if (b && to === b && a !== b) {
    if (!a) return "fade";
    return tabs.indexOf(b) > tabs.indexOf(a) ? "tab-right" : "tab-left";
  }
  const da = depth(from);
  const db = depth(to);
  if (db !== da) return db > da ? "push" : "pop";
  return action === "POP" ? "pop" : "push";
};

// A section opened from the menu or a tab, or reached with «orqaga»,
// comes back where it was left; a page opened from inside one starts at
// its top.
export const restoresScroll = (to: string, action: "PUSH" | "POP" | "REPLACE") => action === "POP" || depth(to) <= 1;

// The phone's tab bar tells which four pages are tabs (TabBar.tsx).
let tabs: string[] = [];
export const setNavTabs = (next: string[]) => {
  tabs = next;
};
export const navTabs = () => tabs;

export const canAnimate = () =>
  typeof document !== "undefined" &&
  "startViewTransition" in document &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scroll position per page, kept while the app is open.
export const savedScroll = new Map<string, number>();
