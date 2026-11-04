#!/usr/bin/env python3
# Staff deck (2026-11-04): the new daily routine and tools. Needs kpi-phone.png
# (vp-mockup harness, ?v=me) and funnel.png (SalesFunnel page) next to this file.
# Sotuv bo'limi xodimlari uchun: 2-noyabrdan nima o'zgardi va har kuni nima qilinadi.
import os, sys
sys.path.insert(0, "/home/user/vodiy-print-v2-yangi/.claude/skills/vp-deck")
from deck_base import *
OUT = os.path.dirname(os.path.abspath(__file__))

# 1 cover
slide("""
<div class="cover">
  <div class="logo">vp</div>
  <div class="cover-k">VODIY PRINT · SOTUV BO'LIMI · XODIMLAR UCHUN</div>
  <h1 class="d" style="font-size:100px">Yangi ish tartibi<br><span class="serif" style="font-size:90px">va yangi vositalar</span></h1>
  <p class="cover-sub">2-noyabrdan nima o'zgardi: bot har kuni nima yuboradi, amoCRM'da nima qilinadi, KPI qanday hisoblanadi va yangi sotuvchi qanday o'rganadi.</p>
  <div class="cover-meta"><span>Muhammaddiyor · Nuriddin · Maryam · Muhammadali</span><span>printvodiy.uz</span></div>
</div>""", "dark", False)

# 2 why
slide("""
<div class="k">Nima uchun</div>
<h2 class="d">Oktyabr: mijozlar ko'p keldi — lekin yo'lda yo'qolyapti</h2>
<div class="flow">
  <div class="fl"><b>745</b><span>lid keldi (amoCRM)</span></div>
  <div class="fl"><b>571</b><span>bilan gaplashildi</span></div>
  <div class="fl"><b>34</b><span>amoCRM'da «ma'lumot berildi»ga o'tkazilgan</span></div>
  <div class="fl"><b>24</b><span>buyurtma berdi va to'ladi</span></div>
</div>
<div class="two" style="margin-top:26px;gap:40px">
  <p class="callout" style="margin:0">Gaplashilgan 571 kishidan atigi 34 tasi keyingi bosqichga surilgan. <b>Biz nima bo'lganini bilmaymiz</b> — taklif yuborildimi, nega rad etdi, qachon qayta qo'ng'iroq qilish kerak.</p>
  <p class="callout" style="margin:0">Yo'qotilgan 375 ta lidning <b>birortasida sabab yozilmagan</b>. 517 ta lid birinchi bosqichda turib qolgan. Yangi tartib — shu teshiklarni yopish uchun.</p>
</div>
<p class="foot">Haqiqiy raqamlar: ERP va amoCRM, oktyabr 2026.</p>
""")

# 3 day
day = [
    ("09:00", "Kunlik vazifalar (amoCRM) va 5 ta eski mijoz", "bot"),
    ("09:30", "Birinchi qo'ng'iroq shu vaqtgacha", "qoida"),
    ("10:00", "Qarzdorlar ro'yxati · vazifasiz, harakatsiz va sababsiz yopilgan bitimlar", "bot"),
    ("kun bo'yi", "Javobsiz kiruvchi qo'ng'iroq — 15 daqiqada qayta qo'ng'iroq, tugmani bosing", "qoida"),
    ("15:00", "Hali vazifa qo'yilmagan bitimlar — qayta eslatma", "bot"),
    ("18:00", "Bugun bajarilmagan vazifalar", "bot"),
    ("19:00", "Kun yakuni rahbarga boradi", "rahbar"),
]
dy = "".join(f'<div class="dy"><span class="dt d">{t}</span><span class="dd">{d}</span><span class="dw {w}">{w}</span></div>' for t, d, w in day)
slide(f"""
<div class="k">Kun tartibi</div>
<h2 class="d">Har ish kuni shunday o'tadi</h2>
<div class="dyl">{dy}</div>
<p class="foot">Yakshanba va bayram kunlari bot ro'yxat yubormaydi.</p>
""")

