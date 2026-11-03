#!/usr/bin/env python3
# Printed A4 guide for new sellers («Yangi sotuvchi qo'llanmasi»). To rebuild:
#  1. Run snapshot.yml with sections=guidejson; read the job log (vp-data) and
#     write data.json = {"gf": [GF lines], "ls": [LS lines]} into OUT.
#  2. npx esbuild src/modules/darslik/lessonsData.ts --bundle --format=cjs --platform=node --outfile=OUT/lessons.cjs
#     then node -e to write OUT/lessons.json (apply LS edits over it if any).
#  3. Copy this file, qollanma_render.mjs and ../fonts into OUT; python3 OUT/qollanma_a4.py; node OUT/qollanma_render.mjs
# A4 printed guide for new sellers, from guide_facts (data.json) and the
# Darslik lessons (lessons.json).
import json, html, re, os
D = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(f"{D}/data.json"))
L = {l["key"]: l for l in json.load(open(f"{D}/lessons.json"))}
meta = next(g for g in data["gf"] if g["id"] == "_meta")
fams = sorted([g for g in data["gf"] if g["id"] != "_meta"], key=lambda g: g["rank"])
top, rest = fams[:10], fams[10:]
byKey = {f["key"]: f for f in fams}

FOREST, LIME, EMERALD, MIST, INK, INK2, MUTE, LINE, CLAY, AMBER = "#0b3d2e", "#d6f25c", "#0e8a4f", "#e8f6ec", "#0d2a1f", "#355446", "#6c8579", "#d8e6dc", "#b4532a", "#fff6e0"
e = lambda s: html.escape(str(s))
def num(n): return f"{round(n):,}".replace(",", " ")
def mln(n):
    v = n / 1e6
    return (f"{v:.0f}" if v >= 100 else f"{v:.1f}".replace(".", ",")).rstrip(",") + " mln"
def days(f):
    d = f.get("lead_days")
    if not d: return "—"
    return f"{d['min']} ish kuni" if d["min"] == d["max"] else f"{d['min']}–{d['max']} ish kuni"
def one_liner(about):
    p = about.split("\n\n")[0].strip()
    s = re.findall(r"[^.!?]+[.!?]+", p) or [p]
    return " ".join(x.strip() for x in s[:2])
def main_model(models):
    m = [x for x in models if x["tiers"]]
    return sorted(m, key=lambda x: (-(x.get("sold") or 0), -len(x["tiers"]), x["name"]))[0] if m else None
def tier_rows(tiers, want=6):
    t = sorted(tiers, key=lambda x: x["min_qty"])
    if len(t) <= want: return t
    rows = [t[round(i * (len(t) - 1) / (want - 1))] for i in range(want - 1)] + [t[-1]]
    out = []
    for r in rows:
        if r not in out: out.append(r)
    return out

MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"]
pages = []
def page(body, cls=""):
    pages.append((body, cls))

# 1 cover
page(f"""
<div class="cv">
  <div class="logo">vp</div>
  <div class="ck">VODIY PRINT · SOTUV BO'LIMI</div>
  <h1 class="d">Yangi sotuvchi<br><span class="serif">qo'llanmasi</span></h1>
  <p class="cs">72 ta mahsulotni yodlash shart emas. Sotuvning <b>{meta['top10_share']}%</b> ini beradigan 10 ta mahsulot, mijoz vaziyatlari va qo'ng'iroq tartibi — bir haftada sotishga tayyor bo'lish uchun.</p>
  <div class="cm"><span>Raqamlar: iyul–noyabr 2026, ERP buyurtmalari</span><span>3-noyabr 2026 holati</span></div>
</div>""", "dark")

# 2 how + top10 table
rows = "".join(
    f"<tr><td class='rk'>{f['rank']}</td><td><b>{e(f['title'])}</b></td><td class='r'>{mln(f['revenue'])}</td><td class='r'>{num(f['qty_median'])} dona</td><td class='r'>{num(f['price_from']) if f['price_from'] else '—'}</td><td>{days(f)}</td></tr>"
    for f in top)
