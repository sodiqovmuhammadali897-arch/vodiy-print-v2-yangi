#!/usr/bin/env python3
# Vodiy Print deck base: brand colors, helpers and the slide CSS (1280x720,
# forest green + lime, Bricolage / Inter / Instrument Serif). A deck script:
#
#   import sys; sys.path.insert(0, "<this folder>")
#   from deck_base import *
#   slide("""<div class="k">Kicker</div><h2 class="d">Title</h2>...""")
#   build("out.html", "Title")      # then: node render.mjs out.html out.pdf
#
# Fonts are next to this file (fonts/); build() writes the HTML beside the
# fonts' copy it makes, so the PDF renders offline.
import html, os, re, shutil


FOREST, DEEP, EMERALD, LEAF, MINT, MIST, LIME = "#0b3d2e", "#072a20", "#0e8a4f", "#22b067", "#c6efd5", "#e8f6ec", "#d6f25c"
INK, INK2, MUTE, LINE, PAPER = "#0d2a1f", "#355446", "#6c8579", "#d8e6dc", "#f6faf6"
CLAY = "#b4532a"  # threats accent, the one warm note


def esc(s):
    return html.escape(s, quote=True)


def mln(v):
    return f"{v:,.1f}".replace(",", " ").replace(".", ",")



# ── charts (SVG) ──
def hbars(rows, maxv, width=520, unit="", label_w=170, bar_color=EMERALD, row_h=34, fmt=mln):
    H = row_h * len(rows)
    out = [f'<svg viewBox="0 0 {width} {H}" width="{width}" height="{H}">']
    bw_max = width - label_w - (175 if any(len(r) > 2 for r in rows) else 90)
    for i, r in enumerate(rows):
        lab, v = r[0], r[1]
        sub = r[2] if len(r) > 2 else ""
        y0 = i * row_h + 6
        w = max(3, bw_max * v / maxv)
        out.append(f'<text x="0" y="{y0+15}" class="lab">{esc(lab)}</text>')
        out.append(f'<path d="M{label_w},{y0} H{label_w+w-4} a4,4 0 0 1 4,4 V{y0+16} a4,4 0 0 1 -4,4 H{label_w} Z" fill="{bar_color}"/>')
        out.append(f'<text x="{label_w+w+8}" y="{y0+15}" class="val">{fmt(v)}{unit}</text>')
        if sub:
            out.append(f'<text x="{label_w+w+8+len(fmt(v)+unit)*8.6+8}" y="{y0+15}" class="note">{esc(sub)}</text>')
    out.append("</svg>")
    return "".join(out)


def share_bar(parts, width=520):
    # one stacked 100% bar with a 2px surface gap between segments
    total = sum(p[1] for p in parts)
    x = 0
    segs, labels = [], []
    for lab, v, color, ink in parts:
        w = width * v / total
        segs.append(f'<rect x="{x:.1f}" y="0" width="{max(0, w-2):.1f}" height="28" rx="3" fill="{color}"/>')
        if w > 54:
            segs.append(f'<text x="{x+8:.1f}" y="19" class="seg" fill="{ink}">{round(100*v/total)}%</text>')
        x += w
    return f'<svg viewBox="0 0 {width} 28" width="{width}" height="28">{"".join(segs)}</svg>'



