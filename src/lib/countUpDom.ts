// Count-up for every panel's big numbers (the owner, 2026-11-25: «hamma
// panelda raqamlar dinamika bo'yicha ishlasin»), without touching each page:
// one MutationObserver watches the app. A text node that is a number
// ("6 439 000", "107,3%", "52,3 mln", "$26.24") inside a big display
// heading (font-display + text-xl … text-6xl, or [data-count]) counts up
// from 0 when it comes into view, and runs on from the old number when
// React writes a new one. React keeps owning the text: it only ever sets
// the final value; the observer paints the steps in between.
//
// Skipped: headings whose number has letters before it ("VP-1201"),
// customer documents (.force-light previews), [data-no-count], and
// AnimatedNumber's own output ([data-motion]). PNG/PDF exports call
// finishCountUps() first so nothing is captured half-way.
import { COUNT_UP_MS, easeOutCubic, formatTemplate, parseNumberTemplate, sameShape, type NumberTemplate } from "./countUp";
import { motionOn } from "./motion";

const BIG = /(^|\s)text-(xl|2xl|3xl|4xl|5xl|6xl|\[(1[89]|[2-6]\d)px\])(\s|$)/;
const SKIP = ".force-light, [data-no-count], [data-motion]";
const LETTER = /[A-Za-zЀ-ӿ]/;

type State = { t: NumberTemplate; at: number; written: string; raf: number; target: string };
const states = new WeakMap<Text, State>();
const running = new Set<Text>();
const waiting = new Map<Element, Set<Text>>();
let io: IntersectionObserver | null = null;

// The element that makes a text node a "big number", or null.
export function hostOf(node: Text): Element | null {
  let el = node.parentElement;
  for (let i = 0; el && i < 3; i++, el = el.parentElement) {
    const cls = el.getAttribute("class") || "";
    if (el.hasAttribute("data-count") || (/(^|\s)font-display(\s|$)/.test(cls) && BIG.test(cls) && /(^|\s)font-(bold|extrabold|black|semibold)(\s|$)/.test(cls))) {
      return el.closest(SKIP) ? null : el;
    }
  }
  return null;
}

// A number worth running: a plain number, no letters before it.
export function templateOf(text: string): NumberTemplate | null {
  const t = parseNumberTemplate(text);
  if (!t || LETTER.test(t.prefix) || t.value === 0) return null;
  return t;
}

const paint = (node: Text, s: State, value: number) => {
  s.at = value;
  s.written = formatTemplate(s.t, value);
  node.nodeValue = s.written;
};

function run(node: Text, s: State, from: number) {
  cancelAnimationFrame(s.raf);
  running.add(node);
  const start = performance.now();
  const step = (now: number) => {
    if (!node.isConnected) {
      running.delete(node);
      return;
    }
    const k = Math.min(1, (now - start) / COUNT_UP_MS);
    if (k < 1) {
      paint(node, s, from + (s.t.value - from) * easeOutCubic(k));
      s.raf = requestAnimationFrame(step);
    } else {
      s.at = s.t.value;
      s.written = s.target;
      node.nodeValue = s.target;
      running.delete(node);
    }
  };
  s.raf = requestAnimationFrame(step);
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < (window.innerHeight || 800);
};

// A number node appeared or React wrote a new value into it.
function track(node: Text) {
  const text = node.nodeValue || "";
  const prev = states.get(node);
  if (prev && text === prev.written) return; // our own step
  const host = hostOf(node);
  if (!host) return;
  const t = templateOf(text);
  if (!t) {
    if (prev) cancelAnimationFrame(prev.raf);
    states.delete(node);
    return;
  }
  if (!motionOn()) return;
  if (prev && sameShape(prev.t, t)) {
    // New value: run on from the number on screen.
    const from = prev.at;
    Object.assign(prev, { t, target: text, written: text });
    if (from !== t.value) run(node, prev, from);
    return;
  }
  const s: State = { t, at: 0, written: "", raf: 0, target: text };
  states.set(node, s);
  paint(node, s, 0);
  if (visible(host)) run(node, s, 0);
  else {
    if (!waiting.has(host)) waiting.set(host, new Set());
    waiting.get(host)!.add(node);
    io?.observe(host);
  }
}

function scan(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return track(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/\d/.test(n.nodeValue || "")) track(n as Text);
}

// Every running or waiting number straight to its final value.
export function finishCountUps() {
  for (const node of [...running]) {
    const s = states.get(node);
    if (!s) continue;
    cancelAnimationFrame(s.raf);
    s.at = s.t.value;
    s.written = s.target;
    node.nodeValue = s.target;
  }
  running.clear();
  for (const [host, nodes] of waiting) {
    for (const node of nodes) {
      const s = states.get(node);
      if (s) {
        s.at = s.t.value;
        s.written = s.target;
        node.nodeValue = s.target;
      }
    }
    io?.unobserve(host);
  }
  waiting.clear();
}

export function startCountUps(root: HTMLElement = document.body): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const nodes = waiting.get(e.target);
            waiting.delete(e.target);
            io?.unobserve(e.target);
            for (const node of nodes || []) {
              const s = states.get(node);
              if (s && node.isConnected) run(node, s, 0);
            }
          }
        })
      : null;
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") track(m.target as Text);
      else m.addedNodes.forEach((n) => scan(n));
    }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true });
  scan(root);
  return () => {
    mo.disconnect();
    io?.disconnect();
    finishCountUps();
  };
}