path = [("1-kun", "Top-10 mahsulot", "Shu qo'llanmaning 5–14-betlari"), ("2-kun", "Mijoz vaziyatlari", "3-bet: 6 ta vaziyat"), ("3-kun", "Qo'ng'iroq skripti", "Darslik: har mahsulot darsi"), ("4-kun", "Test", "Darslik testlari — har biri 80% dan"), ("5-kun", "Tajribali yonida", "5 ta qo'ng'iroqni eshitadi, 3 tasini o'zi qiladi")]
pp = "".join(f"<div class='day'><span>{a}</span><b>{b}</b><i>{c}</i></div>" for a, b, c in path)
page(f"""
<div class="k">Qanday foydalaniladi</div>
<h2 class="d">Bir hafta — sotishga tayyor</h2>
<div class="days">{pp}</div>
<p class="call">Ilovada ham bor: <b>printvodiy.uz → Darslik → «Mahsulot qo'llanmasi»</b>. U yerda raqamlar har kuni yangilanadi, darslar va testlar ham o'sha yerda.</p>
<h3>Avval shu 10 ta mahsulot — sotuvning {meta['top10_share']}%</h3>
<table class="tb"><thead><tr><th></th><th>Mahsulot</th><th class='r'>Sotuv</th><th class='r'>Odatda</th><th class='r'>Donasi …dan</th><th>Tayyor bo'ladi</th></tr></thead><tbody>{rows}</tbody></table>
<p class="ft">Sotuv — iyuldan beri, so'm. «Odatda» — buyurtmalarning o'rtasidagi tiraj. Narx — katalogdagi eng katta tiraj narxi.</p>
""")

# 3 situations
SIT = [
    ("Do'kon, butik, savdo", "Har xaridni brendli paketda berish — paketni eng ko'p do'konlar oladi. Har oy kerak bo'ladi: doimiy mijoz.", ["paket", "vizitka", "stiker", "flayer"], "Oyiga taxminan nechta xaridor bo'ladi? Paket hozir qayerdan olinadi?"),
    ("Maktab, o'quv markaz", "Reklama, qabul, bitiruv va ustozlar kuni — flayer, bloknot va gift boxni ko'p oladi.", ["flayer", "bloknot", "ruchka", "gift-box", "kalendar"], "Qabul yoki bitiruv qachon? Nechta o'quvchi yoki xodim bor?"),
    ("Korporativ sovg'a, bayram", "Hamkor va xodimlarga — set bo'lib olinadi (paket + bloknot + ruchka + bakal). Yangi yil va Navro'zdan oldin ko'payadi.", ["gift-box", "bloknot", "bakal", "kalendar", "ruchka"], "Kimlarga va nechta? Bir sovg'a uchun byudjet qancha? Qachongacha kerak?"),
    ("Xodimlar formasi", "Restoran, ishlab chiqarish, do'kon xodimlari — futbolka bilan kepka ko'pincha birga olinadi.", ["futbolka", "kepka", "ustki-kiyim"], "Nechta xodim va qaysi o'lchamlar? Yozgi yoki qishki?"),
    ("Qurilish, ko'chmas mulk, ofis", "Mijozlarga hujjat va taqdimot beriladi — papka, vizitka va bloknot.", ["papka", "vizitka", "bloknot", "paket"], "Oyiga nechta mijoz bilan uchrashasiz? Vizitka nechta xodimga kerak?"),
    ("Tadbir, ko'rgazma", "Muddat qisqa — tayyor bo'lish sanasini birinchi so'rang. Beydjik, roll-up, bayroq va tarqatma.", ["suvenir", "banner", "flayer", "ruchka", "bloknot"], "Tadbir sanasi qachon? Nechta ishtirokchi?"),
]
def chips(ks):
    return "".join("<span>" + e(byKey[k]["title"]) + "</span>" for k in ks if k in byKey)
ss = "".join(
    f"<div class='sit'><span class='sn'>{i}</span><div><h4>{e(t)}</h4><p>{e(w)}</p><p class='ask'><b>So'rang:</b> {e(a)}</p><div class='chips'>{chips(ks)}</div></div></div>"
    for i, (t, w, ks, a) in enumerate(SIT, 1))
