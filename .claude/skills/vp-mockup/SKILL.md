---
name: vp-mockup
description: Show the Vodiy Print owner what a screen will look like before or after building it — a quick HTML mockup rendered to PNG, or the real React page rendered with mock data (desktop, phone, dark). Use before every bigger UI feature (the owner approves mockups first) and to check a changed page renders without errors.
---

# Mockups and page render checks

The owner approves a picture before a bigger feature is built («oldin maket
taqdim qil»). After building, check the real page renders in light, dark
and phone sizes.

## A. Quick HTML mockup → PNG (before building)

1. Write `mock.html` in the scratchpad.
   - Use the app's look: Inter or Manrope, ink greys, brand blue
     `#0062db` / `#0f7fff`, white cards with `border-radius:18px`.
   - Semantic colors: green `#047857`, amber `#b45309`, rose `#be123c`.
2. For a phone and a desktop side by side: a `.ph` phone frame 390 px wide
   next to a desktop panel.
3. Put real numbers where you have them (from `vp-data`). Add a line
   naming which numbers are samples.
4. Render it:
   ```js
   import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
   const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
   await p.goto("file://" + DIR + "/mock.html"); await p.evaluate(() => document.fonts.ready);
   await p.screenshot({ path: DIR + "/maket.png", fullPage: true }); await b.close();
   ```
5. Look at the PNG with Read and fix any wrapping or overlap.
6. Send it with `SendUserFile`. Explain it in Uzbek and ask «tasdiqlaysizmi?».
7. Single sections can be cut out with `locator(".card").screenshot(...)`
   to put into a `vp-deck` presentation.

Do not install Playwright — it is preinstalled at `/opt/node22/lib/node_modules/playwright`.

## B. The real page with mock data (after building)

`harness/` renders one app page through Vite, with mocks swapped in for
auth, the database and the page's data hook.

- `main.tsx` — imports the page. It is set to `src/modules/kpi/KpiPage`;
  change the import for another page.
- `vite.config.mjs` — `mocks`: when an import path ends with a key, it is
  replaced by the mock file:
  - `auth.ts` (`?v=me` = a manager account, else an admin);
  - `fsdb.ts` (database writes do nothing);
  - `perm.ts`;
  - `kpiHook.example.ts` (fake KPI rows built with the real `computeKpi`).
  - For another page, mock its data hook or service the same way and
    return realistic rows.
- `shot.mjs OUT` — screenshots `desk.png`, `phone.png` and `dark.png`
  with a fixed clock (`NOW=...` env), and prints page errors.

```bash
H=/home/user/vodiy-print-v2-yangi/.claude/skills/vp-mockup/harness
cp -r $H $SCRATCH/h && cd /home/user/vodiy-print-v2-yangi      # edit the copy, not the skill
(npx vite --config $SCRATCH/h/vite.config.mjs $SCRATCH/h > $SCRATCH/h/vite.log 2>&1 &); sleep 5
node $SCRATCH/h/shot.mjs $SCRATCH/h        # → errors: none
pkill -f "vite --config $SCRATCH/h/vite.config.mj[s]"   # the [s] keeps pkill from matching itself
```

- Run Vite **from the repo root**, so the Tailwind config and `index.css`
  resolve; otherwise you get «bg-ink-50 does not exist».
- Dark mode: the ink scale flips (`ink-100` is the dark card surface). Use
  `dark:bg-ink-200` for bar tracks and chip backgrounds inside cards.
- In the harness the text falls back to DejaVu, because the app fonts load
  differently. That is fine for checking layout.