# 4 recall
slide(f"""
<div class="k">1 · Eski mijozlar</div>
<h2 class="d">Har kuni 5 ta eski mijoz — eng uzoq vaqt olmaganidan boshlab</h2>
<div class="two" style="grid-template-columns:1fr 1fr;gap:40px">
  {tg(["<b>1/5 · Mijoz nomi</b> — mas'ul shaxs", "📞 telefon raqami", "", "Oxirgi xarid: 14 oy oldin", "Flayer 1000 dona, Katalog 5 dona — 4,8 mln", "Jami: 3 buyurtma · 11,2 mln", "", "💡 Taklif: yangi yil — kalendar, Gift Box; o'tgan safar Flayer — yana kerakmi?"], "09:00", ["✅ Buyurtma bo'ldi", "🕒 Keyinroq", "❌ Kerak emas", "📵 Javob bermadi"])}
  <div>
    <div class="rule"><b>Qo'ng'iroq qiling</b><span>Oxirgi xarid va taklif xabarda yozilgan — tayyor gap.</span></div>
    <div class="rule"><b>Natijani bosing</b><span>Har qo'ng'iroqdan keyin bitta tugma. Natija mijozning ERP'dagi izohlariga yoziladi.</span></div>
    <div class="rule"><b>Keyinroq</b><span>Ertaga, 3 kun, 1 hafta yoki 1 oy — o'sha kuni mijoz yana chiqadi.</span></div>
    <div class="rule"><b>Kerak emas</b><span>Sababini tanlang: boshqadan oladi, hozir kerak emas, narx qimmat, yopilgan.</span></div>
    <div class="rule"><b>19:00</b><span>Rahbarga kim nechta qo'ng'iroq qilgani boradi.</span></div>
  </div>
</div>
<p class="foot">Namuna xabar — haqiqiy xabarda mijozning ismi va telefoni bo'ladi.</p>
""")

# 5 debts
slide(f"""
<div class="k">2 · Qarz undirish</div>
<h2 class="d">Topshirilgan, lekin to'lanmagan buyurtmalar — har kuni 10:00 da</h2>
<div class="two" style="grid-template-columns:1fr 1fr;gap:40px">
  {tg(["<b>1/3 · Mijoz nomi</b>", "📞 telefon raqami", "", "VP-512 · Paket 500 dona", "Qarz: 2,4 mln · topshirilganiga 18 kun ⚠️"], "10:00", ["🤝 Va'da berdi", "📵 Javob bermadi", "✅ To'ladi"])}
  <div>
    <div class="rule"><b>Va'da berdi</b><span>Sanani tanlang: ertaga, 3 kun yoki 1 hafta. O'sha kungacha bot so'ramaydi.</span></div>
    <div class="rule"><b>Va'da buzilsa</b><span>Pul tushmasa, mijoz yana ro'yxatga chiqadi va «va'da bergan edi» deb yoziladi. 19:05 da rahbarga buzilgan va'dalar boradi.</span></div>
    <div class="rule"><b>To'ladi</b><span>To'lovni ERP'ga kiriting — qarz ro'yxatdan o'zi chiqadi va KPI'dagi kirim bonusiga qo'shiladi.</span></div>
    <div class="rule"><b>Tayyor buyurtma</b><span>Topshirishda pulni olish kerak bo'lganlar ham alohida ko'rsatiladi.</span></div>
  </div>
</div>
<p class="foot">Namuna xabar.</p>
""")