# ── page CSS ──
css = f"""
@font-face{{font-family:Inter;src:url(fonts/inter-latin-wght-normal.woff2) format("woff2");font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F,U+2122,U+2190-2199;}}
@font-face{{font-family:Inter;src:url(fonts/inter-latin-ext-wght-normal.woff2) format("woff2");font-weight:100 900;unicode-range:U+0100-024F,U+02BB-02BC,U+1E00-1EFF;}}
@font-face{{font-family:Bricolage;src:url(fonts/bricolage-grotesque-latin-standard-normal.woff2) format("woff2");font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0000-00FF,U+02BB-02BC,U+2000-206F;}}
@font-face{{font-family:Bricolage;src:url(fonts/bricolage-grotesque-latin-ext-standard-normal.woff2) format("woff2");font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0100-024F,U+1E00-1EFF;}}
@font-face{{font-family:Instrument;src:url(fonts/instrument-serif-latin-400-italic.woff2) format("woff2");font-style:italic;unicode-range:U+0000-00FF,U+02BB-02BC,U+2000-206F;}}
@page{{size:1280px 720px;margin:0}}
*{{box-sizing:border-box}}
html,body{{margin:0;background:#fff;color:{INK};font-family:Inter,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.sl{{width:1280px;height:720px;position:relative;overflow:hidden;padding:56px 72px 48px;page-break-after:always;background:#fff}}
.sl.dark{{background:{FOREST};color:#fff}}
.d{{font-family:Bricolage,Inter,sans-serif;letter-spacing:-.03em;font-stretch:88%}}
.serif{{font-family:Instrument,Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-.01em}}
.k{{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:{EMERALD};display:flex;align-items:center;gap:10px}}
h2{{font-size:40px;line-height:1.04;font-weight:800;color:{FOREST};margin:10px 0 26px;max-width:1040px;text-wrap:balance}}
h3{{font-size:14px;font-weight:700;color:{INK2};margin:0 0 12px;text-transform:uppercase;letter-spacing:.08em}}
.foot{{position:absolute;left:72px;right:72px;bottom:30px;font-size:13px;color:{MUTE};margin:0}}
.pn{{position:absolute;right:40px;bottom:28px;font-size:12px;color:{MUTE};font-variant-numeric:tabular-nums}}
.brand{{position:absolute;right:40px;top:30px;font-family:Instrument,serif;font-style:italic;font-size:22px;color:{FOREST}}}
.ax{{font-size:13px;fill:{MUTE};font-family:Inter}} .val{{font-size:13px;font-weight:700;fill:{INK};font-family:Inter;font-variant-numeric:tabular-nums}}
.note{{font-size:11px;fill:{MUTE};font-family:Inter}} .lab{{font-size:14px;fill:{INK2};font-family:Inter}} .seg{{font-size:12px;font-weight:700;font-family:Inter}}
/* cover */
.cover{{height:100%;display:flex;flex-direction:column;justify-content:center;position:relative}}
.logo{{position:absolute;top:0;left:0;width:64px;height:64px;border-radius:16px;background:{DEEP};color:{LIME};font:italic 38px Instrument,serif;display:grid;place-items:center}}
.cover-k{{font-size:14px;letter-spacing:.18em;font-weight:700;color:{LIME};margin-top:40px}}
.cover h1{{font-size:168px;line-height:.86;margin:18px 0 26px;font-weight:800;color:#fff}}
.cover h1 .serif{{color:{LIME};font-size:150px;letter-spacing:-.02em}}
.cover-sub{{font-size:21px;line-height:1.45;max-width:720px;color:{MINT};margin:0}}
.cover-meta{{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;font-size:14px;color:{MINT};border-top:1px solid #ffffff33;padding-top:16px}}
/* tiles */
.tiles{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}
.tile{{background:{MIST};border-radius:14px;padding:22px 24px}}
.tile b{{display:block;font-family:Bricolage,Inter;font-stretch:88%;font-size:44px;line-height:1;color:{FOREST};letter-spacing:-.03em;font-variant-numeric:tabular-nums}}
.tile span{{display:block;margin-top:10px;font-size:15px;line-height:1.4;color:{INK2}}}
.tiles .tile{{min-height:206px;padding:32px 30px}} .tiles .tile b{{font-size:60px}} .tiles .tile span{{font-size:17px;margin-top:16px}}
.tile.big{{padding:20px 22px}} .tile.big b{{font-size:40px}} .tile.big span{{font-size:14px}}
.stack{{display:flex;flex-direction:column;gap:14px}}
.legend{{display:flex;gap:18px;align-items:center;font-size:13px;color:{INK2};margin:-10px 0 8px}}
.legend i{{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:-10px}}
.legend i.dash{{border:1.5px dashed {MUTE};background:none}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:56px}}
.two.notes{{gap:48px}}
.keys{{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:8px;font-size:15px;color:{INK2}}}
.keys i{{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:10px;vertical-align:-1px}}
.keys b{{color:{INK};margin-left:6px;font-variant-numeric:tabular-nums}}
.callout{{margin:18px 0 0;padding:14px 18px;border-radius:12px;background:{MIST};font-size:15px;line-height:1.45;color:{INK2}}}
.callout b{{color:{FOREST}}}
/* matrix */
.matrix{{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:14px;height:580px;margin-top:16px}}
.q{{border-radius:16px;padding:20px 26px;display:flex;flex-direction:column}}
.ql{{display:flex;align-items:center;gap:14px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}}
.ql span{{font-size:54px;line-height:.8;font-weight:800;letter-spacing:-.04em}}
.q ul{{margin:4px 0 0;padding-left:20px;font-size:19px;line-height:1.6}}
.q.s{{background:{FOREST};color:#fff}} .q.s .ql span{{color:{LIME}}}
.q.w{{background:{MIST};color:{INK}}} .q.w .ql span{{color:{FOREST}}}
.q.o{{background:{LIME};color:{DEEP}}}
.q.t{{background:#fff;border:2px solid {CLAY};color:{INK}}} .q.t .ql span{{color:{CLAY}}}
/* details */
.tag{{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;font:800 18px Bricolage,Inter;letter-spacing:0}}
.tag.s{{background:{FOREST};color:{LIME}}} .tag.w{{background:{MIST};color:{FOREST};border:1px solid {LINE}}} .tag.o{{background:{LIME};color:{DEEP}}} .tag.t{{background:#fff;color:{CLAY};border:2px solid {CLAY}}}
.grid3{{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:26px 26px;height:470px}}
.it{{border-top:2px solid {FOREST};padding-top:12px;display:flex;flex-direction:column}}
.it h4{{margin:4px 0 10px;font-size:22px;color:{FOREST}}}
.it p{{margin:0;font-size:17px;line-height:1.5;color:{INK2};flex:1}}
.it .ev{{margin-top:12px;padding:8px 12px;border-radius:8px;background:{MIST};font-size:14px;font-weight:600;color:{EMERALD};font-variant-numeric:tabular-nums}}
.detail.t .it{{border-top-color:{CLAY}}} .detail.t .it .ev{{color:{CLAY};background:#f8ece6}}
.detail.o .it{{border-top-color:#9cb52a}}
/* tows */
.tows{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.tw{{background:{PAPER};border:1px solid {LINE};border-radius:14px;padding:28px 30px;min-height:225px}}
.tw h4{{margin:0 0 14px;display:flex;align-items:center;gap:6px;font-size:22px;color:{FOREST}}}
.tw h4 .tag{{width:28px;height:28px;font-size:16px}} .tw h4 .tag:last-of-type{{margin-right:8px}}
.tw p{{margin:0;font-size:19px;line-height:1.5;color:{INK2}}}
/* plan */
.planwrap{{display:grid;grid-template-columns:1.55fr 1fr;gap:28px}}
.plan{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
.pc{{background:{MIST};border-radius:14px;padding:22px 20px 14px;min-height:470px}}
.pm{{font-size:32px;font-weight:800;color:{FOREST}}} .pt{{font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:{EMERALD};margin:2px 0 10px}}
.pc ul{{margin:0;padding-left:18px;font-size:16.5px;line-height:1.5;color:{INK2}}} .pc li{{margin-bottom:16px}}
.kpi{{border-collapse:collapse;width:100%;font-size:16.5px;font-variant-numeric:tabular-nums;align-self:start}}
.kpi th{{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:{MUTE};padding:0 8px 8px;border-bottom:2px solid {FOREST}}}
.kpi td{{padding:17px 8px;border-bottom:1px solid {LINE};color:{INK2}}} .kpi td b{{color:{FOREST}}}
.plain{{margin:0;padding-left:18px;font-size:18px;line-height:1.55;color:{INK2}}} .plain li{{margin-bottom:12px}} .plain b{{color:{INK}}}
"""


