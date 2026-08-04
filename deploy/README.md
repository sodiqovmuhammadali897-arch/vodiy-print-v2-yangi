# Deploy — printvodiy.uz

Bu loyihani `printvodiy.uz` domeniga avtomatik joylashtirish uchun
GitHub Actions workflow (`.github/workflows/deploy.yml`) tayyorlangan.
Har bir push (`main` yoki `claude/server-talabini-ayt-s48oig` branch'iga)
avtomatik build qiladi va serverga (`77.37.96.6`) yuklaydi.

## Ishga tushirishdan oldin: GitHub Secrets qo'shish

Repo sozlamalariga o'ting: **Settings → Secrets and variables → Actions →
New repository secret** va quyidagilarni qo'shing:

### Server ulanishi
| Nomi | Qiymati |
|---|---|
| `SERVER_HOST` | `77.37.96.6` |
| `SERVER_USER` | `vodiy` |
| `SERVER_PASSWORD` | SSH paroli |
| `SERVER_SUDO_PASSWORD` | sudo paroli |
| `LETSENCRYPT_EMAIL` | SSL sertifikat bildirishnomalari uchun email |

### Firebase konfiguratsiyasi (build vaqtida kerak)
| Nomi |
|---|
| `VITE_FIREBASE_API_KEY` |
| `VITE_FIREBASE_AUTH_DOMAIN` |
| `VITE_FIREBASE_PROJECT_ID` |
| `VITE_FIREBASE_STORAGE_BUCKET` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `VITE_FIREBASE_APP_ID` |
| `VITE_FIREBASE_MEASUREMENT_ID` (ixtiyoriy) |

Bu qiymatlarni Firebase Console → Project settings → Your apps →
SDK setup and configuration bo'limidan olasiz.

## Birinchi marta ishga tushirish

Secretlar qo'shilgandan so'ng workflow avtomatik ishga tushadi (push bilan),
yoki qo'lda: **Actions → Deploy to printvodiy.uz → Run workflow**.

Workflow quyidagilarni bajaradi:
1. Loyihani build qiladi (`npm run build`)
2. Serverga nginx va certbot o'rnatadi (agar yo'q bo'lsa)
3. `printvodiy.uz` uchun nginx sayt konfiguratsiyasini o'rnatadi
4. Let's Encrypt orqali SSL sertifikat oladi
5. Build natijasini (`dist/`) `/var/www/printvodiy.uz` ga yuklaydi

## Xavfsizlik bo'yicha eslatma

Server paroli oldin chatda ochiq matn sifatida yuborilgan edi. Deploy
ishga tushgach parolni albatta almashtiring va imkon qadar SSH-key
autentifikatsiyaga o'ting (parol orqali kirishni butunlay o'chirish
tavsiya etiladi).
