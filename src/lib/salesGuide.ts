// "Sotuvchi uchun": what a seller needs about one product — its features
// (written by the owner in the product's description), who buys it (from
// orders), why Vodiy Print (advantages) and the SPIN questions.
//
// A product without its own advantages or SPIN questions shows the
// suggestion of its kind below; editing saves the product's own text.

import type { Order, OrderProduct, Product } from "./types";

export type Spin = { s: string[]; p: string[]; i: string[]; n: string[] };
export const SPIN_KEYS = ["s", "p", "i", "n"] as const;
export const SPIN_LABELS: Record<keyof Spin, { letter: string; name: string; hint: string }> = {
  s: { letter: "S", name: "Vaziyat", hint: "Mijozning hozirgi holati" },
  p: { letter: "P", name: "Muammo", hint: "Nima bezovta qiladi" },
  i: { letter: "I", name: "Oqibat", hint: "Muammo qanchaga tushadi" },
  n: { letter: "N", name: "Foyda", hint: "Yechim nima beradi" },
};

type Kind = { key: string; name: string; match: string[]; usp: string[]; spin: Spin };

const norm = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`]/g, "'");

// Shared by every kind: what makes Vodiy Print different.
const OURS = {
  design: "Maketni o'zimiz chizamiz — mijozda dizayner bo'lmasa ham, 1 kunda tayyor.",
  quality: "Sifat nazorati: rang maket bilan solishtiriladi, nuqsonli dona qayta tayyorlanadi.",
  oneStop: "Hammasi bir joyda: paketdan futbolkagacha — bitta menejer, bitta hisob.",
};

export const KINDS: Kind[] = [
  {
    key: "paket",
    name: "Paket",
    match: ["paket"],
    usp: ["100 donadan boshlaymiz — kichik kafe yoki do'kon ham sinab ko'ra oladi.", OURS.design, "Tiraj oshgan sari donasi sezilarli arzonlashadi — 500 tada 100 talikdan ~40% arzon."],
    spin: {
      s: ["Hozir xaridni nimaga solib berasiz?", "Kuniga taxminan nechta xaridor keladi?", "Paket qachongacha kerak?"],
      p: ["Hozirgi paketning nimasi yoqmaydi — yirtiladimi, ko'rinishi oddiymi?", "Paketda nomingiz va manzilingiz bormi?"],
      i: ["Oyiga mingta xaridor nomingizni ko'rmay ketsa, qayta qanday topadi?", "Raqobatchi brendli paket bilan chiqsa, xaridor kimni eslab qoladi?"],
      n: ["Har paketda logotip va Telegram manzilingiz bo'lsa, qayta buyurtma oshadimi?", "Donasi bitta reklama e'lonidan arzon bo'lsa, foydalimi?"],
    },
  },
  {
    key: "flayer",
    name: "Flayer, liflet, buklet",
    match: ["flayer", "liflet", "buklet", "listovka"],
    usp: ["Katta tirajda donasi juda arzon — 10 000 tada 3 000 talikdan ~30% arzon.", OURS.design, "Aksiya muddatiga moslab tez chiqaramiz."],
    spin: {
      s: ["Flayerda nimani reklama qilasiz?", "Uni qanday tarqatasiz — ko'chada, do'konda, tadbirdami?", "Nechta kerak va qachongacha?"],
      p: ["Oldingi tarqatmalar qancha mijoz olib keldi?", "Matn va dizayn tayyormi yoki qiynalyapsizmi?"],
      i: ["Flayer ko'zga tashlanmasa, tarqatishga ketgan pul va vaqt behuda ketmaydimi?", "Aksiya boshlanib, flayer kech kelsa nima bo'ladi?"],
      n: ["Yorqin, ikki tomonlama flayer bo'lsa, aksiyangizga ko'proq odam keladimi?", "Flayerda QR-kod bo'lsa, kim kelganini sanay olasizmi — bu foydalimi?"],
    },
  },
  {
    key: "vizitka",
    name: "Vizitka",
    match: ["vizitka"],
    usp: ["Bir nechta xodimga bir yo'la — maket bitta, narx arzonroq.", "Zarhal (folga), mat laminatsiya — qo'lga olganda farqi seziladi.", OURS.design],
    spin: {
      s: ["Vizitka kim uchun — o'zingizgami, xodimlargami?", "Hozirgi vizitkangiz qanday?"],
      p: ["Hozirgisining nimasi yoqmaydi — yupqami, ma'lumoti eskirganmi?", "Uchrashuvda vizitka tugab qolgan holatlar bo'ladimi?"],
      i: ["Oddiy vizitka boshqalarnikiga o'xshasa, mijoz sizni eslab qoladimi?", "Muhim uchrashuvda vizitka bo'lmasa, kontakt yo'qolmaydimi?"],
      n: ["Qalin, mat va logotipi zarhal vizitka bo'lsa, birinchi taassurot qanday bo'ladi?", "Hamma xodimga bir xil uslubda bo'lsa, kompaniya jiddiyroq ko'rinadimi?"],
    },
  },
  {
    key: "katalog",
    name: "Katalog, papka",
    match: ["katalog", "papka", "broshyura", "jurnal"],
    usp: ["Dizayn, matn joylash va bosma — hammasi bir joyda.", "Ko'rgazma sanasiga moslab muddatni rejalashtiramiz.", OURS.quality],
    spin: {
      s: ["Katalogda nechta mahsulot bo'ladi?", "Rasm va matnlar tayyormi?", "Ko'rgazma yoki uchrashuv qachon?"],
      p: ["Mijozga mahsulotlaringizni hozir qanday ko'rsatasiz?", "Narx o'zgarsa, eski katalog nima bo'ladi?"],
      i: ["Uchrashuvda katalog bo'lmasa, mijoz qarorni kechiktirmaydimi?", "Ko'rgazmaga katalog kech kelsa, xarajat oqlanadimi?"],
      n: ["Chiroyli katalog va PDF versiyasi bo'lsa, menejerlaringizga sotish osonlashadimi?", "Papkada taklif bilan bersangiz, mijoz sizni jiddiyroq qabul qiladimi?"],
    },
  },
  {
    key: "bloknot",
    name: "Bloknot, kubarik",
    match: ["bloknot", "blaknot", "kubarik", "daftar", "kundalik", "ejednevnik"],
    usp: ["Logotipli muqova va ruchka bilan to'plam qilib beramiz.", "Eko-teri muqovali premium variant — muhim mijozlar uchun.", OURS.design],
    spin: {
      s: ["Bloknot kim uchun — xodimlar, mijozlar yoki tadbir ishtirokchilari?", "Nechta va qaysi sanaga kerak?"],
      p: ["Oldingi sovg'alaringizni mijozlar eslab qolishdimi?", "Tadbirda ishtirokchilarga nima tarqatyapsiz?"],
      i: ["Sovg'a bir haftada unutilsa, unga ketgan pul brendga ishlaydimi?"],
      n: ["Bloknot yil bo'yi stolda tursa, sizni har kuni eslashadimi?", "Ruchka bilan to'plam bo'lsa, sovg'a to'liqroq ko'rinadimi?"],
    },
  },
  {
    key: "ruchka",
    name: "Ruchka",
    match: ["ruchka", "qalam"],
    usp: ["Katta tirajda donasi arzon — tadbir va aksiyalar uchun qulay.", "Bloknot bilan to'plam qilib beramiz.", OURS.oneStop],
    spin: {
      s: ["Ruchka qayerda ishlatiladi — ofisda, tadbirda, mijozlarga sovg'agami?", "Nechta kerak?"],
      p: ["Hozir tarqatayotgan sovg'angizda nomingiz ko'rinadimi?"],
      i: ["Ruchka qo'ldan-qo'lga o'tadi — nomingiz bo'lmasa, bu reklama yo'qolmaydimi?"],
      n: ["Logotipli ruchka har kuni ishlatilsa, arzon reklama bo'ladimi?", "Bloknot bilan to'plam qilsak, sovg'a to'liqroq bo'ladimi?"],
    },
  },
  {
    key: "idish",
    name: "Krujka, bakal, termos",
    match: ["krujka", "bakal", "termos", "stakan", "chashka"],
    usp: ["Yuvilganda o'chmaydigan bosma.", "Sovg'a qutisiga joylab, tayyor to'plam qilamiz.", OURS.design],
    spin: {
      s: ["Kimga sovg'a qilmoqchisiz — xodimlarga, mijozlarga, hamkorlarga?", "Qaysi bayram yoki tadbir uchun?"],
      p: ["Oldingi sovg'alar ishlatildimi yoki tashlab yuborildimi?"],
      i: ["Sovg'a ishlatilmasa, unga ketgan pul hech narsa bermaydi — shundaymi?"],
      n: ["Krujka har kuni ishlatilsa, sizni har kuni eslashadimi?", "Qutiga joylab bersak, sovg'a qimmatroq ko'rinadimi?"],
    },
  },
  {
    key: "kiyim",
    name: "Futbolka va forma",
    match: ["futbolka", "polo", "xudi", "svitshot", "bomber", "forma", "nimcha", "finka", "kombo", "fartuk"],
    usp: ["Uch xil sifat: ekonom (AMINA), standart (STATUS), premium (BASICO) — byudjetga moslaymiz.", "O'lchamlar ro'yxati shabloni — XS dan XXXL gacha, chalkashmaydi.", "Tadbir sanasiga moslab, oldindan topshiramiz."],
    spin: {
      s: ["Kimlar uchun — xodimlar, o'quvchilar, tadbir ishtirokchilari?", "Nechta va qaysi o'lchamlar?", "Qaysi sanaga kerak?"],
      p: ["Oldingi formalar qanday bo'lgan — rang o'chganmi, o'lcham chalkashganmi, kech kelganmi?"],
      i: ["Tadbir kuni forma kelmasa yoki o'lchami to'g'ri kelmasa, nima bo'ladi?", "Rasmlarda jamoa har xil ko'rinsa, brendingizga qanday ta'sir qiladi?"],
      n: ["Har bir kishining o'lchamini ro'yxat bilan olib, oldindan topshirsak, sizga nima yengillik beradi?", "Bir xil formada jamoa qanday ko'rinadi?"],
    },
  },
  {
    key: "kepka",
    name: "Kepka",
    match: ["kepka", "panama", "shapka"],
    usp: ["Futbolka bilan to'plam (kombo) — bir xil rang va logotip.", "Kam tirajdan ham qilamiz.", OURS.design],
    spin: {
      s: ["Kepka kimlar uchun va qayerda kiyiladi?", "Nechta kerak?"],
      p: ["Jamoangiz tadbirda bir-biridan ajralib turadimi?"],
      i: ["Ochiq havoda tadbirda brendingiz ko'rinmasa, kim eslab qoladi?"],
      n: ["Futbolka va kepka bir xil bo'lsa, jamoa qanday ko'rinadi?"],
    },
  },
  {
    key: "beydjik",
    name: "Beydjik",
    match: ["beydjik", "bejik"],
    usp: ["Lenta va temir qisqich bilan tayyor holda beramiz.", "Har bir kishining ismi bilan — ro'yxatdan avtomatik.", OURS.design],
    spin: {
      s: ["Beydjik xodimlar uchunmi yoki tadbir ishtirokchilarigami?", "Nechta va ismlar ro'yxati tayyormi?"],
      p: ["Mijozlar xodimingizning ismini bilishadimi?", "Tadbirda kim kimligi aralashib ketadimi?"],
      i: ["Mijoz menejerning ismini bilmasa, qayta qanday murojaat qiladi?"],
      n: ["Har kimning ismi va lavozimi ko'rinsa, xizmat sifati qanday ko'rinadi?"],
    },
  },
  {
    key: "bayroq",
    name: "Bayroq, parus",
    match: ["bayroq", "parus", "vimpel", "flag"],
    usp: ["Ko'chada ham uzoq turadigan material.", "Shtativ va o'rnatish bilan to'liq beramiz.", OURS.design],
    spin: {
      s: ["Bayroq qayerda turadi — kirish oldidami, tadbirdami, ofisdami?", "Nechta va qaysi o'lchamda?"],
      p: ["Hozir sizni uzoqdan qanday topishadi?"],
      i: ["Tadbirda brendingiz ko'rinmasa, homiylik yoki ishtirok xarajati oqlanadimi?"],
      n: ["Kirishda baland bayroq tursa, odamlar sizni darrov topadimi?"],
    },
  },
  {
    key: "banner",
    name: "Banner, stend, harf",
    match: ["banner", "roll", "stend", "peshlavha", "harf", "xarf", "vyveska", "lightbox", "laytboks"],
    usp: ["O'lchab, chizib, o'rnatib beramiz — hammasi bitta joyda.", "Ko'chada uzoq turadigan material va bosma.", OURS.quality],
    spin: {
      s: ["Qayerga o'rnatiladi — bino, ichkari, tadbir?", "O'lchami taxminan qancha?"],
      p: ["Hozirgi yozuvingiz uzoqdan ko'rinadimi, kechasi-chi?"],
      i: ["O'tib ketayotgan odam sizni ko'rmasa, kuniga nechta mijoz yo'qoladi?"],
      n: ["Yorqin, kechasi ham ko'rinadigan peshlavha bo'lsa, kiruvchilar ko'payadimi?"],
    },
  },
  {
    key: "sovga",
    name: "Sovg'a qutisi va to'plam",
    match: ["gift", "sovg'a", "sovga", "quti", "set", "to'plam", "box"],
    usp: ["Ichini to'ldirib, tayyor sovg'a qilib beramiz: bloknot, ruchka, krujka, shokolad.", "Magnitli qopqoq, zarhal logotip — ochganda «voy» degan taassurot.", "Byudjetga qarab 3 variant: standart set, sovg'a qutisi, premium."],
    spin: {
      s: ["Kimga sovg'a qilasiz va nechta kishiga?", "Qaysi bayram uchun?", "Bir sovg'aga taxminan qancha ajratgansiz?"],
      p: ["O'tgan yili nima bergan edingiz? Eslab qolishdimi?"],
      i: ["Sovg'a bir haftada unutilsa, unga ketgan pul brendga ishlamaydi — shundaymi?", "Dekabrda navbat ko'p — kech qolsangiz nima bo'ladi?"],
      n: ["Sovg'a yil bo'yi stolda tursa, hamkorlar sizni qanchalik eslaydi?", "Tayyor qutini o'zimiz yetkazsak, sizga qancha vaqt tejaladi?"],
    },
  },
  {
    key: "suvenir",
    name: "Suvenir",
    match: ["soat", "kovrik", "brelok", "magnit", "fleshka", "usb", "sumka", "zontik"],
    usp: ["Har kuni ishlatiladigan narsa — reklama har kuni ko'rinadi.", "Sovg'a qutisiga joylab beramiz.", OURS.oneStop],
    spin: {
      s: ["Kimga va qaysi munosabat bilan beriladi?", "Nechta kerak?"],
      p: ["Oldingi sovg'alaringiz ishlatildimi?"],
      i: ["Ishlatilmaydigan sovg'a pulni behuda ketkazmaydimi?"],
      n: ["Har kuni ko'z oldida turadigan narsa bo'lsa, brendingiz esda qoladimi?"],
    },
  },
  {
    key: "yorliq",
    name: "Yorliq, blank, konvert",
    match: ["yorliq", "stiker", "etiketka", "blank", "konvert", "tipografiya"],
    usp: ["Har oy olsangiz — doimiy narx va navbatsiz.", "Nam va sovuqqa chidamli plyonka varianti bor.", OURS.design],
    spin: {
      s: ["Yorliq nimaga yopishtiriladi — quti, idish, shisha?", "Oyiga nechta kerak bo'ladi?"],
      p: ["Hozirgi yorliq ko'chib ketadimi, rangi o'chadimi?"],
      i: ["Mahsulotda yorliq ko'chsa, do'konda qanday ko'rinadi?"],
      n: ["Har oy kerakli vaqtda, bir xil sifatda kelsa, ishingiz osonlashadimi?"],
    },
  },
  {
    key: "dizayn",
    name: "Dizayn xizmati",
    match: ["dizayn", "maket", "logo"],
    usp: ["Dizayner bilan bevosita gaplashasiz — tez tuzatish.", "Dizaynni bosmaga tayyor holda beramiz — keyin ham ishlatasiz.", OURS.oneStop],
    spin: {
      s: ["Logotip va brend uslubingiz bormi?", "Dizayn nimaga kerak — paket, banner, ijtimoiy tarmoq?"],
      p: ["Hozirgi dizayn sizga yoqadimi? Har joyda bir xilmi?"],
      i: ["Har joyda har xil ko'rinsa, mijoz sizni taniy oladimi?"],
      n: ["Hamma narsangiz bir uslubda bo'lsa, brendingiz qanday ko'rinadi?"],
    },
  },
];

const DEFAULT_KIND: Kind = {
  key: "boshqa",
  name: "Mahsulot",
  match: [],
  usp: [OURS.design, OURS.quality, OURS.oneStop],
  spin: {
    s: ["Bu mahsulot nima uchun kerak?", "Nechta va qachongacha?"],
    p: ["Hozir buni qanday hal qilyapsiz? Nimasi yoqmaydi?"],
    i: ["Bu muammo sizga oyiga qanchaga tushadi?"],
    n: ["Muammo hal bo'lsa, sizga nima beradi?"],
  },
};

// The kind of a product by words in its name, then its category.
export const kindOf = (p: Pick<Product, "name" | "category">): Kind => {
  const name = norm(p.name);
  return KINDS.find((k) => k.match.some((m) => name.includes(m))) || KINDS.find((k) => k.match.some((m) => norm(p.category).includes(m))) || DEFAULT_KIND;
};

const filled = (spin?: Partial<Spin> | null) => Boolean(spin && SPIN_KEYS.some((k) => (spin[k] || []).length));

// The product's own SPIN questions and advantages, or its kind's suggestion.
export const guideFor = (p: Pick<Product, "name" | "category" | "advantages"> & { spin?: Partial<Spin> | null }) => {
  const kind = kindOf(p);
  const ownSpin = filled(p.spin);
  const spin: Spin = ownSpin ? { s: p.spin?.s || [], p: p.spin?.p || [], i: p.spin?.i || [], n: p.spin?.n || [] } : kind.spin;
  const ownUsp = (p.advantages || []).length > 0;
  return { kind, spin, spinSuggested: !ownSpin, usp: ownUsp ? p.advantages : kind.usp, uspSuggested: !ownUsp };
};

// ── who buys it ────────────────────────────────────────────────────
export type WhoBuys = {
  orders: number;
  customers: number;
  repeatCustomers: number; // bought it in two or more orders
  typicalQty: number | null; // median
  avgSum: number | null; // per order line
  months: number[]; // Jan..Dec, orders per calendar month
  top: { id: string; orders: number; sum: number }[]; // biggest customers
};

export const whoBuys = (lines: Pick<OrderProduct, "order_id" | "quantity" | "total">[], orders: Pick<Order, "id" | "customer_id" | "order_date" | "created_at" | "status">[]): WhoBuys => {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const months = Array(12).fill(0);
  const per = new Map<string, { orders: Set<string>; sum: number }>();
  const qty: number[] = [];
  let sum = 0;
  let n = 0;
  const seen = new Set<string>();
  for (const l of lines) {
    const o = byId.get(l.order_id);
    if (!o || o.status === "cancelled") continue;
    n++;
    qty.push(Number(l.quantity || 0));
    sum += Number(l.total || 0);
    if (!seen.has(o.id)) {
      seen.add(o.id);
      const d = String(o.order_date || o.created_at || "");
      if (d.length >= 7) months[Number(d.slice(5, 7)) - 1]++;
    }
    if (o.customer_id) {
      const c = per.get(o.customer_id) || { orders: new Set<string>(), sum: 0 };
      c.orders.add(o.id);
      c.sum += Number(l.total || 0);
      per.set(o.customer_id, c);
    }
  }
  qty.sort((a, b) => a - b);
  return {
    orders: seen.size,
    customers: per.size,
    repeatCustomers: [...per.values()].filter((c) => c.orders.size > 1).length,
    typicalQty: qty.length ? qty[Math.floor((qty.length - 1) / 2)] : null,
    avgSum: n ? Math.round(sum / n) : null,
    months,
    top: [...per.entries()]
      .map(([id, c]) => ({ id, orders: c.orders.size, sum: c.sum }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 5),
  };
};

// "Bir qatorga bitta" — text area lines → list, and back.
export const toLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
