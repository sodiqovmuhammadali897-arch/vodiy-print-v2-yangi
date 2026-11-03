---
name: vp-deck
description: Make a Vodiy Print presentation as a PDF deck in the brand style (forest green + lime, 1280x720) — for the owner, managers or a plan. Use whenever the owner asks for a «taqdimot», «prezentatsiya», a PDF to explain something, or a printable A4 sheet.
---

# Vodiy Print deck (PDF)

The owner likes plans and explanations as short PDF decks in one fixed
brand style. The tooling is in this folder:

- `deck_base.py` provides:
  - colors: `FOREST`, `LIME`, `EMERALD`, `MIST`, `CLAY`, `INK`, `INK2`, `MUTE`, `LINE`;
  - helpers: `esc`, `mln`, `hbars` (SVG bar chart), `share_bar`;
  - the slide CSS;
  - `slide()`, `tg()` (a Telegram bot bubble) and `build()`.
- `render.mjs` — renders the HTML to a PDF, can also save one PNG per
  slide, and reports overflow.
- `fonts/` — Bricolage, Inter and Instrument Serif, used offline.
- `examples/voronka.py` — a complete 10-slide deck to copy from.

## Steps

1. Write the deck script in the scratchpad:
   - start with `sys.path.insert(0, "<repo>/.claude/skills/vp-deck")` and
     `from deck_base import *`;
   - add the slides with `slide(...)`;
   - finish with `build(OUT + "/name.html", "Title")`.
2. Run `node <repo>/.claude/skills/vp-deck/render.mjs OUT/name.html OUT/Vodiy-Print-<mavzu>.pdf OUT/p`.
3. The overflow list must be `[]`. Look at 2–3 of the PNGs with Read,
   especially dense slides, then fix and re-render.
4. Send the PDF with `SendUserFile` (`display: "render"`). Say in Uzbek
   what each slide covers and what is real data versus sample numbers.

## Building blocks (CSS classes)

- **Cover:** `slide(body, "dark", False)`. The body is
  `<div class="cover"><div class="logo">vp</div><div class="cover-k">KICKER</div><h1 class="d">…<span class="serif">…</span></h1><p class="cover-sub">…</p><div class="cover-meta"><span>…</span><span>printvodiy.uz</span></div></div>`.
- **Every slide:** starts with `<div class="k">Kicker</div><h2 class="d">Title</h2>`
  and ends with an optional `<p class="foot">…</p>`.
- **Big numbers:** `<div class="tiles">` with `<div class="tile"><b>745</b><span>text</span></div>`.
  - Use `style="grid-template-columns:repeat(4,1fr)"` for 4 tiles.
- **Two columns:** `<div class="two">`, with `<p class="callout">` for a
  note box (`<b>` inside is green).
- **Steps in a row:** `<div class="flow">` with `<div class="fl"><b>Title</b><span>text</span></div>` (dark cards).
- **Checklist:**
  - `<div class="hvg">` with `<div class="hv"><span class="ok">✓</span><div><h4>…</h4><p>…</p></div></div>`;
  - or `<div class="fdl">` with `<div class="fd"><span class="ck"></span><span class="ft">…</span></div>`.
- **Rule rows:** `<div class="rk"><b>label</b><span>text</span></div>`.
- **Three columns:** `<div class="grid3" style="height:auto;grid-template-rows:auto">`
  with `<div class="it"><h4>…</h4><p>…</p></div>`.
- **Day timeline:** `<div class="dyl">` with `<div class="dy"><span class="dt d">09:00</span><span class="dd">…</span><span class="dw bot|qoida|rahbar">…</span></div>`.
- **Telegram mock:** `tg(["line", "line"], "09:00", ["✅ Button", "🕒 Button"])`.
- **App screenshot:** `<img class="shot" src="file.png">`. Put the PNG next
  to the HTML; make it with the `vp-mockup` skill.

## Rules

- Write in Uzbek, with «» quotes. `build()` turns `o'` and `g'` into `o‘` and `g‘` automatically.
- Use real numbers from the `vp-data` snapshot. Mark sample numbers on the
  slide (`<p class="foot">Namuna raqamlar.</p>`).
- Margin and cost come only from September 2026. Sales data is reliable
  only from July 2026.
- For an A4 sheet to print (desk cheat sheet), write a separate HTML at
  794x1123 px and print it with `page.pdf({format: "A4"})`.
