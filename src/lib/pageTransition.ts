// How the page moves when the address changes, and where each page was
// scrolled to. Phones: a tab slides in from the side it sits on, a deeper
// page is pushed in from the right and slides back out on «orqaga», like
// an iPhone. Computers: another section opens like an iPhone app (rises
// from a slightly smaller picture), deeper pages slide like on a phone. The
// browser's View Transitions draw both pages at once; without them the
// page keeps its plain slide-in (index.css .page-enter).
import { tabOf } from "./tabBar";
import { motionOn } from "./motion";

export type NavKind = "tab-left" | "tab-right" | "push" | "pop" | "fade" | "open";

const depth = (path: string) => path.split("/").filter(Boolean).length;

export const navKind = (from: string, to: string, action: "PUSH" | "POP" | "REPLACE", tabs: string[], wide: boolean): NavKind => {
  // Computers (2026-11-25, the owner: «iPhone stilda yumshoq ochilsin»):
  // another section opens like an iPhone app — rising out of a slightly
  // smaller picture; a deeper page slides in from the right, «orqaga»
  // slides it back out.
  if (wide) {
    const dw = depth(to) - depth(from);
    if (dw > 0) return "push";
    if (dw < 0) return action === "POP" || depth(to) >= 1 ? "pop" : "open";
    return action === "POP" && from.split("/")[1] === to.split("/")[1] ? "pop" : "open";
  }
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

export const canAnimate = () => typeof document !== "undefined" && "startViewTransition" in document && motionOn();

// Scroll position per page, kept while the app is open.
export const savedScroll = new Map<string, number>();