page(f"""
<div class="k">2-kun · Mijoz vaziyatlari</div>
<h2 class="d">Mijoz mahsulot nomini emas, vaziyatini aytadi</h2>
<div class="sits">{ss}</div>
""")

# 4 call order + price logic + rules
paket = byKey.get("paket")
pm = main_model(paket["models"]) if paket else None
pt = "".join(f"<tr><td>{num(t['min_qty'])} dona</td><td class='r'><b>{num(t['price'])}</b></td></tr>" for t in tier_rows(pm["tiers"])) if pm else ""
steps = L["paket"]["steps"]
prices = [t["price"] for t in pm["tiers"]] if pm else []
FILL = {"{tiraj}": num(min(t["min_qty"] for t in pm["tiers"])) if pm else "100",
        "{narx}": f"{num(min(prices))} – {num(max(prices))} so'm" if prices else "",
        "{muddat}": days(paket) if paket else ""}
def fill(t):
    for k, v in FILL.items(): t = t.replace(k, v)
    return t
st = "".join(f"<div class='stp'><b>{i}. {e(s['title'])}</b><span>{e(fill(s['say']))}</span></div>" for i, s in enumerate(steps, 1))
rules = ["Javobsiz kiruvchiga 15 daqiqada qayta qo'ng'iroq.", "Har ochiq bitimda keyingi vazifa (amoCRM).", "Narxdan oldin ehtiyojni so'rang: nima uchun, nechta, qachonga.", "Tirajni ko'tarishni taklif qiling — donasi arzonlashadi.", "Har buyurtmaga «qo'shib taklif qiling» qatoridan bitta mahsulot.", "Har buyurtma ERP'da, o'z nomingizga, mahsulot katalogdan tanlanadi.", "Yo'qotilgan bitimda sabab yozing."]
rr = "".join(f"<li>{e(r)}</li>" for r in rules)
page(f"""
<div class="k">3-kun · Qo'ng'iroq tartibi</div>
<h2 class="d">Har qo'ng'iroq bir xil tartibda</h2>
<p class="sub">Misol — «Qog'oz paket» darsidan. Har mahsulotning to'liq senariysi Darslikda.</p>
<div class="steps">{st}</div>
<div class="two">
  <div><h3>Narx mantig'i: tiraj oshsa — donasi arzon</h3>
    <table class="tb sm"><tbody>{pt}</tbody></table>
    <p class="ft">«{e(pm['name']) if pm else ''}», dona narxi, so'm. Ko'pchilik mahsulotda shunday.</p></div>
  <div><h3>Yetti qoida</h3><ul class="rules">{rr}</ul></div>
</div>
""")