# 6 missed calls
slide(f"""
<div class="k">3 · Javobsiz qo'ng'iroqlar</div>
<h2 class="d">Javob berilmagan mijoz — 15 daqiqada qayta qo'ng'iroq</h2>
<div class="two" style="grid-template-columns:1fr 1fr;gap:40px">
  {tg(["📵 Javobsiz kiruvchi qo'ng'iroq — 15 daqiqa", "📞 telefon raqami · bitim nomi", "", "Qayta qo'ng'iroq qiling."], "11:20", ["✅ Javob qaytardim", "⏰ Keyinroq eslat"])}
  <div>
    <div class="rule"><b>Javob qaytardim</b><span>Ish raqamidan qo'ng'iroq qilganingizdan keyin bosing. Bot buni amoCRM'dan tekshiradi — qo'ng'iroq bo'lmasa, qabul qilinmaydi.</span></div>
    <div class="rule"><b>Keyinroq eslat</b><span>30 daqiqa, 1 soat yoki 3 soatdan keyin bot yana eslatadi.</span></div>
    <div class="rule"><b>1 soat o'tsa</b><span>Hech kim qaytarmagan qo'ng'iroq rahbarga boradi.</span></div>
  </div>
</div>
<p class="foot">Namuna xabar.</p>
""")

# 7 deals
slide(f"""
<div class="k">4 · Bitim nazorati</div>
<h2 class="d">Har ochiq bitimda keyingi qadam bo'lsin</h2>
<div class="two" style="grid-template-columns:1fr 1fr;gap:40px">
  {tg(["⚠️ 4 ta bitimda keyingi vazifa yo'q:", "• Kafe paketlari — 3,2 mln · маълумот берилди", "• Maktab bloknotlari · Қабул Қилинди", "", "🕒 3 kundan beri harakatsiz — 2 ta", "", "❌ Yo'qotildi, sababi yozilmagan — 1 ta:", "• Restoran formalari", "Har biriga amoCRM'da yo'qotish sababini tanlang."], "10:00")}
  <div>
    <div class="rule"><b>Vazifasiz bitim</b><span>amoCRM'da vazifa qo'ying: qaysi kuni va nima qilinadi. 15:00 da qolganlari yana keladi.</span></div>
    <div class="rule"><b>Harakatsiz bitim</b><span>3 kundan beri hech narsa bo'lmagan — qo'ng'iroq qiling yoki bosqichini yangilang.</span></div>
    <div class="rule"><b>Sababsiz yopilgan</b><span><span class="new">yangi</span> So'nggi 3 kunda sababsiz yopgan bitimlaringiz. Sababni tanlang — ro'yxatdan o'zi chiqadi.</span></div>
  </div>
</div>
<p class="foot">Namuna xabar.</p>
""")

# 8 amoCRM stages
st = [("Қабул Қилинди", "Lid qabul qilindi — 15 daqiqada qo'ng'iroq"), ("маълумот берилди", "Gaplashdingiz, ehtiyojni bildingiz"), ("Таклиф Юборилди", "Narx yoki maket yubordingiz"), ("Дизайн/аванс", "Avans oldingiz, dizayn boshlandi"), ("ишлаб чикариш", "Buyurtma ERP'da, ishlab chiqarishda"), ("етказилди", "Topshirildi")]
fl = "".join(f'<div class="fl"><b style="font-size:18px;font-family:Inter,DejaVu Sans,sans-serif;font-weight:800;letter-spacing:0">{a}</b><span>{b}</span></div>' for a, b in st)
slide(f"""
<div class="k">5 · amoCRM bosqichlari</div>
<h2 class="d">Lidni bosqichma-bosqich suring — voronka shundan hisoblanadi</h2>
<div class="flow">{fl}</div>
<div class="two" style="margin-top:22px;gap:36px">
  <p class="callout" style="margin:0"><b>«Муваффақиятсиз» — faqat sabab bilan.</b> Qimmat, muddat to'g'ri kelmadi, boshqa joydan oldi, javob bermayapti, faqat narx so'radi. Sababsiz yopilgan bitim ertasi kuni sizga qaytib keladi.</p>
  <p class="callout" style="margin:0"><b>Har buyurtma ERP'da, o'z nomingizga.</b> Voronka amoCRM lidini ERP buyurtmasi bilan telefon raqami orqali bog'laydi — mijoz telefonini to'g'ri yozing.</p>
</div>
""")

