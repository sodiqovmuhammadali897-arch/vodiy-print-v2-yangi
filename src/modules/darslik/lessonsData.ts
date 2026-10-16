// Darslik: what a sales manager needs to sell each kind of product — what
// it is, who buys it, what to ask, a step-by-step call script, answers to
// objections, questions customers ask, and a short test.
//
// This file is the starting text. An admin can edit any lesson in the app;
// the edit is saved in lessons/{key} and replaces these fields. Prices,
// minimum runs and lead times are not written here: they come from the
// products in Mahsulotlar whose name matches `match` (see lessonFacts.ts),
// and the script can use them as {narx}, {tiraj} and {muddat}.

export type LessonStep = { title: string; say: string; note?: string };
export type QA = { q: string; a: string };
export type QuizQ = { q: string; options: string[]; correct: number; why: string };

export type Lesson = {
  key: string;
  title: string;
  category: string; // one of PRODUCT_CATEGORIES
  emoji: string;
  match: string[]; // words in product names this lesson covers
  audience: string; // kimga sotiladi, one line
  about: string; // paragraphs, blank line between
  kinds: string[]; // turlari va material
  priceNote: string[]; // narx nimaga bog'liq
  ask: string[]; // albatta so'rang
  steps: LessonStep[];
  objections: QA[]; // q: what the customer says, a: the answer
  faq: QA[];
  upsell: string;
  remember: string[];
  quiz: QuizQ[];
};

// ── shared pieces ───────────────────────────────────────────────────
const hello = (what: string): LessonStep => ({
  title: "Salomlashish",
  say: `Assalomu alaykum! Vodiy Print'dan, ismim ___. ${what} bo'yicha murojaat qilgan ekansiz — 2 daqiqa gaplasha olamizmi?`,
  note: "Ismingizni aniq ayting, ovozda tabassum bo'lsin. Band bo'lsa — qachon qo'ng'iroq qilishni so'rab, amoCRM'ga zadacha qo'ying.",
});

const close = (what: string): LessonStep => ({
  title: "Yopish",
  say: `Unda bunday qilamiz: logotipingiz va kerakli ma'lumotlarni Telegram'ga tashlang, bugun ${what} maketi va aniq hisobini yuboraman. Tasdiqlasangiz — ishni navbatga qo'yamiz.`,
  note: "Aniq keyingi qadamni ayting: nima yuboradi, qachon javob olasiz. Gapni «xo'p, o'ylab ko'ring» bilan tugatmang.",
});

const followUp: LessonStep = {
  title: "Keyingi qadam",
  say: "Maketni ko'rib chiqdingizmi? Biror joyini o'zgartiramizmi yoki shu holida tasdiqlaymizmi?",
  note: "Maket yuborilgandan keyin 1 kun ichida qayta qo'ng'iroq qiling. amoCRM'da zadacha bo'lsin — aks holda mijoz boshqa joyga ketadi.",
};

const thinkAbout = (what: string): QA => ({
  q: "O'ylab ko'raman",
  a: `Albatta. Nimani o'ylab ko'rmoqchisiz — narxnimi, dizaynnimi yoki muddatnimi? Aytsangiz, hozir aniqlashtirib beraman. Xohlasangiz, ${what} maketini chizib yuboraman — ko'rib qaror qilasiz.`,
});

const cheaper = (what: string): QA => ({
  q: "Boshqa joyda arzon",
  a: `Bo'lishi mumkin. Narxni solishtirishda ${what} materiali, bosma sifati va muddatini ham solishtiring — arzon variant ko'pincha shularning hisobiga. Qaysi narxni aytishdi? Shartlarini aytsangiz, biz ham eng yaxshi variantni hisoblab beraman.`,
});