# product pages
def product_page(f):
    l = L.get(f["lesson"], {})
    m = main_model(f["models"])
    trows = "".join(f"<tr><td>{num(t['min_qty'])} dona</td><td class='r'><b>{num(t['price'])}</b></td></tr>" for t in tier_rows(m["tiers"])) if m else "<tr><td>Katalogda narx yo'q</td><td></td></tr>"
    tiers = sorted(m["tiers"], key=lambda t: t["min_qty"]) if m else []
    times = round(tiers[0]["price"] / tiers[-1]["price"], 1) if len(tiers) > 1 and tiers[-1]["price"] < tiers[0]["price"] else None
    others = [x for x in f["models"] if x["tiers"] and (not m or x["id"] != m["id"])]
    oth = "".join(f"<li>{e(x['name'])} — {num(min(t['price'] for t in x['tiers']))} dan</li>" for x in others[:5])
    who = "".join(f"<span>{e(w['name'])} · {w['n']}</span>" for w in f["who"]) + (f"<span class='mu'>soha yozilmagan · {f['who_unknown']}</span>" if f["who_unknown"] else "")
    wth = "".join(f"<span>{e(w['title'])} · {w['n']} marta</span>" for w in f["with"][:4])
    obj = "".join(f"<div class='qa'><b>«{e(o['q'])}»</b><span>{e(o['a'])}</span></div>" for o in l.get("objections", [])[:3])
    ask = "".join(f"<li>{e(a)}</li>" for a in l.get("ask", [])[:5])
    rem = "".join(f"<li>{e(a)}</li>" for a in l.get("remember", [])[:3])
    kinds = "".join(f"<li>{e(a)}</li>" for a in l.get("kinds", [])[:3])
    rep = f"{f['repeat_buyers']} / {f['buyers']}" if f["buyers"] else "—"
    warn = f["buyers"] and f["repeat_buyers"] / f["buyers"] < 0.3
    page(f"""
<div class="ph"><span class="rkb">{f['rank']}</span><div><div class="k" style="margin:0">Top-10 · {e(l.get('category',''))}</div><h2 class="d" style="margin:2px 0 0">{e(f['title'])}</h2></div></div>
<p class="lead">{e(one_liner(l.get('about','')))}</p>
<p class="aud"><b>Kimga:</b> {e(l.get('audience',''))}</p>
<div class="facts">
  <div><b>{mln(f['revenue'])}</b><span>sotuv iyuldan · {f['orders']} buyurtma</span></div>
  <div><b>{num(f['qty_median'])} dona</b><span>odatdagi tiraj ({num(f['qty_low'])}–{num(f['qty_high'])})</span></div>
  <div><b>{mln(f['line_median'])}</b><span>odatdagi buyurtma</span></div>
  <div><b>{days(f)}</b><span>tayyor bo'ladi · min. {num(f['min_qty']) if f['min_qty'] else '—'} dona</span></div>
  <div class="{'wa' if warn else ''}"><b>{rep}</b><span>qayta olgan mijoz{' — qolganiga 2–3 oyda qo‘ng‘iroq' if warn else ''}</span></div>
</div>
<div class="cols">
  <div>
    <h3>Narx — «{e(m['name']) if m else ''}», dona</h3>
    <table class="tb sm"><tbody>{trows}</tbody></table>
    {f"<p class='tip'>{num(tiers[-1]['min_qty'])} dona olsa, donasi <b>{str(times).replace('.', ',')} baravar arzon</b>.</p>" if times else ''}
    {f"<h4>Boshqa modellar</h4><ul class='li'>{oth}</ul>" if oth else ''}
    {f"<h4>Turlari</h4><ul class='li'>{kinds}</ul>" if kinds else ''}
  </div>
  <div>
    <h4>Kim oladi (buyurtmalar)</h4><div class="chips">{who or '<span>—</span>'}</div>
    <h4>Qo'shib taklif qiling</h4><div class="chips">{wth or '<span>—</span>'}</div>
    {f"<p class='up'>{e(l.get('upsell',''))}</p>" if l.get('upsell') else ''}
    <h4>Albatta so'rang</h4><ul class="li">{ask}</ul>
    {f"<div class='rem'><b>Eslab qoling:</b><ul>{rem}</ul></div>" if rem else ''}
  </div>
</div>
<h3 style="margin-top:12px">Mijoz shunday deydi</h3>
<div class="qas">{obj}</div>
<p class="ft">To'liq senariy, savol-javob va test: Darslik → «{e(l.get('title',''))}».</p>
""")

for f in top:
    product_page(f)

# rest
rr2 = "".join(
    f"<tr><td><b>{e(f['title'])}</b></td><td class='r'>{f['orders']}</td><td class='r'>{num(f['price_from']) if f['price_from'] else '—'}</td><td class='r'>{num(f['min_qty']) if f['min_qty'] else '—'}</td><td>{days(f)}</td><td>{e(L.get(f['lesson'],{}).get('title',''))}</td></tr>"
    for f in rest)
