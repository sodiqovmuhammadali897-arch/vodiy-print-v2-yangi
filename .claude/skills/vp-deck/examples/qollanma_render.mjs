import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const D = new URL(".", import.meta.url).pathname;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto("file://" + D + "guide.html"); await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: D + "Vodiy-Print-yangi-sotuvchi-qollanmasi.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
const n = await p.locator("section.pg").count();
for (let i = 0; i < n; i++) await p.locator("section.pg").nth(i).screenshot({ path: `${D}g${String(i + 1).padStart(2, "0")}.png` });
const over = await p.evaluate(() => [...document.querySelectorAll("section.pg")].map((s, i) => { const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll("*")].filter((e) => { const q = e.getBoundingClientRect(); return q.width && !e.classList.contains("pn") && !e.classList.contains("br") && (q.bottom > r.bottom - 44 || q.right > r.right - 20); }).map((e) => e.tagName + "." + e.className).slice(0, 3); return bad.length ? `${i + 1}: ${bad.join(", ")}` : null; }).filter(Boolean));
console.log(n, "pages; overflow:", JSON.stringify(over)); await b.close();