# 9 KPI
slide("""
<div class="k">6 · Mening KPI</div>
<h2 class="d">Topgan pulingiz har kuni ko'rinadi</h2>
<div class="two" style="grid-template-columns:330px 1fr;gap:40px;align-items:start">
  <img src="kpi-phone.png" style="width:100%;max-height:520px;object-fit:cover;object-position:top;border-radius:18px;box-shadow:0 10px 30px rgba(11,61,46,.15)">
  <div>
    <div class="rule"><b>Sotuv bonusi — 7,5%</b><span>Shu oy kiritgan buyurtmalaringiz summasidan. Har doim to'lanadi.</span></div>
    <div class="rule"><b>Kirim bonusi — 2%</b><span>Shu oy kelgan pul (eski qarzlar ham). Davomat va amoCRM vazifalari 80% dan yuqori bo'lsa to'lanadi.</span></div>
    <div class="rule"><b>Reja chizig'i</b><span>Qora chiziq — oyning bugungi kuniga kerakli joy. Undan orqada bo'lsangiz, oy oxirini kutmang.</span></div>
    <div class="rule"><b>Qanday ko'paytiraman</b><span>Rejagacha qancha sotuv qoldi, qarzni undirsangiz va vazifalarni bajarsangiz qancha qo'shiladi — tayyor hisob.</span></div>
    <p class="callout">Davomat va KPI → <b>Mening KPI</b>. Rahbar oyni tasdiqlagach, Telegram'ga hisobot keladi.</p>
  </div>
</div>
<p class="foot">Ekrandagi raqamlar namuna.</p>
""")

# 10 call opening
steps = [("1. Kontakt", "«Assalomu alaykum, Anvar aka? Men Muhammaddiyor, Vodiy Print'danman. Paket bo'yicha qiziqish qoldirgan ekansiz. Hozir 2 daqiqa gaplasha olamizmi?»"),
         ("2. Ramka", "«Sizga aynan keragini tavsiya qilishim uchun avval 3–4 ta savol beraman, keyin variantlar va narxni aytaman — maylimi?»"),
         ("3. SPIN savollar", "Vaziyat → muammo → oqibat → foyda. Nima uchun, nechta, qachonga, hozir qanday qilyapsiz?"),
         ("4. Tavsiya va narx", "Ehtiyojga mos variant, keyin narx. Tirajni ko'tarishni taklif qiling — donasi arzon."),
         ("5. Yopish va keyingi qadam", "Maket yoki hisobni bugun yuboraman — qachon ko'rib chiqasiz? amoCRM'da vazifa qo'ying.")]
ss = "".join(f'<div class="rk"><b>{a}</b><span>{b}</span></div>' for a, b in steps)
slide(f"""
<div class="k">7 · Darslik</div>
<h2 class="d">Har qo'ng'iroq bir xil boshlanadi: Kontakt → Ramka → SPIN</h2>
<div>{ss}</div>
<p class="foot">Har mahsulotning to'liq skripti, e'tirozlarga javoblar va test: Darslik → mahsulot → «Sotuv senariysi». Qo'ng'iroq paytida «Qo'ng'iroq rejimi»ni oching.</p>
""")

# 11 guide
slide("""
<div class="k">8 · Mahsulot qo'llanmasi</div>
<h2 class="d">72 ta mahsulotni yodlash shart emas</h2>
<div class="tiles" style="grid-template-columns:repeat(3,1fr)">
  <div class="tile"><b>10 ta</b><span>mahsulot sotuvning 89% ini beradi: paket, bloknot, nimcha, gift box, futbolka, bakal, suvenir, flayer, kepka, ruchka</span></div>
  <div class="tile"><b>6 ta</b><span>mijoz vaziyati: do'kon, maktab, korporativ sovg'a, forma, ofis, tadbir — har biriga nima taklif qilinadi</span></div>
  <div class="tile"><b>5 kun</b><span>yangi sotuvchi yo'li: mahsulotlar → vaziyatlar → skript → test → tajribali yonida</span></div>
</div>
<p class="callout" style="margin-top:22px">Har mahsulot kartochkasida haqiqiy raqamlar: odatda qancha tiraj olinadi, odatdagi buyurtma, narx jadvali, kim oladi va <b>nima bilan birga oladi</b> — buyurtmaga qo'shib taklif qiling. Darslik → <b>«Mahsulot qo'llanmasi»</b>. Chop etilgan PDF varianti ham bor.</p>
""")