page(f"""
<div class="k">Qolgan mahsulotlar</div>
<h2 class="d">Kamroq so'raladi — lekin bilib qo'ying</h2>
<table class="tb"><thead><tr><th>Mahsulot</th><th class='r'>Buyurtma</th><th class='r'>Donasi …dan</th><th class='r'>Min. tiraj</th><th>Tayyor</th><th>Darslikda</th></tr></thead><tbody>{rr2}</tbody></table>
<p class="call" style="margin-top:18px">Katalogda jami {meta['products_active']} ta mahsulot. Narx va modellarni ilovadagi <b>Mahsulotlar</b> bo'limidan yoki botdan so'rang — mijozga narx varag'ini PDF qilib yuborish mumkin.</p>
<h3 style="margin-top:22px">Bilmasangiz — so'rang</h3>
<ul class="rules"><li>Texnik savol (material, bosma, muddat) — ishlab chiqarish menejeriga.</li><li>Narx yoki chegirma — rahbarga, mijozga va'da berishdan oldin.</li><li>Mahsulot haqida — ilovadagi Darslik va Mahsulot qo'llanmasi.</li></ul>
""")

css = f"""
@font-face{{font-family:Inter;src:url(fonts/inter-latin-wght-normal.woff2) format("woff2");font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F,U+2122,U+2190-2199,U+2212;}}
@font-face{{font-family:Inter;src:url(fonts/inter-latin-ext-wght-normal.woff2) format("woff2");font-weight:100 900;unicode-range:U+0100-024F,U+02BB-02BC,U+1E00-1EFF;}}
@font-face{{font-family:Bricolage;src:url(fonts/bricolage-grotesque-latin-standard-normal.woff2) format("woff2");font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0000-00FF,U+02BB-02BC,U+2000-206F;}}
@font-face{{font-family:Bricolage;src:url(fonts/bricolage-grotesque-latin-ext-standard-normal.woff2) format("woff2");font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0100-024F,U+1E00-1EFF;}}
@font-face{{font-family:Instrument;src:url(fonts/instrument-serif-latin-400-italic.woff2) format("woff2");font-style:italic;}}
@page{{size:A4;margin:0}}
*{{box-sizing:border-box}} html,body{{margin:0;background:#fff;color:{INK};font-family:Inter,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.pg{{width:794px;height:1123px;position:relative;overflow:hidden;padding:52px 56px 46px;page-break-after:always;font-size:13px;line-height:1.45}}
.pg.dark{{background:{FOREST};color:#fff}}
.d{{font-family:Bricolage,Inter;font-stretch:88%;letter-spacing:-.03em}}
.serif{{font-family:Instrument,serif;font-style:italic;font-weight:400;letter-spacing:0;color:{LIME}}}
.k{{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:{EMERALD};margin-bottom:6px}}
h2{{font-size:30px;line-height:1.05;margin:0 0 14px;color:{FOREST}}} h3{{font-size:15px;margin:16px 0 8px;color:{FOREST}}} h4{{font-size:12px;margin:12px 0 5px;color:{FOREST};text-transform:uppercase;letter-spacing:.06em}}
.sub{{margin:-6px 0 12px;color:{MUTE}}}
.cv{{height:100%;display:flex;flex-direction:column;justify-content:flex-end}}
.logo{{position:absolute;top:52px;left:56px;width:52px;height:52px;border-radius:14px;background:{LIME};color:{FOREST};font:800 24px Bricolage;display:grid;place-items:center}}
.ck{{font-size:11px;letter-spacing:.18em;font-weight:700;color:{LIME};margin-bottom:16px}}
.cv h1{{font-size:76px;line-height:.95;margin:0 0 22px}} .cv h1 .serif{{font-size:72px}}
.cs{{font-size:17px;line-height:1.5;color:#d7eadf;max-width:560px;margin:0 0 70px}} .cs b{{color:#fff}}
.cm{{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.2);padding-top:14px;font-size:11.5px;color:#b7d3c3}}
.days{{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}}
.day{{background:{MIST};border-radius:12px;padding:12px 11px}} .day span{{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;color:{EMERALD};text-transform:uppercase}} .day b{{display:block;font-size:13.5px;margin:3px 0;color:{FOREST}}} .day i{{font-style:normal;font-size:11px;color:{INK2}}}
.call{{background:{MIST};border-radius:12px;padding:11px 14px;color:{INK2};margin:14px 0 4px}} .call b{{color:{FOREST}}}
.tb{{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}} .tb th{{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:{MUTE};padding:0 6px 6px;border-bottom:2px solid {FOREST}}}
.tb td{{padding:8px 6px;border-bottom:1px solid {LINE}}} .tb .r{{text-align:right}} .tb .rk{{width:28px;font-weight:800;color:{EMERALD}}} .tb.sm td{{padding:5px 6px}}
.ft{{font-size:10.5px;color:{MUTE};margin-top:8px}}
.sits{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.sit{{display:flex;gap:10px;background:{MIST};border-radius:14px;padding:14px}} .sn{{flex:none;width:28px;height:28px;border-radius:9px;background:{FOREST};color:{LIME};font:800 15px Bricolage;display:grid;place-items:center}}
.sit h4{{text-transform:none;letter-spacing:0;font-size:14.5px;margin:2px 0 4px}} .sit p{{margin:0 0 6px;color:{INK2};font-size:12px}} .sit .ask{{color:{INK}}}
.chips{{display:flex;flex-wrap:wrap;gap:4px}} .chips span{{background:#fff;border:1px solid {LINE};border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;color:{INK2}}} .chips .mu{{color:{MUTE}}}
.steps{{display:grid;grid-template-columns:1fr 1fr;gap:7px}} .stp{{border-left:3px solid {EMERALD};padding:4px 10px}} .stp b{{display:block;color:{FOREST};font-size:12.5px}} .stp span{{font-size:11.5px;color:{INK2}}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:6px}}
.rules{{margin:0;padding-left:18px}} .rules li{{margin-bottom:6px}}
.ph{{display:flex;gap:14px;align-items:center}} .rkb{{width:46px;height:46px;border-radius:13px;background:{FOREST};color:{LIME};font:800 24px Bricolage;display:grid;place-items:center;flex:none}}
.lead{{font-size:14.5px;line-height:1.5;margin:12px 0 4px;color:{INK}}} .aud{{margin:0 0 12px;color:{INK2}}}
.facts{{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}} .facts div{{background:{MIST};border-radius:11px;padding:9px 10px}} .facts b{{display:block;font:800 17px Bricolage;font-stretch:88%;color:{FOREST}}} .facts span{{font-size:10.5px;color:{INK2};line-height:1.3;display:block}}
.facts .wa{{background:{AMBER}}} .facts .wa b{{color:{CLAY}}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px}}
.tip{{background:{MIST};border-radius:9px;padding:6px 10px;font-size:11.5px;color:{EMERALD};margin:6px 0 0}}
.li{{margin:0;padding-left:16px;font-size:12px;color:{INK2}}} .li li{{margin-bottom:3px}}
.up{{font-size:11.5px;color:{INK2};margin:6px 0 0;background:{MIST};border-radius:9px;padding:6px 10px}}
.qas{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}} .qa{{border-top:2px solid {FOREST};padding-top:6px;font-size:11.5px;color:{INK2}}} .qa b{{display:block;color:{FOREST};font-size:12.5px;margin-bottom:3px}}
.rem{{margin-top:12px;background:{AMBER};border-radius:11px;padding:9px 12px;font-size:12px}} .rem b{{color:{CLAY}}} .rem ul{{margin:4px 0 0;padding-left:18px}}
.pn{{position:absolute;bottom:22px;right:56px;font-size:10px;color:{MUTE}}} .br{{position:absolute;bottom:22px;left:56px;font-size:10px;color:{MUTE};font-weight:700}}
"""
out = []
for i, (body, cls) in enumerate(pages, 1):
    foot = "" if cls == "dark" else f"<div class='br'>Vodiy Print · Yangi sotuvchi qo'llanmasi</div><div class='pn'>{i} / {len(pages)}</div>"
    h = f"<section class='pg {cls}'>{body}{foot}</section>".replace("&#x27;", "'")
    h = re.sub(r"(?<=[oOgG])'(?![^<]*>)", "‘", h)
    h = re.sub(r"(?<=[A-Za-z])'(?=[A-Za-z])(?![^<]*>)", "’", h)
    out.append(h)
open(f"{D}/guide.html", "w").write(f"<!doctype html><html lang='uz'><head><meta charset='utf-8'><title>Yangi sotuvchi qo'llanmasi</title><style>{css}</style></head><body>{''.join(out)}</body></html>")
print("pages", len(pages))