extra = f"""
.tag{{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;font-size:16px;font-weight:800}}
.tag.n{{background:{FOREST};color:{LIME}}}
.hvg{{display:grid;grid-template-columns:1fr 1fr;gap:16px 40px}}
.hv{{display:grid;grid-template-columns:44px 1fr;gap:14px;padding:16px 0;border-bottom:1px solid {LINE}}}
.ok{{width:36px;height:36px;border-radius:10px;background:{MIST};color:{EMERALD};display:grid;place-items:center;font-weight:800;font-size:20px}}
.hv h4{{margin:2px 0 6px;font-size:21px;color:{FOREST}}} .hv p{{margin:0;font-size:16.5px;line-height:1.5;color:{INK2}}}
.grid3.gaps .it{{border-top-color:{CLAY}}} .grid3.gaps .it h4{{color:{CLAY}}}
.p6{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}}
.pt6{{background:{MIST};border-radius:16px;padding:22px 24px;min-height:200px}}
.pt6 h4{{margin:0 0 8px;font-size:23px;color:{FOREST}}} .pt6 p{{margin:0;font-size:17px;line-height:1.5;color:{INK2}}}
.sn{{width:46px;height:46px;border-radius:12px;background:{FOREST};color:{LIME};display:grid;place-items:center;font-size:24px;font-weight:800;margin-bottom:14px}}
.panel{{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:19px;font-variant-numeric:tabular-nums}}
.panel th{{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:{MUTE};padding:0 12px 6px}}
.panel td{{background:{PAPER};padding:18px 12px;color:{INK}}} .panel td:first-child{{border-radius:12px 0 0 12px}} .panel td:last-child{{border-radius:0 12px 12px 0}}
.panel td.bad{{background:#f8e3d9;color:{CLAY};font-weight:800}}
.tg{{background:linear-gradient(160deg,#cfe0c3,#9fc1a0);border-radius:22px;padding:0 14px 16px;align-self:start}}
.tgh{{display:flex;align-items:center;gap:10px;padding:12px 4px;font-size:16px}}
.tga{{width:32px;height:32px;border-radius:50%;background:{FOREST};color:{LIME};display:grid;place-items:center;font-size:12px;font-weight:800}}
.tgb{{background:#fff;border-radius:14px;padding:14px 16px;font-size:16.5px;line-height:1.5;color:#111}}
.tgt{{text-align:right;font-size:12px;color:#999;margin-top:4px}}
.rule{{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:15px 0;border-bottom:1px solid {LINE};font-size:17.5px;line-height:1.45;color:{INK2}}}
.rule b{{color:{FOREST}}}
.pbr{{display:grid;grid-template-columns:150px 1fr 200px;align-items:center;gap:14px;padding:14px 0}}
.pbn{{font-size:18px;font-weight:700;color:{INK}}}
.pbt{{position:relative;height:26px;background:{MIST};border-radius:8px}}
.pbf{{height:100%;background:{EMERALD};border-radius:8px}} .pbf.low{{background:{CLAY}}}
.pbm{{position:absolute;top:-6px;bottom:-6px;width:3px;background:{INK};border-radius:2px}}
.pbv{{font-size:15px;color:{INK2};font-variant-numeric:tabular-nums}} .pbv b{{font-size:18px;color:{FOREST}}}
.tiles.t2{{grid-template-columns:1fr 1fr}} .tiles.t2 .tile{{min-height:150px;padding:24px}} .tiles.t2 .tile b{{font-size:48px}}
.tiles.t3 .tile{{min-height:170px}} .tiles.t3 .tile b{{font-size:44px}}
.flow{{display:flex;align-items:stretch;gap:10px}}
.fl{{flex:1;background:{FOREST};border-radius:16px;padding:24px 22px;color:#fff}} .fl b{{display:block;font:800 28px Bricolage,Inter;font-stretch:88%;color:{LIME}}} .fl span{{display:block;margin-top:8px;font-size:16px;color:#d7eadf}}
.arrow{{display:grid;place-items:center;font-size:30px;color:{EMERALD};font-weight:800}}
.cr{{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid {LINE};font-size:17.5px;color:{INK2}}}
.cr b{{width:30px;height:30px;border-radius:8px;display:grid;place-items:center}} .cr b.y{{background:{MIST};color:{EMERALD}}} .cr b.x{{background:#f8e3d9;color:{CLAY}}}
.stack{{display:flex;flex-direction:column;gap:14px}}
.dyl{{display:flex;flex-direction:column}}
.dy{{display:grid;grid-template-columns:150px 1fr 110px;align-items:center;padding:15px 0;border-bottom:1px solid {LINE}}}
.dt{{font-size:26px;font-weight:800;color:{FOREST}}} .dd{{font-size:19px;color:{INK}}}
.dw{{justify-self:end;font-size:13px;font-weight:700;padding:5px 12px;border-radius:999px;background:{MIST};color:{EMERALD}}}
.dw.siz{{background:{FOREST};color:{LIME}}} .dw.guruh{{background:#f1f9df;color:#5d7016}}
.pc{{min-height:420px}} .pc ul{{font-size:17px}} .pc li{{margin-bottom:14px}}
.fdl{{display:flex;flex-direction:column;margin-top:4px}}
.fd{{display:grid;grid-template-columns:44px 300px 1fr;align-items:center;padding:22px 0;border-bottom:1px solid {LINE}}}
.ck{{width:24px;height:24px;border:2.5px solid {FOREST};border-radius:7px}}
.ft{{font-size:22px;color:{FOREST};font-weight:700}} .fw{{font-size:18px;color:{INK2};line-height:1.45}}
"""
extra += f"""
.tgbtn{{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}}
.tgbtn span{{background:rgba(255,255,255,.6);border-radius:10px;padding:9px 6px;text-align:center;font-size:14px;font-weight:600;color:{FOREST}}}
.tiles.t3 .tile{{min-height:200px}}
.rk{{display:grid;grid-template-columns:230px 1fr;gap:12px;padding:15px 0;border-bottom:1px solid {LINE};font-size:18px;line-height:1.4;color:{INK2}}} .rk b{{color:{CLAY}}}
.dw.bot{{background:{MIST};color:{EMERALD}}} .dw.qoida{{background:#f8e3d9;color:{CLAY}}} .dw.rahbar{{background:{FOREST};color:{LIME}}}

.shot{{display:block;width:100%;max-height:470px;object-fit:contain;object-position:left top;border-radius:14px;box-shadow:0 10px 30px rgba(11,61,46,.12);margin-top:6px}}
.flow .fl{{padding:20px 18px}} .flow .fl b{{font-size:24px}} .flow .fl span{{font-size:15px;line-height:1.45}}
.src{{display:inline-block;margin-top:8px;font-style:normal;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(214,242,92,.16);color:{LIME};border-radius:6px;padding:3px 7px}}
.tiles .tile b{{font-size:52px}} .tiles .tile span{{font-size:16px}}
.rk{{display:grid;grid-template-columns:230px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid {LINE};font-size:18px;line-height:1.4;color:{INK2}}} .rk b{{color:{FOREST}}}
"""