// ── lessons ─────────────────────────────────────────────────────────
export const LESSONS: Lesson[] = [
  {
    key: "paket",
    title: "Qog'oz paket",
    category: "Poligrafiya",
    emoji: "🛍️",
    match: ["paket"],
    audience: "Do'kon, butik, kafe, apteka, kiyim va kosmetika do'konlari, tadbirlar",
    about:
      "Logotipli qog'oz paket — mijoz do'kondan chiqqandan keyin ham ishlaydigan reklama. Odamlar yaxshi paketni uyda qayta ishlatadi, ko'chada ko'tarib yuradi — brend ko'p ko'rinadi.\n\nBiznes uchun paket «xarajat» emas, «reklama» ekanini tushuntiring. Kafe va do'konlar har oy paket oladi — bu doimiy mijoz bo'lishi mumkin.",
    kinds: [
      "Kraft (jigarrang) qog'oz — tabiiy ko'rinish, kafe va eko-brendlar uchun",
      "Oq qog'oz — rangli logotip yorqin chiqadi",
      "Laminatsiyali (glyanes yoki mat) — qimmatroq ko'rinadi, namlikka chidamliroq",
      "Ruchka: buralgan qog'oz, yassi qog'oz, lenta yoki shnur",
      "O'lcham: kichik (kosmetika, zargarlik), o'rta (kiyim), katta (oyoq kiyim, sovg'a)",
    ],
    priceNote: [
      "Tiraj — qancha ko'p bo'lsa, bittasi shuncha arzon",
      "Qog'oz turi va qalinligi",
      "Bosma ranglar soni va bosma maydoni (bir yoki ikki tomon)",
      "Laminatsiya va ruchka turi",
    ],
    ask: [
      "Paket nima uchun: do'kon, kafe yoki tadbir?",
      "Nechta va qachonga kerak?",
      "Qaysi o'lcham — ichiga nima solinadi?",
      "Logotip tayyormi? Rangli yoki bir rang?",
      "Ruchka qanaqa bo'lsin?",
    ],
    steps: [
      hello("Paket"),
      {
        title: "Ehtiyojni aniqlash",
        say: "Paket nima uchun kerak — do'kon, kafe yoki tadbir? Ichiga nima solinadi? Taxminan nechta va qachonga kerak?",
        note: "Mijoz ko'p gapirsin. Javoblarni yozib boring — taklif shularga qarab tuziladi.",
      },
      {
        title: "Tavsiya",
        say: "Sizning holatingizga kraft qog'oz, buralgan ruchka va logotip bir rangda eng to'g'ri keladi: chiroyli, tabiiy va narxi ham yaxshi. Kiyim do'koni bo'lsa — oq qog'oz, laminatsiya bilan yanada qimmatbaho ko'rinadi.",
      },
      {
        title: "Narx va muddat",
        say: "Bunday paket {tiraj} donadan boshlanadi, narxi tirajga qarab {narx}. Tayyor bo'lishi — {muddat}. Ko'proq olsangiz, donasi arzonroq tushadi.",
        note: "Narxni aytgandan keyin jim turing — mijozning javobini kuting.",
      },
      close("paket"),
      followUp,
    ],
    objections: [
      {
        q: "Qimmat ekan",
        a: "Tushunaman. Arzonroq variant ham bor: oddiy oq qog'oz, logotip bir rangda. Lekin o'ylab ko'ring: yaxshi paketni mijoz uyda ham ishlatadi — bu sizga har kuni bepul reklama. Tirajni oshirsangiz, donasi ham arzonlashadi.",
      },
      cheaper("paket"),
      thinkAbout("paket"),
      {
        q: "Namunani ko'rsam",
        a: "Albatta! Ofisimizda namunalar bor — Farg'ona, Universitet ko'chasi 22/4. Yoki hozir Telegram'ga oldin qilgan paketlarimiz rasmini tashlayman.",
      },
      {
        q: "Bizga kam kerak",
        a: "Kam tirajda bitta paket qimmatroq tushadi, chunki tayyorlash xarajati bir xil. Odatda 2–3 oylik ehtiyojni bir yo'la olish foydaliroq — bittasi arzonga tushadi. Qancha vaqtga yetadigan miqdor kerakligini hisoblab beraymi?",
      },
    ],
    faq: [
      { q: "Paket namlikka chidaydimi?", a: "Oddiy qog'oz namlikdan qo'rqadi. Kafe yoki ho'l mahsulot uchun laminatsiyali yoki ichki qatlamli variantni tavsiya qiling." },
      { q: "Logotipni ikki tomonga bosish mumkinmi?", a: "Ha, ikki tomonga ham, yon tomonlarga ham bosish mumkin. Narx bosma maydoniga qarab o'zgaradi." },
      { q: "Paketga necha kilogramm chidaydi?", a: "Qog'oz qalinligi va ruchkaga bog'liq. Og'ir narsa (oyoq kiyim, kitob) uchun qalinroq qog'oz va mustahkam ruchka taklif qiling." },
    ],
    upsell: "Paket bilan birga logotipli stiker, firma lentasi yoki vizitka taklif qiling — mijoz brendi bir xil ko'rinishda bo'ladi.",
    remember: [
      "Paketni «xarajat» emas, «reklama» deb taqdim eting",
      "Kafe uchun namlikdan himoyani albatta ayting",
      "Kafe va do'konlar paketni doimiy oladi — keyingi buyurtma vaqtini amoCRM'ga yozing",
    ],
    quiz: [
      { q: "Kafe uchun paket taklif qilganda nimani albatta aytish kerak?", options: ["Ruchka uzunligini", "Namlikdan himoya (laminatsiya yoki ichki qatlam)", "Faqat narxini", "Paket rangini"], correct: 1, why: "Oddiy qog'oz namlikdan qo'rqadi — kafe uchun himoyalangan variant kerak." },
      { q: "Nega ko'p tirajda bitta paket arzonroq?", options: ["Qog'oz arzonlashadi", "Tayyorlash xarajati ko'p donaga bo'linadi", "Chegirma majburiy", "Arzonlashmaydi"], correct: 1, why: "Bosmaga tayyorlash xarajati bir xil — ko'p donaga bo'linsa, bittasi arzon tushadi." },
      { q: "Mijoz «Qimmat ekan» desa, birinchi nima qilasiz?", options: ["Darhol chegirma beraman", "Arzonroq variantni va paket reklama ekanini tushuntiraman", "Gapni tugataman", "Boshqa mahsulot taklif qilaman"], correct: 1, why: "Avval qiymatni tushuntiring va arzonroq variant bering — chegirma oxirgi chora." },
      { q: "Ehtiyojni aniqlashda qaysi savol eng muhim?", options: ["Qayerda yashaysiz?", "Paket nima uchun va ichiga nima solinadi?", "Necha yoshdasiz?", "Qaysi rangni yoqtirasiz?"], correct: 1, why: "Maqsad va ichidagi narsa — o'lcham, qog'oz va ruchkani shu belgilaydi." },
      { q: "Maket yuborilgandan keyin nima qilish kerak?", options: ["Mijoz o'zi qo'ng'iroq qilishini kutish", "1 kun ichida qayta qo'ng'iroq qilish va amoCRM'ga zadacha qo'yish", "Yana bir maket yuborish", "Hech narsa"], correct: 1, why: "Qayta aloqa bo'lmasa, mijoz boshqa joyga ketadi." },
    ],
  },
  {
    key: "vizitka",
    title: "Vizitka",
    category: "Poligrafiya",
    emoji: "💳",
    match: ["vizitka"],
    audience: "Har bir biznes egasi, menejerlar, savdo agentlari, shifokorlar, ustalar",
    about:
      "Vizitka — eng ko'p so'raladigan va tez tayyor bo'ladigan mahsulot. Odatda yangi ochilgan biznes yoki yangi xodim uchun kerak bo'ladi.\n\nVizitka kichik buyurtma, lekin u eshikni ochadi: vizitka olgan mijozga keyin blank, paket, katalog va boshqa mahsulotlarni ham sotish mumkin.",
    kinds: [
      "Oddiy qalin qog'oz — eng ommabop",
      "Dizaynerlik qog'ozi (teksturali) — qimmatbaho ko'rinish",
      "Laminatsiya: mat yoki glyanes",
      "Bir yoki ikki tomonlama bosma",
      "Maxsus: burchaklari yumaloq, bo'rttirma, zarhal (folga)",
    ],
    priceNote: [
      "Tiraj (odatda 100 talik paketlarda)",
      "Qog'oz turi va laminatsiya",
      "Bir yoki ikki tomon",
      "Maxsus ishlov: folga, bo'rttirma, yumaloq burchak",
    ],
    ask: [
      "Nechta xodim uchun?",
      "Dizayn tayyormi yoki chizamizmi?",
      "Bir yoki ikki tomonlama?",
      "Qachonga kerak?",
      "Logotip va kontaktlar tayyormi?",
    ],
    steps: [
      hello("Vizitka"),
      { title: "Ehtiyojni aniqlash", say: "Vizitka kimlar uchun — o'zingizgami yoki bir nechta xodimgami? Dizayn tayyormi? Qachonga kerak?" },
      { title: "Tavsiya", say: "Ko'pchilik qalin qog'oz, mat laminatsiya, ikki tomonlama variantni tanlaydi — qo'lga yoqimli, uzoq saqlanadi. Ko'zga tashlansin desangiz — logotipni zarhal (folga) bilan qilamiz." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan boshlanadi. Tayyor bo'lishi — {muddat}. Bir nechta xodimga birga qilsak, maket va bosma bir yo'la — arzonroq." },
      close("vizitka"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Oddiy variantni hisoblab beraman — laminatsiyasiz, bir tomonlama. Lekin vizitka siz haqingizda birinchi taassurot: mijoz qo'lida yupqa qog'oz bilan qalin, chiroyli vizitka farq qiladi." },
      cheaper("vizitka"),
      thinkAbout("vizitka"),
      { q: "Dizaynim yo'q", a: "Muammo emas — dizaynerimiz chizib beradi. Logotip, ism, lavozim va telefonni yuboring, 1–2 variant tayyorlaymiz." },
    ],
    faq: [
      { q: "Vizitkada nimalar bo'lishi kerak?", a: "Logotip, ism-familiya, lavozim, telefon, Telegram yoki sayt, manzil. QR-kod qo'shish ham mumkin." },
      { q: "Har xodimga alohida vizitka qilsa bo'ladimi?", a: "Ha, bitta dizaynda faqat ism va telefon o'zgaradi — hammasi bir yo'la bosiladi." },
      { q: "QR-kod qo'shsa bo'ladimi?", a: "Ha — Telegram, Instagram yoki saytga olib boradigan QR-kod qo'shamiz." },
    ],
    upsell: "Vizitka olgan mijozga firma blankasi, logotipli paket yoki papka taklif qiling — «bir xil uslubdagi to'plam».",
    remember: [
      "Vizitka — kichik buyurtma, lekin katta mijozga eshik",
      "Bir nechta xodimga birga qilishni taklif qiling",
      "Imlo xatosiz bo'lishi uchun maketni mijozga albatta tasdiqlating",
    ],
    quiz: [
      { q: "Vizitka nima uchun muhim mahsulot?", options: ["Eng qimmat mahsulot", "Mijoz bilan birinchi aloqa, keyin boshqa mahsulot sotish mumkin", "Faqat tez tayyor bo'ladi", "Muhim emas"], correct: 1, why: "Vizitka olgan mijoz keyin blank, paket, katalog ham oladi." },
      { q: "Bosishdan oldin nima albatta qilinadi?", options: ["To'lovsiz bosiladi", "Mijoz maketni tasdiqlaydi", "Hech narsa", "Faqat logotip tekshiriladi"], correct: 1, why: "Telefon yoki ismdagi xato — butun tirajni qayta bosishga olib keladi." },
      { q: "Vizitkani qimmatbaho ko'rsatish uchun nima taklif qilasiz?", options: ["Yupqa qog'oz", "Mat laminatsiya, zarhal (folga) yoki teksturali qog'oz", "Qora-oq bosma", "Kichikroq o'lcham"], correct: 1, why: "Laminatsiya va maxsus ishlov vizitkani qimmatbaho qiladi." },
      { q: "Mijoz «Dizaynim yo'q» desa?", options: ["Buyurtmani olmaymiz", "Dizaynerimiz chizib beradi", "Boshqa joyga yuboramiz", "Shablonsiz bosamiz"], correct: 1, why: "Dizayn xizmatimiz bor — bu sotuvga yordam beradi." },
      { q: "Bir nechta xodimga vizitka kerak bo'lsa, nima taklif qilasiz?", options: ["Har biriga alohida buyurtma", "Bitta dizayn, hammasi bir yo'la — arzonroq", "Faqat rahbarga", "Keyinroq qilamiz"], correct: 1, why: "Bir yo'la bosish arzonroq va hammada bir xil uslub." },
    ],
  },
  {
    key: "flayer-buklet",
    title: "Flayer va buklet",
    category: "Poligrafiya",
    emoji: "📄",
    match: ["flayer", "buklet", "listovka"],
    audience: "Yangi ochilgan biznes, aksiya o'tkazayotgan do'konlar, o'quv markazlari, klinikalar, ko'rgazmalar",
    about:
      "Flayer — bir varaq reklama (aksiya, ochilish, chegirma). Buklet — buklangan varaq, xizmatlar haqida batafsilroq (2–3 bo'lak).\n\nAsosiy savol — mijoz ularni qanday tarqatadi: ko'chada, do'konda, ko'rgazmada yoki pochta qutilarida. Shundan o'lcham, qog'oz va tiraj chiqadi.",
    kinds: [
      "Flayer: A6, A5 yoki Evro (99×210 mm)",
      "Buklet: A4 ikki marta buklangan (3 bo'lak) — eng ommabop",
      "Qog'oz: ofset (yupqa, arzon) yoki melovan (silliq, yorqin)",
      "Bir yoki ikki tomonlama bosma",
    ],
    priceNote: ["Tiraj — eng katta ta'sir", "O'lcham va qog'oz turi", "Ikki tomonlama bosma", "Buklash va laminatsiya"],
    ask: ["Nima reklama qilinadi — aksiya, xizmat, ochilish?", "Qanday tarqatiladi?", "Nechta va qachonga?", "Matn va rasm tayyormi?", "Bir yoki ikki tomon?"],
    steps: [
      hello("Flayer"),
      { title: "Ehtiyojni aniqlash", say: "Flayerda nima reklama qilinadi va uni qanday tarqatasiz — ko'chada, do'konda yoki ko'rgazmada? Nechta kerak?" },
      { title: "Tavsiya", say: "Aksiya uchun A5 flayer, melovan qog'oz, ikki tomonlama — eng samarali: yorqin, ko'zga tashlanadi. Xizmatlaringiz ko'p bo'lsa — uch bo'lakli buklet, hammasi sig'adi." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Tiraj ko'paysa, donasi tez arzonlashadi — flayerda bu juda sezilarli." },
      close("flayer"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Ofset qog'ozda va bir tomonlama qilsak arzonroq tushadi. Yana bir yo'li — tirajni oshirish: flayerda donasi ancha arzonlashadi." },
      cheaper("flayer"),
      thinkAbout("flayer"),
      { q: "Flayer ishlamaydi", a: "To'g'ri qilinsa ishlaydi: aniq taklif (chegirma, sovg'a), katta sarlavha va QR-kod. Flayerga «shu flayer bilan 10% chegirma» yozsangiz, qancha mijoz kelganini ham sanaysiz." },
    ],
    faq: [
      { q: "Flayer va buklet farqi?", a: "Flayer — bitta varaq, qisqa taklif. Buklet — buklangan, ko'p ma'lumot sig'adi." },
      { q: "Matnni kim yozadi?", a: "Mijoz asosiy ma'lumotni beradi, dizaynerimiz chiroyli joylashtiradi." },
      { q: "QR-kod qo'shsa bo'ladimi?", a: "Ha — Telegram, Instagram yoki saytga. Bu flayer natijasini o'lchashga ham yordam beradi." },
    ],
    upsell: "Flayer bilan roll-up yoki banner taklif qiling — aksiya ko'chada ham, ichkarida ham ko'rinsin.",
    remember: ["Avval tarqatish usulini so'rang", "Flayerda bitta aniq taklif bo'lishi kerak", "Tiraj oshsa, donasi tez arzonlashadi"],
    quiz: [
      { q: "Flayer va bukletning asosiy farqi?", options: ["Rangi", "Flayer — bitta varaq, buklet — buklangan, ko'p ma'lumot", "Narxi bir xil", "Farqi yo'q"], correct: 1, why: "Buklet bo'laklarga buklanadi va ko'p ma'lumot sig'adi." },
      { q: "Flayer bo'yicha birinchi navbatda nimani so'raysiz?", options: ["Qog'oz rangini", "Nima reklama qilinadi va qanday tarqatiladi", "Mijozning yoshini", "Ofis manzilini"], correct: 1, why: "Maqsad va tarqatish usuli o'lcham, qog'oz va tirajni belgilaydi." },
      { q: "Flayer natijasini qanday o'lchash mumkin?", options: ["O'lchab bo'lmaydi", "Chegirma kodi yoki QR-kod bilan", "Faqat taxmin", "Ko'proq bosib"], correct: 1, why: "Kod yoki QR orqali qancha mijoz kelgani bilinadi." },
      { q: "Mijoz «Qimmat» desa, qaysi variant arzonroq?", options: ["Melovan, laminatsiyali", "Ofset qog'oz, bir tomonlama", "Kattaroq o'lcham", "Kamroq tiraj"], correct: 1, why: "Ofset qog'oz va bir tomonlama bosma arzonroq." },
      { q: "Flayer bilan birga nima taklif qilish mumkin?", options: ["Hech narsa", "Roll-up yoki banner", "Kepka", "Termos"], correct: 1, why: "Aksiya ichkarida ham, ko'chada ham ko'rinsin." },
    ],
  },
  {
    key: "katalog-papka",
    title: "Katalog va papka",
    category: "Poligrafiya",
    emoji: "📚",
    match: ["katalog", "papka", "jurnal", "brosh"],
    audience: "Ishlab chiqaruvchilar, distributorlar, mebel va qurilish kompaniyalari, o'quv markazlari, ko'rgazma ishtirokchilari",
    about:
      "Katalog — kompaniya mahsulotlarini rasmlar va narxlar bilan ko'rsatadigan kitobcha. Papka — hujjat va tijorat takliflarini chiroyli topshirish uchun logotipli jild.\n\nBu mahsulotlar B2B mijozlarga sotiladi: ular ko'proq sifat va muddatga e'tibor beradi. Qaror qabul qiluvchi odatda rahbar — u bilan gaplashishga harakat qiling.",
    kinds: [
      "Katalog: A4 yoki A5, 8 betdan bir necha o'n betgacha",
      "Muqova: qalinroq qog'oz, laminatsiya",
      "Tikish: skoba (yupqa), yelim (qalin), prujina",
      "Papka: qalin karton, cho'ntakli, vizitka uchun kesikli",
    ],
    priceNote: ["Betlar soni va tiraj", "Qog'oz va muqova turi", "Tikish usuli", "Dizayn hajmi (katalog dizayni alohida xizmat)"],
    ask: ["Katalogda nechta mahsulot bo'ladi?", "Rasm va matnlar tayyormi?", "Nechta nusxa, qachonga?", "Ko'rgazmaga kerakmi (muddat qat'iy)?", "Elektron (PDF) varianti ham kerakmi?"],
    steps: [
      hello("Katalog"),
      { title: "Ehtiyojni aniqlash", say: "Katalogda nechta mahsulot bo'ladi? Rasm va matnlar tayyormi? Qachonga kerak — ko'rgazmagami?" },
      { title: "Tavsiya", say: "Mahsulotingiz soniga qarab 16–24 betlik A4 katalog, laminatsiyali muqova bilan yaxshi chiqadi. Dizaynini ham o'zimiz qilamiz va PDF variantini Telegram'da tarqatish uchun beramiz." },
      { title: "Narx va muddat", say: "Narx betlar soni va tirajga bog'liq — {narx}. Tayyor bo'lishi {muddat}, dizayn bilan birga biroz ko'proq. Ko'rgazma sanasini ayting — muddatni shunga moslaymiz." },
      close("katalog"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Betlar sonini qisqartirish yoki yupqaroq qog'ozda qilish mumkin. Lekin katalog — sotuvchingiz: u mijoz stolida oylab turadi va har kuni siz uchun gapiradi." },
      cheaper("katalog"),
      thinkAbout("katalog"),
      { q: "PDF yetadi", a: "PDF — juda yaxshi, uni albatta beramiz. Lekin uchrashuvda yoki ko'rgazmada qo'lga berilgan chiroyli katalog jiddiy kompaniya taassurotini beradi va yo'qolmaydi." },
    ],
    faq: [
      { q: "Rasmlarni kim tayyorlaydi?", a: "Mijozning rasmlari bo'lsa — ishlatamiz; sifatini dizayner tekshiradi. Rasmlar kerak bo'lsa, buni oldindan kelishib oling." },
      { q: "Kam nusxa qilsa bo'ladimi?", a: "Bo'ladi, lekin bittasi qimmatroq tushadi. Optimal tirajni hisoblab bering." },
      { q: "Papkaga logotip qanday tushadi?", a: "To'liq rangli bosma yoki zarhal (folga). Ichida cho'ntak va vizitka uchun kesik qilish mumkin." },
    ],
    upsell: "Katalog bilan birga papka va vizitka taklif qiling — uchrashuvga to'liq «korporativ to'plam».",
    remember: ["B2B — qaror qiluvchi bilan gaplashing", "Ko'rgazma sanasini birinchi aniqlang", "PDF variantini qo'shimcha qiymat sifatida taklif qiling"],
    quiz: [
      { q: "Katalog buyurtmasida birinchi nimani aniqlaysiz?", options: ["Qog'oz rangini", "Mahsulotlar soni, materiallar tayyorligi va muddat", "Mijoz yoshini", "Hech narsa"], correct: 1, why: "Betlar soni va muddat narxni ham, ish rejasini ham belgilaydi." },
      { q: "Qalin katalog uchun qaysi tikish mos?", options: ["Skoba", "Yelim yoki prujina", "Tikilmaydi", "Stepler"], correct: 1, why: "Ko'p betli katalog skobada yaxshi turmaydi." },
      { q: "«PDF yetadi» desa, nima deysiz?", options: ["Rozi bo'lib gapni tugataman", "PDF ni ham beramiz, lekin bosma katalog uchrashuvda jiddiy taassurot beradi", "PDF yomon deyman", "Chegirma beraman"], correct: 1, why: "Ikkalasining foydasini ko'rsating, PDF ni qo'shimcha qilib bering." },
      { q: "Katalog mijozlari asosan kimlar?", options: ["Oddiy xaridorlar", "B2B — kompaniyalar", "Talabalar", "Turistlar"], correct: 1, why: "Katalogni kompaniyalar o'z mijozlariga beradi." },
      { q: "Katalog bilan nima qo'shib sotiladi?", options: ["Kepka", "Papka va vizitka", "Bakal", "Hech narsa"], correct: 1, why: "Uchrashuv uchun to'liq korporativ to'plam." },
    ],
  },
  {
    key: "kanselyariya",
    title: "Bloknot va ruchka",
    category: "Poligrafiya",
    emoji: "🖊️",
    match: ["blaknot", "bloknot", "ruchka", "daftar", "kundalik"],
    audience: "Kompaniyalar (xodim va mijozlar uchun), konferensiyalar, treninglar, banklar, o'quv markazlari",
    about:
      "Logotipli bloknot va ruchka — har kuni qo'lda bo'ladigan reklama. Konferensiya, trening, yangi xodimlar uchun to'plam yoki mijozlarga sovg'a sifatida olinadi.\n\nKo'pincha katta tirajda va sana bilan bog'liq (tadbir) — muddatni birinchi aniqlang.",
    kinds: [
      "Bloknot: A5 yoki A6, prujinali yoki yelimli",
      "Muqova: logotipli karton, eko-teri yoki qattiq muqova",
      "Ichki varaqlar: oq, katakli, chiziqli, logotipli",
      "Ruchka: plastik, metall yoki eko; logotip bosma yoki lazer",
    ],
    priceNote: ["Tiraj", "Muqova turi va varaqlar soni", "Ruchka materiali", "Logotip usuli (bosma, lazer, folga)"],
    ask: ["Kim uchun: xodimlar, mijozlar yoki tadbir?", "Nechta va qachonga (tadbir sanasi)?", "Bloknot o'lchami va muqovasi?", "Ruchka bilan to'plammi?", "Qutiga solinsinmi?"],
    steps: [
      hello("Bloknot"),
      { title: "Ehtiyojni aniqlash", say: "Bloknot kim uchun — xodimlarmi, mijozlarmi yoki tadbir ishtirokchilari? Nechta va qaysi sanaga kerak?" },
      { title: "Tavsiya", say: "Tadbir uchun A5 prujinali bloknot, logotipli muqova va logotipli ruchka — to'plam bo'lib eng yaxshi ko'rinadi. Muhim mijozlar uchun eko-teri muqovali variant bor." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Tadbir sanasini ayting — biroz oldinroq tayyorlaymiz." },
      close("bloknot"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Muqovani oddiy kartonda, ruchkani plastikda qilsak arzonlashadi. Lekin bloknot bir yil stolda turadi — har kuni brendingizni ko'rsatadi." },
      cheaper("bloknot"),
      thinkAbout("bloknot"),
      { q: "Tadbirgacha ulgurasizmi?", a: "Sanani ayting — hozir ishlab chiqarish bilan tekshirib, aniq javob beraman. Ulgurmasak, oldindan aytamiz — va'da berib kechikmaymiz." },
    ],
    faq: [
      { q: "Ichki varaqlarga ham logotip bo'ladimi?", a: "Ha, har varaqqa yoki faqat birinchi varaqqa logotip bosish mumkin." },
      { q: "Ruchkaga logotip qanchalik saqlanadi?", a: "Lazer gravyura o'chmaydi; bosma ham uzoq turadi, lekin vaqt o'tib xiralashishi mumkin." },
      { q: "To'plamni qutiga solsa bo'ladimi?", a: "Ha — Gift box bilan to'plam qilib beramiz." },
    ],
    upsell: "Bloknot + ruchka + logotipli paket yoki Gift box — tayyor sovg'a to'plami.",
    remember: ["Tadbir sanasini birinchi aniqlang", "To'plam qilib taklif qiling", "Muddatga ulgurmasak — oldindan aytamiz"],
    quiz: [
      { q: "Bloknot buyurtmasida birinchi nima muhim?", options: ["Rang", "Tadbir sanasi va soni", "Ruchka rangi", "Qog'oz hidi"], correct: 1, why: "Ko'pincha sana qat'iy — undan kech qolish mumkin emas." },
      { q: "O'chmaydigan logotip qaysi usulda?", options: ["Stiker", "Lazer gravyura", "Marker", "Muhr"], correct: 1, why: "Lazer materialning o'ziga yozadi." },
      { q: "Muhim mijozlarga qaysi muqovani taklif qilasiz?", options: ["Yupqa qog'oz", "Eko-teri yoki qattiq muqova", "Muqovasiz", "Gazeta qog'ozi"], correct: 1, why: "Qimmatbaho ko'rinish sovg'a uchun muhim." },
      { q: "Ulgurmasligimiz mumkin bo'lsa, nima qilasiz?", options: ["Va'da berib qo'yaman", "Oldindan rostini aytaman", "Indamayman", "Boshqa mahsulot sotaman"], correct: 1, why: "Kechikkan va'da mijozni yo'qotadi." },
      { q: "Bloknot bilan qanday to'plam qilinadi?", options: ["Bloknot + ruchka + quti/paket", "Bloknot + banner", "Bloknot + stend", "To'plam bo'lmaydi"], correct: 0, why: "Tayyor sovg'a to'plami o'rtacha chekni oshiradi." },
    ],
  },
  {
    key: "tipografiya",
    title: "Blank, konvert va yorliq",
    category: "Tipografiya",
    emoji: "✉️",
    match: ["blank", "konvert", "yorliq", "kartochka", "muqova", "etiketka", "stiker"],
    audience: "Kompaniya ofislari, ishlab chiqaruvchilar (mahsulot yorlig'i), do'konlar, davlat va xususiy tashkilotlar",
    about:
      "Firma blankasi va konvert — kompaniyaning rasmiy yuzi: shartnoma, xat va takliflar shu blankada chiqadi. Yorliq (etiketka) — mahsulotga yopishtiriladigan nom va ma'lumot.\n\nYorliq buyurtmalari ko'pincha takrorlanadi: ishlab chiqaruvchi har oy yorliq oladi. Bunday mijozni doimiy qilib olish — eng katta foyda.",
    kinds: [
      "Blank: A4, ofset qog'oz, logotip va rekvizitlar",
      "Konvert: Evro, A4, A5; logotip bosma",
      "Yorliq: qog'oz yoki plyonka, rulonda yoki varaqda, har xil shaklda kesilgan",
      "Kartochka va muqova: qalin qog'oz, laminatsiya",
    ],
    priceNote: ["Tiraj", "Material (qog'oz yoki plyonka)", "Ranglar soni", "Yorliq shakli va kesish"],
    ask: ["Blank yoki yorliq — nima uchun?", "Yorliq qaysi mahsulotga, qanday sharoitda (sovuq, nam)?", "O'lcham va shakl?", "Oyiga taxminan nechta kerak?", "Rekvizitlar va logotip tayyormi?"],
    steps: [
      hello("Blank va yorliq"),
      { title: "Ehtiyojni aniqlash", say: "Yorliq qaysi mahsulotga yopishtiriladi — idishga, qutiga, shishaga? Sovuqda yoki namda turadimi? Oyiga taxminan nechta kerak?" },
      { title: "Tavsiya", say: "Nam yoki sovuq joyda turadigan mahsulot uchun plyonka yorliq kerak — qog'oz ko'chib ketadi. Quruq qutiga qog'oz yorliq yetadi va arzonroq." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Har oy olsangiz, doimiy mijoz narxi va navbatsiz ishlab beramiz." },
      close("yorliq"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Qog'oz yorliq va kamroq rang bilan arzonlashtiramiz. Agar mahsulot namda tursa, arzon qog'oz yorliq ko'chib ketadi — keyin qayta qilish qimmatroq tushadi." },
      cheaper("yorliq"),
      thinkAbout("yorliq"),
      { q: "Printerda o'zimiz chiqaramiz", a: "Kam miqdorda — mumkin. Lekin bosmaxona yorlig'i rangi bir xil, o'chmaydi va mahsulotingiz do'kon peshtaxtasida professional ko'rinadi. Oylik miqdoringizni ayting — farqini hisoblab beraman." },
    ],
    faq: [
      { q: "Yorliq rulonda bo'ladimi?", a: "Ha, rulonda (mashinada yopishtirish uchun) yoki varaqda (qo'lda) bo'ladi." },
      { q: "Har xil shakldagi yorliq?", a: "Ha — dumaloq, oval, to'rtburchak yoki maxsus shaklda kesamiz." },
      { q: "Blankaga rekvizitlar kim yozadi?", a: "Mijoz rekvizitlarni beradi, biz joylashtiramiz va tasdiqlatamiz." },
    ],
    upsell: "Yorliq oluvchi ishlab chiqaruvchiga mahsulot qutisi (Gift box) va logotipli paket taklif qiling.",
    remember: ["Yorliq qanday sharoitda turishini so'rang", "Doimiy mijoz qilish — asosiy maqsad", "Rekvizitlarni albatta tasdiqlating"],
    quiz: [
      { q: "Muzlatgichdagi mahsulotga qaysi yorliq kerak?", options: ["Oddiy qog'oz", "Plyonka (namga chidamli)", "Karton", "Farqi yo'q"], correct: 1, why: "Namda qog'oz yorliq ko'chib ketadi." },
      { q: "Yorliq mijozining eng katta qiymati nimada?", options: ["Bir martalik katta buyurtma", "Har oy takrorlanadigan buyurtma", "Tez to'lov", "Hech narsa"], correct: 1, why: "Doimiy buyurtma — barqaror daromad." },
      { q: "Blankada nima albatta tekshiriladi?", options: ["Qog'oz hidi", "Rekvizitlar to'g'riligi", "Rang soni", "Konvert"], correct: 1, why: "Rekvizitdagi xato hujjatlarni yaroqsiz qiladi." },
      { q: "Mashinada yopishtiriladigan yorliq qanday bo'ladi?", options: ["Varaqda", "Rulonda", "Kartonda", "Qutida"], correct: 1, why: "Mashina rulondagi yorliq bilan ishlaydi." },
      { q: "«O'zimiz printerda chiqaramiz» desa?", options: ["Rozi bo'laman", "Sifat va oylik hisob farqini ko'rsataman", "Printer sotaman", "Gapni tugataman"], correct: 1, why: "Professional ko'rinish va doimiy sifatni tushuntiring." },
    ],
  },
  {
    key: "gift-box",
    title: "Gift box (sovg'a qutisi)",
    category: "Gift Box",
    emoji: "🎁",
    match: ["quti", "box", "gift"],
    audience: "Kompaniyalar (bayram sovg'alari: Navro'z, Yangi yil, 8-mart), premium brendlar, shirinlik va kosmetika ishlab chiqaruvchilar",
    about:
      "Gift box — mahsulot yoki sovg'a uchun logotipli quti. Ikki xil mijoz bor: bayram oldidan xodim va mijozlariga sovg'a qiladigan kompaniyalar, va mahsulotini qutida sotadigan brendlar.\n\nBayram oldidan talab keskin oshadi — mijozlarni oldindan (1–2 oy oldin) eslatib, buyurtmani erta oling.",
    kinds: [
      "Sovg'a qutisi — oddiy, logotipli",
      "Set quti — ichida bir nechta mahsulot uchun joylari (lojement)",
      "Brend quti — mahsulot qadoqlash uchun",
      "Premium quti — qattiq karton, magnitli qopqoq, folga, lenta",
    ],
    priceNote: ["Tiraj", "Karton turi (yupqa yoki qattiq)", "Ichki joylar (lojement)", "Ishlov: folga, laminatsiya, magnit, lenta"],
    ask: ["Qutiga nima solinadi (o'lcham)?", "Nechta va qaysi bayram/sanaga?", "Sovg'a uchunmi yoki mahsulot sotish uchun?", "Byudjet bir quti uchun taxminan qancha?", "Ichini ham to'ldirib beraylikmi?"],
    steps: [
      hello("Sovg'a qutisi"),
      { title: "Ehtiyojni aniqlash", say: "Qutiga nima solinadi va qaysi bayramga — Navro'zgami, Yangi yilgami? Nechta kerak va bir quti uchun taxminan qancha byudjet ajratgansiz?" },
      { title: "Tavsiya", say: "Kompaniya sovg'asi uchun qattiq kartonli, magnitli qopqoqli quti, logotip zarhal (folga) bilan — ochganda «voy» degan taassurot beradi. Ichiga bloknot, ruchka, bakal qo'shib, tayyor to'plam qilib beramiz." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Bayram oldidan navbat uzayadi — hozir buyurtma qilsangiz, vaqtida ulguramiz." },
      close("quti"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Yupqaroq kartonda, magnitsiz qilsak arzonlashadi. Lekin sovg'a qutisi — sovg'aning yarmi: chiroyli qutidagi oddiy sovg'a ham qimmatbaho ko'rinadi." },
      cheaper("quti"),
      thinkAbout("quti"),
      { q: "Bayramga hali vaqt bor", a: "To'g'ri, lekin bayram oldidan hamma bir vaqtda buyurtma qiladi va navbat uzayadi. Hozir maketni tasdiqlab qo'ysak, siz uchun joy band bo'ladi va shoshilinch narx ham bo'lmaydi." },
    ],
    faq: [
      { q: "Qutini ichi bilan to'ldirib berasizmi?", a: "Ha — bloknot, ruchka, bakal, termos va boshqa suvenirlar bilan tayyor to'plam qilamiz." },
      { q: "Kam miqdorda bo'ladimi?", a: "Bo'ladi, lekin bittasi qimmatroq. Premium quti qo'l mehnati ko'p — muddat ham uzunroq." },
      { q: "Namuna ko'rsa bo'ladimi?", a: "Ofisda namunalar bor; katta buyurtmada bitta sinov namunasini tasdiqqa tayyorlash mumkin." },
    ],
    upsell: "Quti ichiga suvenirlar (bakal, termos, bloknot) va ustiga logotipli paket — to'liq sovg'a to'plami.",
    remember: ["Bayramdan 1–2 oy oldin mijozlarga eslating", "Bir quti byudjetini so'rang — taklifni shunga quring", "Tayyor to'plam — eng foydali sotuv"],
    quiz: [
      { q: "Gift box buyurtmalarini qachon faol sotish kerak?", options: ["Bayram kuni", "Bayramdan 1–2 oy oldin", "Bayramdan keyin", "Farqi yo'q"], correct: 1, why: "Bayram oldidan navbat uzayadi — erta olingan buyurtma ulguradi." },
      { q: "Premium quti belgilari?", options: ["Yupqa qog'oz", "Qattiq karton, magnit, folga, lenta", "Plastik", "Gazeta"], correct: 1, why: "Bular qutini qimmatbaho qiladi." },
      { q: "Taklifni nimaga qarab quramiz?", options: ["O'zimiz xohlagan narxga", "Mijozning bir quti uchun byudjetiga", "Eng qimmatiga", "Eng arzoniga"], correct: 1, why: "Byudjetni bilsangiz, mos variant taklif qilasiz." },
      { q: "Eng foydali sotuv qaysi?", options: ["Bo'sh quti", "Ichi to'ldirilgan tayyor to'plam", "Faqat lenta", "Faqat paket"], correct: 1, why: "To'plam o'rtacha chekni ancha oshiradi." },
      { q: "«Hali vaqt bor» desa?", options: ["Kutamiz", "Navbat uzayishini aytib, maketni hozir tasdiqlashni taklif qilamiz", "Chegirma beramiz", "Unutamiz"], correct: 1, why: "Erta tasdiqlash joyni band qiladi." },
    ],
  },
  {
    key: "futbolka",
    title: "Futbolka va polo",
    category: "Textil",
    emoji: "👕",
    match: ["futbolka", "polo"],
    audience: "Kompaniya xodimlari, tadbirlar va marafonlar, sport jamoalari, maktab va o'quv markazlari, oilaviy bayramlar",
    about:
      "Logotipli futbolka — jamoani bir xil ko'rsatadi va tadbirda brendni ko'rinarli qiladi. Polo — ofis va xizmat ko'rsatish xodimlari uchun rasmiyroq variant.\n\nAsosiy savollar — o'lchamlar taqsimoti (XS–XXXL), rang va bosma usuli. O'lchamlarni ro'yxat qilib olishni unutmang — keyin xato bo'lmasin.",
    kinds: [
      "Futbolka: paxta yoki aralash mato, har xil rangda",
      "Polo: yoqali, rasmiyroq, ish kiyimi uchun",
      "DTF bosma — rangli, mayda detalli logotip uchun",
      "Shelkografiya — katta tirajda bir-ikki rangli logotip",
      "Vyshivka (tikib) — polo va kepkada qimmatbaho ko'rinish",
    ],
    priceNote: ["Mato sifati va zichligi", "Bosma usuli va bosma joylari soni", "Tiraj", "O'lchamlar (katta o'lchamlar qimmatroq bo'lishi mumkin)"],
    ask: ["Nechta va qanday o'lchamlarda (XS–XXXL)?", "Rang va mato?", "Logotip qayerga: ko'krak, orqa, yeng?", "Kundalik kiyishgami yoki bir martalik tadbirga?", "Qachonga kerak?"],
    steps: [
      hello("Futbolka"),
      { title: "Ehtiyojni aniqlash", say: "Futbolka kimlar uchun — xodimlarmi yoki tadbirgami? Nechta kerak va o'lchamlar qanday? Logotip qayerda bo'lsin — ko'krakda, orqada?" },
      { title: "Tavsiya", say: "Har kuni kiyiladigan bo'lsa, zich paxta mato va DTF bosma — rangli logotip yuvilganda ham saqlanadi. Ofis xodimlariga polo, logotip tikib (vyshivka) — ancha rasmiy ko'rinadi." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. O'lchamlar ro'yxatini tashlasangiz, aniq hisob qilaman." },
      close("futbolka"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Arzonroq mato yoki bitta bosma joyi bilan narxni tushiramiz. Lekin bir yuvishdan keyin cho'zilib ketgan futbolkani hech kim kiymaydi — yaxshi mato bir necha mavsum xizmat qiladi." },
      cheaper("futbolka"),
      thinkAbout("futbolka"),
      { q: "O'lchamlarni bilmayman", a: "Muammo emas — o'lchamlar jadvalini yuboraman, xodimlaringizdan yig'ib berasiz. Namuna o'lchamlarni ofisda kiyib ko'rish ham mumkin." },
      { q: "Bosma yuvilib ketadimi?", a: "Biz ishlatadigan DTF va shelkografiya to'g'ri yuvilsa (teskarisiga, 30–40°) uzoq saqlanadi. Parvarish qoidalarini ham yozib beramiz." },
    ],
    faq: [
      { q: "Har xil ismlarni yozsa bo'ladimi?", a: "Ha — jamoa yoki tadbir uchun har bir futbolkaga alohida ism yoki raqam bosamiz." },
      { q: "Kam miqdorda (5–10 ta) qilasizmi?", a: "DTF bosma bilan kam miqdorda ham qilish mumkin; bittasi qimmatroq tushadi." },
      { q: "O'z futbolkamizga bosasizmi?", a: "Mumkin, lekin mato sifati uchun javob bera olmaymiz — buni oldindan ayting." },
    ],
    upsell: "Futbolka bilan kepka, xudi yoki logotipli paket — to'liq jamoa formasi.",
    remember: ["O'lchamlar ro'yxatini yozma oling", "Har kuniga — sifatli mato tavsiya qiling", "Parvarish qoidalarini ayting"],
    quiz: [
      { q: "Rangli, mayda detalli logotip uchun qaysi bosma?", options: ["Shelkografiya", "DTF", "Muhr", "Marker"], correct: 1, why: "DTF rangli va mayda detallarni yaxshi chiqaradi." },
      { q: "O'lchamlar qanday olinadi?", options: ["Og'zaki", "Yozma ro'yxat qilib", "Taxminan", "Hammaga L"], correct: 1, why: "Yozma ro'yxat xatoni oldini oladi." },
      { q: "Ofis xodimlariga qaysi kiyim rasmiyroq?", options: ["Futbolka", "Polo", "Xudi", "Mayka"], correct: 1, why: "Polo yoqali va rasmiy ko'rinadi." },
      { q: "«Bosma yuvilib ketadimi?» desa?", options: ["Ha, ketadi", "To'g'ri parvarishda uzoq saqlanadi, qoidalarini beramiz", "Bilmayman", "Yuvmang deyman"], correct: 1, why: "Parvarish qoidalari bilan bosma uzoq turadi." },
      { q: "Futbolka bilan nima qo'shib sotiladi?", options: ["Banner", "Kepka yoki xudi", "Katalog", "Yorliq"], correct: 1, why: "To'liq jamoa formasi." },
    ],
  },
  {
    key: "xudi-kepka",
    title: "Xudi, svitshot va kepka",
    category: "Textil",
    emoji: "🧢",
    match: ["xudi", "svitshot", "kepka", "beysbolka", "panama"],
    audience: "Kompaniya xodimlari (kuz-qish), IT va yosh jamoalar, o'quv markazlari, brend merch, tadbirlar",
    about:
      "Xudi va svitshot — sovuq mavsumda jamoa kiyimi va brendning «merch»i. Odamlar sifatli xudini o'z xohishi bilan kiyib yuradi — bu uzoq muddatli reklama.\n\nKepka — yozgi tadbirlar, promo-aksiyalar va jamoa formasi uchun arzon va ommabop.",
    kinds: [
      "Xudi — kapyushonli; svitshot — kapyushonsiz",
      "Mato: futer (ichi yumshoq), qalinligi har xil",
      "Logotip: DTF, shelkografiya yoki vyshivka",
      "Kepka: paxta, logotip tikilgan yoki bosilgan",
    ],
    priceNote: ["Mato qalinligi va sifati", "Logotip usuli (vyshivka qimmatroq)", "Bosma joylari soni", "Tiraj"],
    ask: ["Qaysi mavsumga va kim uchun?", "Nechta, o'lchamlar?", "Rang?", "Logotip: bosma yoki tikilgan?", "Qachonga?"],
    steps: [
      hello("Xudi"),
      { title: "Ehtiyojni aniqlash", say: "Xudi kimlar uchun — xodimlargami yoki sotish uchun merchmi? Nechta, qanday o'lchamlarda va qachonga kerak?" },
      { title: "Tavsiya", say: "Kundalik kiyish uchun qalin, ichi yumshoq futer va ko'krakda tikilgan (vyshivka) logotip — sifatli ko'rinadi va yuvishda buzilmaydi. Orqasiga katta rangli bosma qo'shsa ham bo'ladi." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. O'lchamlarni yuborsangiz, aniq hisoblayman." },
      close("xudi"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Yupqaroq mato yoki tikish o'rniga bosma bilan arzonlashadi. Lekin sifatli xudini xodimlar o'zi xohlab kiyadi — yupqasi esa shkafda qoladi." },
      cheaper("xudi"),
      thinkAbout("xudi"),
      { q: "Kepka bilan to'plam bo'ladimi?", a: "Albatta — xudi, kepka va futbolka bir xil uslubda to'plam qilamiz, alohida olgandan arzonroq tushadi." },
    ],
    faq: [
      { q: "Vyshivka va bosma farqi?", a: "Vyshivka — ip bilan tikiladi, qimmatbaho va juda chidamli. Bosma — rangli, katta rasm uchun qulay." },
      { q: "Xudi kirishib qoladimi?", a: "Sifatli futer to'g'ri yuvilsa kirishmaydi. Parvarish qoidalarini beramiz." },
      { q: "Kepkaga ism yozsa bo'ladimi?", a: "Ha, har biriga alohida ism yoki raqam qilish mumkin." },
    ],
    upsell: "Xudi + kepka + futbolka to'plami yoki merch uchun logotipli paket.",
    remember: ["Mavsumni so'rang — kuzdan oldin xudi sotiladi", "Sifatli mato — «o'zi kiyadigan» reklama", "To'plam narxini taklif qiling"],
    quiz: [
      { q: "Xudi va svitshot farqi?", options: ["Rangi", "Xudida kapyushon bor", "Matosi", "Farqi yo'q"], correct: 1, why: "Xudi — kapyushonli, svitshot — kapyushonsiz." },
      { q: "Eng chidamli logotip usuli?", options: ["Stiker", "Vyshivka (tikish)", "Marker", "Qog'oz"], correct: 1, why: "Ip bilan tikilgan logotip yuvishda buzilmaydi." },
      { q: "Xudini qachon faol sotish kerak?", options: ["Yozda", "Kuz oldidan", "Faqat bahorda", "Farqi yo'q"], correct: 1, why: "Sovuq mavsumdan oldin talab oshadi." },
      { q: "«Qimmat» desa, qanday arzonlashtirasiz?", options: ["Sifatsiz qilib", "Yupqaroq mato yoki tikish o'rniga bosma", "Logotipsiz", "Bepul beraman"], correct: 1, why: "Variantni o'zgartirish orqali narx tushadi." },
      { q: "Nega sifatli xudi yaxshi reklama?", options: ["Arzon", "Odamlar uni o'zi xohlab kiyib yuradi", "Tez tayyor bo'ladi", "Rangli"], correct: 1, why: "Kiyiladigan merch uzoq muddat brendni ko'rsatadi." },
    ],
  },
  {
    key: "forma",
    title: "Forma va ish kiyimi",
    category: "Textil",
    emoji: "🦺",
    match: ["forma", "jilet", "fartuk", "kombinezon", "xalat"],
    audience: "Restoran va kafe, do'konlar, qurilish va ishlab chiqarish, klinikalar, sport jamoalari, maktablar",
    about:
      "Forma — xodimlar uchun bir xil ish kiyimi: kafe ofitsiantlari, do'kon sotuvchilari, ustalar, sport jamoasi. Jilet va fartuk — tez va arzon yechim.\n\nForma ko'pincha takroriy buyurtma: yangi xodim kelsa, yana olinadi. O'lchamlar va dizaynni saqlab qo'ying — keyingi safar tez qilamiz.",
    kinds: [
      "Sport forma — futbolka va shorti, raqam va ism bilan",
      "Jilet — signal (yorqin) yoki oddiy, logotipli",
      "Fartuk — kafe va oshxona uchun",
      "Ish kiyimi — chidamli mato, cho'ntaklar",
    ],
    priceNote: ["Mato va model", "Raqam/ism/logotip soni", "Tiraj", "Qo'shimcha: aks qaytaruvchi lenta, cho'ntaklar"],
    ask: ["Qaysi soha va qanday sharoitda kiyiladi?", "Nechta xodim, o'lchamlar?", "Logotip, ism, raqam kerakmi?", "Rang va model?", "Qachonga?"],
    steps: [
      hello("Forma"),
      { title: "Ehtiyojni aniqlash", say: "Forma qaysi xodimlar uchun va qanday sharoitda kiyiladi — oshxonada, ko'chada, sport zalda? Nechta va qanday o'lchamlarda?" },
      { title: "Tavsiya", say: "Kafe uchun polo va fartuk, logotip bilan — toza va bir xil ko'rinish. Ko'chada ishlaydiganlar uchun aks qaytaruvchi lentali jilet — xavfsiz va logotip ham ko'rinadi." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Dizaynni saqlab qo'yamiz — yangi xodim kelsa, tez qo'shib beramiz." },
      close("forma"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Avval eng kerakli qismini (masalan, faqat fartuk yoki jilet) qilib, keyin qo'shish mumkin. Bir xil formadagi xodimlar mijozga ishonch beradi — bu savdoga ta'sir qiladi." },
      cheaper("forma"),
      thinkAbout("forma"),
      { q: "Xodimlar tez almashadi", a: "Shuning uchun dizayn va o'lchamlarni saqlab qo'yamiz — yangi xodimga 1–2 donadan ham tez qilib beramiz." },
    ],
    faq: [
      { q: "Har biriga ism yozasizmi?", a: "Ha, ism, raqam yoki lavozimni har bir kiyimga alohida qilamiz." },
      { q: "Signal jilet talabga javob beradimi?", a: "Aks qaytaruvchi lentali jilet ko'chada ko'rinadi; maxsus standart kerak bo'lsa, oldindan aniqlashtiring." },
      { q: "Kam miqdorda qo'shimcha qilsa bo'ladimi?", a: "Ha, saqlangan dizayn bo'yicha keyin ham qo'shib beramiz." },
    ],
    upsell: "Forma bilan kepka, bejik (nom kartochkasi) va logotipli paket.",
    remember: ["Sharoitni so'rang — mato shunga qarab", "Dizayn va o'lchamlarni saqlang — takroriy buyurtma", "Ism/raqamlar ro'yxatini yozma oling"],
    quiz: [
      { q: "Ko'chada ishlovchilarga nima tavsiya qilasiz?", options: ["Oq futbolka", "Aks qaytaruvchi lentali jilet", "Xudi", "Fartuk"], correct: 1, why: "Xavfsizlik va logotip ko'rinishi." },
      { q: "Forma mijozini doimiy qilish uchun nima qilamiz?", options: ["Hech narsa", "Dizayn va o'lchamlarni saqlaymiz", "Narxni oshiramiz", "Har safar yangi dizayn"], correct: 1, why: "Yangi xodimga tez qo'shib beramiz." },
      { q: "Kafe uchun qulay to'plam?", options: ["Polo va fartuk", "Kombinezon", "Xudi", "Jilet"], correct: 0, why: "Toza va bir xil ko'rinish." },
      { q: "Ismlar ro'yxati qanday olinadi?", options: ["Og'zaki", "Yozma", "Taxmin", "Kerak emas"], correct: 1, why: "Yozma ro'yxat xatoni oldini oladi." },
      { q: "«Qimmat» desa?", options: ["Arzon matoga o'taman", "Eng kerakli qismidan boshlashni taklif qilaman", "Chegirma", "Gapni tugataman"], correct: 1, why: "Bosqichma-bosqich olish byudjetga mos." },
    ],
  },
  {
    key: "idish-suvenir",
    title: "Bakal va termos",
    category: "Suvenir",
    emoji: "☕",
    match: ["bakal", "krujka", "termos", "termokrujka", "stakan", "butilka"],
    audience: "Kompaniyalar (xodim va mijoz sovg'asi), kafe, bayram sovg'alari, o'quv markazlari, ko'rgazmalar",
    about:
      "Logotipli bakal va termos — har kuni ishlatiladigan sovg'a. Ofis stolida turgan bakal brendni har kuni eslatadi.\n\nBakal sotishda eng muhimi — sovg'a kimga va qaysi bayramga. Bayram oldidan Gift box bilan to'plam qilib sotish eng foydali.",
    kinds: [
      "Oq keramik bakal — sublimatsiya bilan rangli rasm",
      "Rangli yoki «xameleon» (issiq suvdan rangi o'zgaradigan) bakal",
      "Termos va termokrujka — metall, lazer gravyura bilan",
      "Shisha stakan va butilka",
    ],
    priceNote: ["Mahsulot turi (keramika, metall)", "Bosma usuli (sublimatsiya, lazer)", "Tiraj", "Quti/qadoq"],
    ask: ["Kimga sovg'a — xodim yoki mijoz?", "Qaysi bayram yoki tadbirga?", "Nechta va qachonga?", "Har biriga ism yozilsinmi?", "Qutiga solinsinmi?"],
    steps: [
      hello("Bakal"),
      { title: "Ehtiyojni aniqlash", say: "Bakal kimga sovg'a — xodimlargami yoki mijozlargami? Qaysi bayramga va nechta kerak?" },
      { title: "Tavsiya", say: "Xodimlarga har biriga ismi yozilgan bakal — juda yoqadi. Muhim mijozlarga logotip lazer bilan yozilgan termos, chiroyli qutida — qimmatbaho sovg'a." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Quti bilan birga to'plam qilsak, tayyor sovg'a bo'ladi." },
      close("bakal"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Oddiy oq bakal sublimatsiya bilan eng arzon variant. Lekin bakal bir necha yil stolda turadi — har kuni brendingizni ko'rsatadi; bir martalik reklamadan arzonroq tushadi." },
      cheaper("bakal"),
      thinkAbout("bakal"),
      { q: "Rasm o'chib ketmaydimi?", a: "Sublimatsiya bakal sirtiga singadi — qo'lda yuvilganda uzoq saqlanadi. Idish yuvish mashinasida tez-tez yuvilsa, vaqt o'tib xiralashishi mumkin — buni ayting. Lazer gravyura umuman o'chmaydi." },
    ],
    faq: [
      { q: "Har biriga ism yozsa bo'ladimi?", a: "Ha — har bir bakalga alohida ism yoki surat." },
      { q: "Kam miqdorda (1–5 ta) qilasizmi?", a: "Ha, sublimatsiya bilan kam miqdorda ham bo'ladi." },
      { q: "Termosga rangli rasm bo'ladimi?", a: "Metallga odatda lazer (bir rang) qilinadi; rangli rasm uchun maxsus qoplamali termos kerak." },
    ],
    upsell: "Bakal + Gift box + bloknot — tayyor bayram to'plami.",
    remember: ["Sovg'a kimga ekanini so'rang", "Ism yozish — sovg'ani shaxsiy qiladi", "Parvarish haqida rostini ayting"],
    quiz: [
      { q: "Oq keramik bakalga rangli rasm qanday tushiriladi?", options: ["Lazer", "Sublimatsiya", "Marker", "Stiker"], correct: 1, why: "Sublimatsiya bakal sirtiga singadi." },
      { q: "Metall termosga logotip odatda qanday?", options: ["Sublimatsiya", "Lazer gravyura", "Bo'yoq", "Qog'oz"], correct: 1, why: "Lazer metallga o'chmas qilib yozadi." },
      { q: "Xodimlarga bakalni qanday qilib maxsus qilish mumkin?", options: ["Har biriga ismini yozish", "Kattaroq qilish", "Qora rang", "Logotipsiz"], correct: 0, why: "Shaxsiy sovg'a ko'proq qadrlanadi." },
      { q: "Idish yuvish mashinasi haqida nima deysiz?", options: ["Hech narsa", "Tez-tez yuvilsa sublimatsiya xiralashishi mumkin", "Yuvib bo'lmaydi", "Rasm kuchayadi"], correct: 1, why: "Rostini aytish — ishonch." },
      { q: "Eng foydali bakal sotuvi?", options: ["Bitta bakal", "Gift box bilan bayram to'plami", "Bo'sh quti", "Faqat logotip"], correct: 1, why: "To'plam chekni oshiradi." },
    ],
  },
  {
    key: "mayda-suvenir",
    title: "Brelok, soat va stol bayrog'i",
    category: "Suvenir",
    emoji: "🔑",
    match: ["brelok", "soat", "bayroqcha", "stol bayrog", "znachok", "magnit", "medal"],
    audience: "Avtosalon, ko'chmas mulk, banklar, ko'rgazma ishtirokchilari, ofislar (stol bayrog'i), tadbirlar",
    about:
      "Kichik suvenirlar — katta tirajda arzon tarqatiladigan reklama: brelok kalit bilan doim yonda, devor soati ofisda yillab osilib turadi, stol bayrog'i esa rahbar stolida kompaniya maqomini ko'rsatadi.\n\nAvtosalon va uy sotuvchilarga brelok, ofislarga soat va bayroqcha — sohaga mos taklif qiling.",
    kinds: [
      "Brelok: metall (lazer), akril yoki teri",
      "Devor soati: logotipli siferblat",
      "Stol bayrog'i: tayoqcha va taglik bilan, bir yoki bir nechta bayroq",
      "Znachok va magnit",
    ],
    priceNote: ["Material", "Logotip usuli", "Tiraj — kichik suvenirlarda ta'siri katta", "Qadoq"],
    ask: ["Kimga tarqatiladi?", "Nechta va qachonga?", "Material va shakl?", "Logotip rangli yoki bir rang?", "Qadoq kerakmi?"],
    steps: [
      hello("Suvenir"),
      { title: "Ehtiyojni aniqlash", say: "Suvenirni kimga berasiz — mijozlargami, xodimlargami, ko'rgazmadami? Nechta kerak?" },
      { title: "Tavsiya", say: "Avtosalon yoki uy sotuvi uchun logotipli metall brelok — kalit bilan har kuni qo'lda bo'ladi. Ofisga logotipli devor soati yoki stol bayrog'i — kompaniya maqomini ko'rsatadi." },
      { title: "Narx va muddat", say: "Narxi {narx}, {tiraj} donadan. Tayyor bo'lishi {muddat}. Ko'p olsangiz, donasi sezilarli arzonlashadi." },
      close("suvenir"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Akril yoki oddiy material bilan arzonlashtiramiz. Kichik suvenirda tiraj juda muhim — ko'p olsangiz, donasi ancha arzon." },
      cheaper("suvenir"),
      thinkAbout("suvenir"),
      { q: "Bu kimga kerak?", a: "Mijoz kalitini olib, logotipingizni har kuni ko'radi — bu eng arzon «har kungi» reklama. Avtosalonlar shuning uchun har mashina bilan brelok beradi." },
    ],
    faq: [
      { q: "Brelokka har xil logotip bo'ladimi?", a: "Ha, lekin har bir dizayn alohida tayyorlanadi — narxga ta'sir qiladi." },
      { q: "Stol bayrog'iga ikki bayroq sig'adimi?", a: "Ha — kompaniya va davlat bayrog'i yonma-yon bo'lgan variant bor." },
      { q: "Soat mexanizmi kafolatlimi?", a: "Mexanizm turi va kafolatni buyurtma oldidan aniqlab ayting." },
    ],
    upsell: "Brelok + vizitka + paket — mijozga topshiriladigan to'plam.",
    remember: ["Sohaga mos suvenir taklif qiling", "Tiraj narxga katta ta'sir qiladi", "Kafolat va materialni aniq ayting"],
    quiz: [
      { q: "Avtosalonga qaysi suvenir mos?", options: ["Fartuk", "Logotipli brelok", "Katalog", "Banner"], correct: 1, why: "Kalit bilan har kuni qo'lda bo'ladi." },
      { q: "Kichik suvenirlarda narxga eng ko'p nima ta'sir qiladi?", options: ["Rang", "Tiraj", "Ofis", "Haftaning kuni"], correct: 1, why: "Ko'p tirajda donasi sezilarli arzon." },
      { q: "Stol bayrog'i kimlarga mos?", options: ["Talabalar", "Ofis va rahbarlar", "Kafe", "Sport jamoasi"], correct: 1, why: "Kompaniya maqomini ko'rsatadi." },
      { q: "«Bu kimga kerak?» desa?", options: ["Bilmayman", "Har kungi arzon reklama ekanini tushuntiraman", "Rozi bo'laman", "Narxni tushiraman"], correct: 1, why: "Foydani misol bilan ko'rsating." },
      { q: "Metall brelokka logotip qanday?", options: ["Lazer", "Qalam", "Stiker", "Bo'yoq"], correct: 0, why: "Lazer o'chmaydi." },
    ],
  },
  {
    key: "banner-rollup",
    title: "Banner, roll-up va stend",
    category: "Tashqi reklama",
    emoji: "🪧",
    match: ["banner", "roll", "stend", "bayroq", "baner", "x-banner", "plakat"],
    audience: "Do'konlar (aksiya), tadbir va konferensiyalar, ko'rgazmalar, qurilish obyektlari, o'quv markazlari",
    about:
      "Banner — katta bosma reklama (bino, panjara, ko'cha). Roll-up — yig'ma tik stend, tadbir va ko'rgazmalarga olib boriladi. Stend — ichkarida ma'lumot uchun.\n\nTez-tez «ertaga kerak» buyurtmalar keladi. Muddatni darhol aniqlang va ishlab chiqarish bilan tekshirib javob bering.",
    kinds: [
      "Banner: ko'cha uchun mustahkam material, ilgaklar (lyuversa) bilan",
      "Roll-up: alyumin konstruksiya, sumka bilan, bosmasi almashtiriladi",
      "X-banner — arzonroq yig'ma variant",
      "Stend va bayroq — ichki va tashqi",
    ],
    priceNote: ["O'lcham (kvadrat metr)", "Material va bosma sifati", "Konstruksiya (roll-up, X-banner)", "Montaj kerakmi"],
    ask: ["Qayerda turadi — ko'chada yoki ichkarida?", "O'lcham?", "Qachonga kerak?", "Dizayn tayyormi?", "O'rnatib berish kerakmi?"],
    steps: [
      hello("Banner"),
      { title: "Ehtiyojni aniqlash", say: "Banner qayerda turadi — ko'chadami yoki ichkaridami? O'lchami qancha va qachonga kerak?" },
      { title: "Tavsiya", say: "Tadbir va ko'rgazma uchun roll-up eng qulay: 1 daqiqada yig'iladi, sumkada olib yurasiz, keyingi aksiyada faqat bosmasini almashtirasiz. Ko'cha uchun mustahkam banner, chetlari ilgakli." },
      { title: "Narx va muddat", say: "Narxi {narx}. Tayyor bo'lishi {muddat}. Shoshilinch bo'lsa ayting — ishlab chiqarish bilan tekshirib, aniq vaqtini aytaman." },
      close("banner"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Roll-up o'rniga X-banner arzonroq. Lekin roll-up konstruksiyasi yillab xizmat qiladi — keyingi safar faqat bosmasini almashtirasiz, bu ancha arzon." },
      cheaper("banner"),
      thinkAbout("banner"),
      { q: "Ertaga kerak", a: "Hozir ishlab chiqarishdan so'rab, 10 daqiqada aniq javob beraman. Dizayn tayyor bo'lsa, tezlashtirish imkoni ko'proq." },
    ],
    faq: [
      { q: "Roll-up bosmasini almashtirsa bo'ladimi?", a: "Ha — konstruksiya qoladi, faqat yangi bosma olinadi." },
      { q: "Banner quyoshda rangi o'chadimi?", a: "Ko'cha bannerlari maxsus siyoh bilan bosiladi; uzoq vaqt quyoshda vaqt o'tib xiralashadi — bu odatiy holat." },
      { q: "O'rnatib berasizmi?", a: "O'rnatish xizmati haqida oldindan kelishib oling — narx alohida bo'lishi mumkin." },
    ],
    upsell: "Roll-up bilan flayer va stol bayrog'i — ko'rgazma uchun to'liq to'plam.",
    remember: ["Muddatni darhol aniqlang", "Roll-up konstruksiyasi qayta ishlatiladi", "Montajni oldindan kelishing"],
    quiz: [
      { q: "Ko'rgazmaga qaysi mahsulot eng qulay?", options: ["Katta banner", "Roll-up", "Peshlavha", "Hajmli harf"], correct: 1, why: "Yig'iladi, olib yuriladi, qayta ishlatiladi." },
      { q: "Roll-up arzonroq muqobili?", options: ["Hajmli harf", "X-banner", "Peshlavha", "Stend"], correct: 1, why: "X-banner — arzonroq yig'ma variant." },
      { q: "«Ertaga kerak» desa?", options: ["Ha, bo'ladi deyman", "Ishlab chiqarishdan so'rab aniq javob beraman", "Yo'q deyman", "Indamayman"], correct: 1, why: "Tekshirmasdan va'da bermang." },
      { q: "Banner narxi asosan nimaga bog'liq?", options: ["Rangi", "O'lchami (kv. metr) va materiali", "Haftaning kuni", "Mijoz yoshi"], correct: 1, why: "Kvadrat metr va material." },
      { q: "Roll-up afzalligi?", options: ["Bir martalik", "Bosmasi almashtiriladi, konstruksiya qoladi", "Juda og'ir", "Faqat ko'cha uchun"], correct: 1, why: "Keyingi aksiyada faqat bosma olinadi." },
    ],
  },
  {
    key: "peshlavha",
    title: "Peshlavha va hajmli harf",
    category: "Tashqi reklama",
    emoji: "🏪",
    match: ["peshlavha", "hajmli", "vyveska", "lightbox", "laytboks", "tablichka"],
    audience: "Yangi ochilayotgan do'kon, kafe, ofis, klinika, avtoservis, savdo markazidagi do'konlar",
    about:
      "Peshlavha — binodagi asosiy nom yozuvi; hajmli harflar (ko'pincha yorug'li) — eng ko'zga tashlanadigan tashqi reklama. Bu katta va uzoq muddatli buyurtma.\n\nBu yerda o'lchov, dizayn, ishlab chiqarish va montaj bor. Ko'pincha obyektga borib o'lchash kerak — buni uchrashuvga aylantiring.",
    kinds: [
      "Hajmli harflar: yorug'li (LED) yoki yorug'siz",
      "Laytboks — ichidan yoritiladigan quti",
      "Tablichka — kirish eshigi, kabinetlar uchun",
      "Material: akril, kompozit, metall",
    ],
    priceNote: ["Harflar balandligi va soni", "Yorug'lik (LED) bormi", "Material", "Montaj balandligi va murakkabligi"],
    ask: ["Obyekt qayerda, bino qanday?", "Yozuv matni va o'lchami?", "Kechasi yonib tursinmi?", "Ochilish sanasi?", "Ruxsatnomalar bilan masala hal qilinganmi?"],
    steps: [
      hello("Peshlavha"),
      { title: "Ehtiyojni aniqlash", say: "Peshlavha qaysi obyekt uchun — qayerda joylashgan? Yozuv qanday bo'ladi va ochilish qachon?" },
      { title: "Tavsiya", say: "Kechasi ham ko'rinishi uchun yorug'li hajmli harflar eng samarali — do'koningiz uzoqdan ko'rinadi. Aniq o'lchov uchun mutaxassisimiz obyektga borib o'lchaydi va dizayn variantini binoning rasmi ustida ko'rsatamiz." },
      { title: "Narx va muddat", say: "Narx o'lcham, yorug'lik va montajga bog'liq — o'lchovdan keyin aniq smeta beramiz. Taxminiy muddat {muddat}. Ochilish sanangizni ayting — shunga rejalashtiramiz." },
      { title: "Uchrashuv", say: "Obyektga o'lchovga qaysi kun borsak qulay — ertaga yoki indinga?", note: "Bu yerda yopish — o'lchov uchrashuvini belgilash. Sana va vaqtni amoCRM'ga yozing." },
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Yorug'siz harflar yoki laytboks arzonroq. Lekin peshlavha yillab turadi va har kuni yangi mijoz olib keladi — bu do'konning eng muhim reklamasi." },
      cheaper("peshlavha"),
      thinkAbout("peshlavha"),
      { q: "Ruxsatnoma kerakmi?", a: "Tashqi reklama uchun hokimiyat ruxsati kerak bo'lishi mumkin — bu masalani mijoz bilan oldindan aniqlang va qaysi hujjatlar kerakligini so'rang." },
    ],
    faq: [
      { q: "LED qancha xizmat qiladi?", a: "Sifatli LED uzoq xizmat qiladi; kafolat muddatini buyurtmada aniq yozing." },
      { q: "Montaj narxga kiradimi?", a: "Smetada alohida qator bo'ladi — oldindan ayting." },
      { q: "Dizaynni oldin ko'rsa bo'ladimi?", a: "Ha — binoning rasmi ustida qanday ko'rinishini ko'rsatamiz." },
    ],
    upsell: "Peshlavha bilan ichki tablichkalar, vizitka va ochilish uchun roll-up/flayer.",
    remember: ["Yopish = o'lchov uchrashuvini belgilash", "Ochilish sanasini birinchi so'rang", "Ruxsatnoma masalasini oldindan aniqlang"],
    quiz: [
      { q: "Peshlavha bo'yicha suhbatda «yopish» nima?", options: ["Darhol to'lov", "Obyektga o'lchov uchrashuvini belgilash", "Gapni tugatish", "Chegirma"], correct: 1, why: "Aniq narx o'lchovdan keyin chiqadi." },
      { q: "Kechasi ko'rinishi uchun nima tavsiya qilasiz?", options: ["Yorug'li hajmli harflar", "Qog'oz banner", "Flayer", "Stiker"], correct: 0, why: "LED harflar kechasi ham ko'rinadi." },
      { q: "Narx nimalarga bog'liq?", options: ["Faqat rangga", "O'lcham, yorug'lik, material, montaj", "Mijoz ismiga", "Haftaning kuniga"], correct: 1, why: "Bular smetani tashkil qiladi." },
      { q: "Qaysi hujjat masalasi bo'lishi mumkin?", options: ["Pasport", "Tashqi reklama ruxsatnomasi", "Diplom", "Hech qanday"], correct: 1, why: "Ruxsat kerak bo'lishi mumkin — oldindan aniqlang." },
      { q: "Dizaynni qanday ko'rsatamiz?", options: ["Og'zaki", "Binoning rasmi ustida", "Ko'rsatmaymiz", "Faqat narx"], correct: 1, why: "Mijoz natijani oldindan ko'radi." },
    ],
  },
  {
    key: "dizayn",
    title: "Dizayn xizmati",
    category: "Dizayn xizmati",
    emoji: "🎨",
    match: ["logo", "dizayn", "brendbuk", "maket"],
    audience: "Yangi biznes (logo kerak), rebrending qilayotganlar, katalog va banner buyurtmachilari",
    about:
      "Dizayn — ko'p buyurtmaning boshlanishi: logo yaratilsa, keyin vizitka, paket, peshlavha va kiyim kerak bo'ladi. Dizayn mijozini butun brendi bilan olishga harakat qiling.\n\nDizaynda eng muhimi — vazifani (texnik topshiriq) aniq yozish: soha, uslub, ranglar, yoqadigan namunalar. Shunda tuzatishlar kam bo'ladi.",
    kinds: [
      "Logo — bir necha variant, tanlangani bo'yicha tuzatish",
      "Fluer va banner dizayni",
      "Katalog dizayni — betlar bo'yicha",
      "Brend uslubi: ranglar, shriftlar, qo'llanish namunalari",
    ],
    priceNote: ["Ish hajmi (logo, katalog betlari)", "Variantlar va tuzatishlar soni", "Muddat (shoshilinch qimmatroq)", "Fayllar formati (bosma va raqamli)"],
    ask: ["Biznes nima bilan shug'ullanadi?", "Qanday uslub yoqadi — namunalar bormi?", "Ranglar bo'yicha istak?", "Qayerda ishlatiladi: bosma, Instagram, peshlavha?", "Qachonga kerak?"],
    steps: [
      hello("Dizayn"),
      { title: "Ehtiyojni aniqlash", say: "Biznesingiz nima bilan shug'ullanadi? Qanday uslub yoqadi — yoqqan logolar yoki namunalar bormi? Dizayn qayerlarda ishlatiladi?" },
      { title: "Tavsiya", say: "Logo bilan birga asosiy ranglar va shriftlarni ham belgilab beramiz — keyin vizitka, paket, Instagram hammasi bir xil uslubda bo'ladi. Bu brendni esda qoladigan qiladi." },
      { title: "Narx va muddat", say: "Narxi ish hajmiga qarab — {narx}. Muddati {muddat}. Bir nechta variant ko'rsatamiz, tanlaganingizni tuzatib, tayyor fayllarni beramiz." },
      close("dizayn"),
      followUp,
    ],
    objections: [
      { q: "Qimmat ekan", a: "Logo brendning yuzi — u yillab ishlatiladi va hamma mahsulotda turadi. Arzon chizilgan logo keyin qayta qilinadi — bu ikki baravar xarajat." },
      { q: "Tanishim tekin chizib beradi", a: "Yaxshi! Faqat bosma uchun to'g'ri formatda (vektor) bo'lishini tekshiring — aks holda paket va peshlavhada xira chiqadi. Biz bosmani bilgan holda chizamiz." },
      thinkAbout("logo"),
      { q: "Yoqmasa-chi?", a: "Shuning uchun boshida yoqadigan namunalarni so'raymiz va bir necha variant ko'rsatamiz. Tanlangan variantni kelishilgan miqdorda tuzatamiz." },
    ],
    faq: [
      { q: "Qanday fayllarni olaman?", a: "Bosma uchun vektor (AI/PDF/SVG) va internet uchun PNG/JPG." },
      { q: "Necha marta tuzatish mumkin?", a: "Tuzatishlar soni buyurtmada kelishiladi — buni oldindan aniq yozing." },
      { q: "Logo menga tegishli bo'ladimi?", a: "To'lov qilingach, tayyor logo mijozga tegishli; fayllar to'liq beriladi." },
    ],
    upsell: "Logodan keyin: vizitka, blank, paket, peshlavha — butun brend to'plami.",
    remember: ["Texnik topshiriqni yozma oling", "Yoqadigan namunalarni so'rang", "Logo — keyingi buyurtmalar eshigi"],
    quiz: [
      { q: "Dizayn buyurtmasida eng muhim narsa?", options: ["Tez qilish", "Aniq vazifa: soha, uslub, namunalar", "Arzon narx", "Ko'p rang"], correct: 1, why: "Aniq vazifa tuzatishlarni kamaytiradi." },
      { q: "Bosma uchun logo qaysi formatda?", options: ["JPG", "Vektor (AI, PDF, SVG)", "Skrinshot", "GIF"], correct: 1, why: "Vektor har qanday o'lchamda tiniq." },
      { q: "«Tanishim tekin chizadi» desa?", options: ["Rozi bo'laman", "Bosma uchun vektor formatni tekshirishni maslahat beraman", "Uni yomonlayman", "Narxni tushiraman"], correct: 1, why: "Hurmat bilan qiymatimizni ko'rsating." },
      { q: "Logodan keyin nima sotiladi?", options: ["Hech narsa", "Vizitka, blank, paket, peshlavha", "Faqat banner", "Termos"], correct: 1, why: "Logo — butun brend to'plamining boshlanishi." },
      { q: "Tuzatishlar soni qachon kelishiladi?", options: ["Hech qachon", "Buyurtma boshida", "Ish tugagach", "Kerak emas"], correct: 1, why: "Oldindan kelishilsa, nizo bo'lmaydi." },
    ],
  },
];

export const lessonByKey = (key: string): Lesson | undefined => LESSONS.find((l) => l.key === key);
