// node shot.mjs OUT_DIR  — screenshots the harness page (desktop, phone,
// dark) with a fixed clock, and prints page errors.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const out = process.argv[2] || ".";
const NOW = process.env.NOW || "2026-11-22T12:00:00+05:00";
const b = await chromium.launch();
const errs = [];
for (const [name, vp, q] of [["desk", { width: 1500, height: 1000 }, "?v=admin"], ["phone", { width: 400, height: 900 }, "?v=me"], ["dark", { width: 1500, height: 1000 }, "?v=admin&dark=1"]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1.5 });
  await p.clock.setFixedTime(new Date(NOW));
  p.on("pageerror", (e) => errs.push(name + ": " + e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(name + ": " + m.text()));
  await p.goto("http://localhost:5198/" + q);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}
console.log("errors:", errs.join("\n") || "none");
await b.close();