# 12 orders
slide("""
<div class="k">9 · Buyurtma kiritish</div>
<h2 class="d">ERP'da buyurtma — to'g'ri va to'liq</h2>
<div class="hvg">
  <div class="hv"><span class="ok">✓</span><div><h4>Chala buyurtma o'chmaydi</h4><p>Boshqa sahifaga o'tib ketsangiz ham kiritgan ma'lumot saqlanadi — Buyurtmalar sahifasida «davom ettirish» chiqadi.</p></div></div>
  <div class="hv"><span class="ok">✓</span><div><h4>Eski qarz ogohlantirishi</h4><p>Mijozning 30 kundan eski to'lanmagan qarzi bo'lsa, yangi buyurtmada ogohlantirish chiqadi — avval qarzni gaplashing.</p></div></div>
  <div class="hv"><span class="ok">✓</span><div><h4>O'z nomingizga</h4><p>KPI va voronka buyurtmani menejer nomi bo'yicha sanaydi. Boshqa nomga yozilsa — bonus sizga tushmaydi.</p></div></div>
  <div class="hv"><span class="ok">✓</span><div><h4>Mahsulotni katalogdan tanlang</h4><p>Qo'lda yozilgan nom statistikani buzadi: hozir 324 qatordan 258 tasi qo'lda yozilgan.</p></div></div>
</div>
""")

# 13 manager view
slide("""
<div class="k">Rahbar nimani ko'radi</div>
<h2 class="d" style="font-size:40px">Nazorat va voronka — hammasi avtomatik, qo'lda hisobot yo'q</h2>
<img class="shot" src="funnel.png" style="max-height:400px">
<p class="foot">«Sotuv voronkasi» (namuna raqamlar). Qizil — jamoa o'rtachasidan ancha past joy: jazo emas, yordam kerak bo'lgan joy.</p>
""")

# 14 rules
rules = [
    "09:30 gacha birinchi qo'ng'iroq",
    "Javobsiz kiruvchiga 15 daqiqada qayta qo'ng'iroq — keyin «Javob qaytardim»",
    "Har kuni 5 ta eski mijoz — beshtasiga ham natija tugmasi",
    "Qarzdorga qo'ng'iroq — va'da sanasini tugma bilan belgilang",
    "Har ochiq bitimda keyingi vazifa, 3 kundan ortiq harakatsiz bitim yo'q",
    "Lidni bosqichma-bosqich suring, yo'qotsangiz — sabab bilan",
    "Har buyurtma ERP'da, o'z nomingizga, mahsulot katalogdan",
    "Kuniga 10 daqiqa: Darslik yoki Mahsulot qo'llanmasi",
]
cr = "".join(f'<div class="fd"><span class="ck"></span><span class="ft" style="grid-column:2/4">{r}</span></div>' for r in rules)
slide(f"""
<div class="k">Eslab qoling</div>
<h2 class="d">Sakkiz qoida</h2>
<div class="fdl">{cr}</div>
<p class="foot">Savol bo'lsa — rahbarga yoki botga yozing.</p>
""")

more = """
.new{display:inline-block;background:#d6f25c;color:#0b3d2e;font-size:11px;font-weight:800;border-radius:6px;padding:1px 6px;margin-right:6px;text-transform:uppercase;letter-spacing:.06em}
.rk{display:grid;grid-template-columns:230px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #d8e6dc;font-size:17px;line-height:1.4;color:#355446} .rk b{color:#0b3d2e}
.shot{display:block;width:100%;object-fit:contain;object-position:left top;border-radius:14px;box-shadow:0 10px 30px rgba(11,61,46,.12)}
.flow .fl{padding:18px 16px}
.fdl .fd{padding:14px 0}
"""
print("slides", build(os.path.join(OUT, "xodimlar.html"), "Yangi ish tartibi", more))