slides = []


def slide(body, cls="", numbered=True):
    """Add a slide. cls="dark" for a forest-green cover; numbered=False hides the page number."""
    slides.append((body, cls, numbered))


def tg(lines, time="09:00", buttons=None):
    """A Telegram bot message bubble (for showing what the bot sends)."""
    btn = ""
    if buttons:
        btn = '<div class="tgbtn">' + "".join(f"<span>{b}</span>" for b in buttons) + "</div>"
    return f'<div class="tg"><div class="tgh"><span class="tga">VP</span><b>Vodiyprint bot</b></div><div class="tgb">{"<br>".join(lines)}<div class="tgt">{time}</div></div>{btn}</div>'


def _typo(h):
    # Uzbek o‘ g‘ and ’ outside tags.
    h = re.sub(r"(?<=[oOgG])'(?![^<]*>)", "\u2018", h)
    return re.sub(r"(?<=[A-Za-z])'(?=[A-Za-z])(?![^<]*>)", "\u2019", h)


def build(path, title, more_css=""):
    """Write the deck HTML to `path` (fonts copied next to it)."""
    here = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.dirname(os.path.abspath(path))
    if os.path.abspath(os.path.join(outdir, "fonts")) != os.path.join(here, "fonts"):
        shutil.copytree(os.path.join(here, "fonts"), os.path.join(outdir, "fonts"), dirs_exist_ok=True)
    pages = []
    for i, (body, cls, numbered) in enumerate(slides, 1):
        e = "" if not numbered else f'<div class="brand">vp</div><div class="pn">{i:02d} / {len(slides):02d}</div>'
        pages.append(_typo(f'<section class="sl {cls}">{body}{e}</section>'))
    open(path, "w").write(f'<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>{esc(title)}</title><style>{css}{extra}{more_css}</style></head><body>{"".join(pages)}</body></html>')
    return len(slides)
