#!/usr/bin/env python3
# Example deck (the sales funnel proposal, 2026-11-02). Copy this file,
# change the slides, run:  python3 voronka.py OUTDIR  &&  node ../render.mjs OUTDIR/voronka.html OUTDIR/voronka.pdf OUTDIR/v
# Slides 5–7 embed mockup screenshots (fv-*.png) that must sit in OUTDIR.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from deck_base import *

# 1 — cover
slide("""
<div class="cover">
  <div class="logo">vp</div>
  <div class="cover-k">VODIY PRINT · SOTUV BO'LIMI · RAHBAR UCHUN</div>
  <h1 class="d" style="font-size:108px">Sotuv voronkasi<br><span class="serif" style="font-size:96px">liddan pulgacha</span></h1>
  <p class="cover-sub">Har oy kelgan lidlarning qanchasi qo'ng'iroq, taklif, buyurtma va to'lovgacha yetadi — va qayerda yo'qotyapmiz. Qurishdan oldin: nima ko'rinadi va qanday hisoblanadi.</p>
  <div class="cover-meta"><span>Taklif · tasdiqlash uchun</span><span>printvodiy.uz</span></div>
</div>""", "dark", False)

# 2 — the question
slide("""
<div class="k">Savol</div>
<h2 class="d">Oktyabrda 745 lid keldi. Buyurtma — 94 ta. Qolgan 651 tasi qayerda yo'qoldi?</h2>
<div class="tiles">
  <div class="tile"><b>745</b><span>lid amoCRM'ga tushdi<br>(oktyabr)</span></div>
  <div class="tile"><b>94</b><span>buyurtma ERP'da<br>(menejerlar nomida)</span></div>
  <div class="tile"><b>≈ 12%</b><span>liddan buyurtmagacha —<br>lekin qaysi bosqichda tushib qolyapti, hozir ko'rinmaydi</span></div>
</div>
<p class="callout" style="margin-top:26px">Hozir ERP'da faqat «hozir qaysi bosqichda nechta lid turibdi» ko'rinadi. <b>Voronka hisoboti</b> bir oyda kelgan lidlarni boshidan oxirigacha kuzatadi: har bosqichda nechtasi qoldi, necha foizi o'tdi, kim qayerda yo'qotyapti.</p>
""")

# 3 — the real picture
slide("""
<div class="k">Hozirgi holat · haqiqiy raqamlar</div>
<h2 class="d">amoCRM voronkasi bugun to'liq ishlamayapti</h2>
<div class="tiles" style="grid-template-columns:repeat(4,1fr)">
  <div class="tile"><b>24 / 94</b><span>amoCRM'da «yutildi» — 24 ta. ERP'da buyurtma — 94 ta. 70 ta buyurtma amoCRM'da yopilmagan.</span></div>
  <div class="tile"><b>513</b><span>lid «Қабул Қилинди» bosqichida turib qolgan — keyingi bosqichga surilmagan.</span></div>
  <div class="tile"><b>0</b><span>lid «Таклиф Юборилди» bosqichida. Bu bosqich ishlatilmayapti.</span></div>
  <div class="tile"><b>997</b><span>yo'qotilgan lid (sentyabr–noyabr) — birortasida sabab yozilmagan.</span></div>
</div>
<p class="callout" style="margin-top:26px">Shuning uchun voronkaning <b>tepasini amoCRM'dan</b> (lid, qo'ng'iroq, bosqichlar), <b>pastini ERP'dan</b> (buyurtma, to'lov) olamiz. Menejerlar amoCRM'da lidni bosqichma-bosqich surmaguncha oraliq bosqichlar kam ko'rinadi — hisobot buni ham ochiq ko'rsatadi.</p>
""")

# 4 — the steps
steps = [
    ("Lid keldi", "amoCRM", "Shu oyda amoCRM'ga tushgan har bir lid (Неразобранное ham)."),
    ("Gaplashildi", "qo'ng'iroq", "Lid yoki uning kontakti bilan 30 soniyadan uzun qo'ng'iroq bo'lgan."),
    ("Ma'lumot berildi", "amoCRM", "Lid «маълумот берилди» yoki undan keyingi bosqichga o'tgan."),
    ("Taklif yuborildi", "amoCRM", "«Таклиф Юборилди», «Дизайн/аванс» yoki undan keyingi bosqichga o'tgan."),
    ("Buyurtma", "ERP", "Lid telefoni ERP'dagi mijozga mos, lid kelgandan keyin 60 kun ichida buyurtma bor."),
    ("To'landi", "ERP", "O'sha buyurtmaga pul tushgan (qisman bo'lsa ham)."),
]
fl = "".join(f'<div class="fl"><b>{t}</b><i class="src">{s}</i><span>{d}</span></div>' for t, s, d in steps)
slide(f"""
<div class="k">Qanday hisoblanadi</div>
<h2 class="d">Olti bosqich — har biri aniq qoida bilan</h2>
<div class="flow">{fl}</div>
<p class="callout" style="margin-top:22px">Bosqich amoCRM'dagi <b>o'zgarishlar tarixidan</b> olinadi: keyin yo'qotilgan lid ham qaysi bosqichgacha yetganini bilamiz. Telefonlar server ichida solishtiriladi — bazaga faqat sonlar yoziladi.</p>
""")

# 5 — screen: funnel
slide("""
<div class="k">Ekran · Sotuv bo'limi → «Voronka»</div>
<h2 class="d" style="font-size:40px">Bir qarashda: nechta lid qayergacha yetdi</h2>
<img class="shot" src="fv-funnel.png">
<p class="foot">Lid va buyurtma soni — haqiqiy (oktyabr). Oraliq bosqichlar — namuna.</p>
""")

