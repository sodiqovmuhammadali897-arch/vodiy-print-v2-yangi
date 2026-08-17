# Hikvision → Vodiy Print davomat sinxronizatsiyasi

Ofisdagi Hikvision yuz tanish terminalidan (masalan DS-K1T seriyasi) xodimlarning kelish/ketish vaqtini avtomatik o'qib, Vodiy Print'ning Davomat bo'limiga yozadigan skript. Doim yoniq turadigan ofis kompyuterida ishlaydi, Firebase Cloud Functions yoki billing'ga bog'liq emas.

## 1. O'rnatish

Kompyuterda [Node.js](https://nodejs.org) (18-versiyadan yuqori) o'rnatilgan bo'lishi kerak. Keyin:

```
cd hikvision-sync
npm install
cp config.example.json config.json
```

## 2. `config.json`'ni to'ldirish

- **`firebase`** — Vodiy Print'ning Firebase konfiguratsiyasi. Bu qiymatlar maxfiy emas (brauzerda ham ochiq turadi), Firebase Console → Project Settings → General → "Your apps" → veb ilova konfiguratsiyasidan olinadi (yoki loyihaning GitHub Actions sozlamalaridagi `VITE_FIREBASE_*` qiymatlari bilan bir xil).
- **`adminEmail` / `adminPassword`** — Vodiy Print'da admin huquqiga ega hisob (skript shu login bilan bazaga yozadi).
- **`deviceHost`** — terminalning lokal IP manzili (masalan `192.168.1.64`), terminal sozlamalaridan yoki router'dan ko'rish mumkin.
- **`deviceUsername` / `devicePassword`** — terminalning o'z admin login-paroli (terminal veb-panelida sozlanadi).
- **`employeeMap`** — terminaldagi xodim raqami (Employee No) → Vodiy Print'dagi shu xodimning email manzili. Terminalni sozlashda har bir xodimga berilgan raqamni shu yerga yozing.
- **`employeeMapByName`** — agar raqam bilan mos kelmasa, ism bo'yicha ham moslashtirilishi mumkin (ehtiyot chorasi sifatida).

## 3. Ishga tushirish

```
npm start
```

Ekranda `[+] Ism (email) keldi — HH:MM` va `[-] Ism (email) ketdi — HH:MM` ko'rinishida jonli log chiqib turadi. Buni to'xtatmasdan doim ishlab turishi kerak.

## 4. Kompyuter qayta yonganda avtomatik ishga tushishi

Windows'da eng oddiy yo'l — **Task Scheduler** orqali "kompyuter yonganda" `npm start` (yoki `node src/sync.js`) buyrug'ini ishga tushiradigan vazifa yaratish. Yoki [pm2](https://pm2.keymetrics.io/) kabi vosita bilan servis sifatida o'rnatish mumkin:

```
npm install -g pm2
pm2 start src/sync.js --name hikvision-sync
pm2 save
pm2 startup
```

## Eslatma

Terminal firmware'siga qarab ISAPI javobining aniq ko'rinishi biroz farq qilishi mumkin (masalan `attendanceStatus` maydoni har doim ham bo'lmasligi mumkin — bunday holda skript birinchi skanni "keldi", ikkinchisini "ketdi" deb hisoblaydi). Birinchi ishga tushirishda konsol logini kuzatib, kerak bo'lsa moslashtirish talab qilinishi mumkin.
