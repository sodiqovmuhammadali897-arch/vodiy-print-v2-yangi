# Botga keyinchalik qo'shiladigan imkoniyatlar

Kelishilgan, lekin hali qilinmagan takliflar (2026-oktyabr). Boshlashdan oldin
har birining maketi ko'rsatiladi.

Tavsiya etilgan tartib: avval **1, 2, 3** (to'g'ridan-to'g'ri pul keltiradi),
**4** ni ular bilan birga qo'shsa bo'ladi.

## Sotuv menejerlari uchun

### 1. Mijoz ko'tarmasa — bot o'zi eslatma taklif qiladi ⭐
amoCRM'ga Mois Zvonki qo'ng'iroqlari yoziladi. Javobsiz qo'ng'iroq (davomiyligi 0)
ko'rinishi bilan bot menejerga yozadi:

> 📞 Aziz Karimov ko'tarmadi. Qachon qayta qo'ng'iroq qilay?
> [30 daq] [1 soat] [Ertaga 10:00]

Bitta bosish bilan `⏰ Eslatma` qo'yiladi (meta-webhook/reminders.js).

### 2. Yangi lid kelganda tezkor nazorat
Lid menejerga tushishi bilan botga xabar. 15 daqiqada qo'ng'iroq qilinmasa —
menejerga eslatma, 30 daqiqada ham qilinmasa — adminga.

### 3. «💰 Bugun kimdan pul undirish kerak»
Har ertalab menejerga qarzdor mijozlari: ism, telefon, qarz summasi va
«undirsangiz +X so'm» (KPI'dagi kirimdan 2%).

### 4. «📊 Mening KPI» tugmasi
Pastki menyuda tugma: bugungacha bonus, reja, davomat, amoCRM foizi — bitta
xabarda (hozir botdan so'rash kerak).

### 5. Ovozli xabar bilan eslatma va vazifa
Menejer gapirib yuboradi («Ertaga 10 da Aziz akaga narxni aytish») — bot
ovozni matnga aylantiradi (Whisper, OpenAI kaliti bor) va eslatmani o'zi qo'yadi.

### 6. Buyurtma tayyor bo'lganda xabar
Ishlab chiqarish «tayyor» qilganda menejerga: «VP-531 (Asia Tekstil) tayyor —
mijozga xabar bering», mijoz telefoni bilan.

## Admin uchun

### 7. Kechki yagona hisobot (18:30)
Bitta xabarda: bugungi sotuv va kirim, kim kech qoldi, bajarilmagan va
surilgan zadachalar, har menejerning bugungi natijasi.

### 8. Haftalik reyting (dushanba ertalab)
Menejerlar reytingi: sotuv, kirim, KPI, o'tgan haftaga nisbatan o'zgarish.
Hammaga yuborilsa — raqobat ruhi.

## Avvalroq kechiktirilgan ishlar

- Qo'ng'iroq qilib surilgan zadachani ajratish: surilgan zadacha bo'yicha
  o'sha kuni shu mijozga qo'ng'iroq qilingan bo'lsa — xabarda ko'rsatish
  («📞 Bugun 2 marta qo'ng'iroq qilingan, javob bermadi»).
- KPI: rejadan oshgani uchun ustama (+1%), 80% chegarasi o'rniga zinapoya
  (80–89% — yarmi), ertalabki bonus xulosasi, davomatning batafsil jadvali.
- KPI: tasdiqlashdan oldin qo'lda mukofot / jarima (+/− summa, izoh bilan).
- Eski buyurtmalarni (masalan VP-497) mahsulotlar bo'yicha alohida
  buyurtmalarga ajratish tugmasi.