# 6 — screen: managers + leaks
slide("""
<div class="k">Ekran · menejerlar va teshiklar</div>
<h2 class="d" style="font-size:40px">Kim qaysi bosqichda yo'qotyapti</h2>
<img class="shot" src="fv-grid2.png">
<p class="foot">Qizil — jamoa o'rtachasidan 10 punktdan ko'p past. Menejer raqamlari — namuna.</p>
""")

# 7 — screen: source, speed, hygiene
slide("""
<div class="k">Ekran · manba, tezlik, tartib</div>
<h2 class="d" style="font-size:40px">Qaysi reklama pul olib keladi va qayerda vaqt ketyapti</h2>
<img class="shot" src="fv-grid3.png">
<p class="foot">«amoCRM tartibi» — haqiqiy raqamlar. Manba va tezlik — namuna.</p>
""")

# 8 — manager rules
rules = [
    ("Yangi lid", "15 daqiqa ichida qo'ng'iroq — «Қабул Қилинди»"),
    ("Gaplashdingiz", "lidni «маълумот берилди»ga suring"),
    ("Narx / maket yubordingiz", "«Таклиф Юборилди»ga suring"),
    ("Avans oldingiz", "«Дизайн/аванс»ga suring"),
    ("Mijoz rad etdi", "«Муваффақиятсиз» — sababini albatta tanlang"),
    ("Buyurtma bo'ldi", "ERP'ga o'z nomingizga kiriting, amoCRM'da «етказилди»"),
]
rr = "".join(f'<div class="rk"><b>{a}</b><span>{b}</span></div>' for a, b in rules)
slide(f"""
<div class="k">Voronka ishlashi uchun</div>
<h2 class="d">Menejer har lidni bosqichma-bosqich suradi</h2>
<div class="two" style="grid-template-columns:1.25fr 1fr;gap:44px">
  <div>{rr}</div>
  <div>
    <p class="callout" style="margin-top:0"><b>amoCRM sozlamasi (siz yoqasiz):</b> «Муваффақиятсиз»ga o'tkazishda sabab majburiy. Sabablar ro'yxati: qimmat, muddat to'g'ri kelmadi, boshqa joydan oldi, javob bermayapti, faqat narx so'radi.</p>
    <p class="callout"><b>Bot (ixtiyoriy):</b> har kuni ertalab menejerga — kecha sababsiz yopilgan va «Қабул Қилинди»da 2 kundan ortiq turgan lidlari.</p>
    <p class="callout">Bu qoidalar menejerlar taqdimotiga va Darslikka qo'shiladi.</p>
  </div>
</div>
""")

# 9 — how to use
use = [
    ("Har dushanba, 15 daqiqa", "Voronkani oching: eng katta teshik qayerda? Bitta bosqichni tanlang."),
    ("Menejer bilan", "Uning qizil ustuni bo'yicha 2–3 ta qo'ng'iroq yozuvini birga eshiting, Darslikdagi skriptga solishtiring."),
    ("Oyma-oy", "«◀ Sentyabr» — o'tgan oy bilan solishtiring: teshik kichraydimi?"),
    ("Reklama", "Manba bo'yicha: lid ko'p, buyurtma kam bo'lgan kanalga pul kamaytiriladi."),
]
uu = "".join(f'<div class="hv"><span class="ok">✓</span><div><h4>{t}</h4><p>{d}</p></div></div>' for t, d in use)
slide(f"""
<div class="k">Rahbar uchun</div>
<h2 class="d">Hisobot — haftalik qaror uchun</h2>
<div class="hvg">{uu}</div>
<p class="callout" style="margin-top:22px">Maqsad misoli: liddan pulgacha <b>11% → 15%</b>. Shu lid oqimida bu oyiga taxminan <b>+30 ta</b> to'lagan mijoz.</p>
""")

# 10 — build plan
plan = [
    ("1", "Server", "amoCRM bosqich tarixi, qo'ng'iroqlar, ERP buyurtma va to'lovlarini lid bo'yicha bog'laydi; har oy va menejer uchun sonlarni yozadi. Eski oylar ham hisoblanadi."),
    ("2", "ERP sahifa", "Sotuv bo'limi → «Voronka»: maketdagi bloklar, oy va menejer tanlash, Excel. Faqat rahbar ko'radi."),
    ("3", "Bot (ixtiyoriy)", "Sababsiz yopilgan va turib qolgan lidlar bo'yicha ertalabki eslatma — 2-noyabr tartibiga qo'shiladi."),
]
pp = "".join(f'<div class="it"><h4>{n} · {t}</h4><p>{d}</p></div>' for n, t, d in plan)
slide(f"""
<div class="k">Reja</div>
<h2 class="d">Nima quriladi</h2>
<div class="grid3" style="height:auto;grid-template-rows:auto">{pp}</div>
<p class="callout" style="margin-top:26px"><b>Kelishib olish kerak:</b> «Gaplashildi» chegarasi — 30 soniya? Lid → buyurtma oynasi — 60 kun? Bot eslatmasi kerakmi? Tasdiqlasangiz — quraman, ishga tushgach haqiqiy raqamlar bilan qayta ko'rsataman.</p>
""")


out = sys.argv[1] if len(sys.argv) > 1 else "."
print("slides", build(os.path.join(out, "voronka.html"), "Sotuv voronkasi"))
