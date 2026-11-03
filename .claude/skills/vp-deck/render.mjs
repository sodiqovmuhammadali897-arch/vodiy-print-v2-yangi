// node render.mjs deck.html deck.pdf [pngPrefix]
// Renders a deck built by deck_base.py to PDF (1280x720 pages), optionally
// one PNG per slide, and prints any element that spills off a slide.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import path from "path";
const [html, pdf, png] = process.argv.slice(2);
if (!html || !pdf) { console.error("usage: node render.mjs deck.html deck.pdf [pngPrefix]"); process.exit(1); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("file://" + path.resolve(html));
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: pdf, width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
const n = await p.locator("section.sl").count();
if (png) for (let i = 0; i < n; i++) await p.locator("section.sl").nth(i).screenshot({ path: `${png}${String(i + 1).padStart(2, "0")}.png` });
const over = await p.evaluate(() => [...document.querySelectorAll("section.sl")].map((s, i) => { const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll("*")].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.bottom > r.bottom - 20 || q.right > r.right - 10); }).map((e) => e.tagName + "." + e.className).slice(0, 4); return bad.length ? `${i + 1}: ${bad.join(", ")}` : null; }).filter(Boolean));
console.log(n, "slides; overflow:", JSON.stringify(over));
await b.close();
