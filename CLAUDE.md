# Vodiy Print ERP — project memory

Vodiy Print is a print and branding shop in Fergana (polygraphy, typography,
textile, gift boxes, souvenirs). This repo is its ERP (printvodiy.uz), the
Node server with the Telegram bots and the amoCRM sync, and the deploy.
The user is the owner. They write in Uzbek (often in capitals, voice-typed).

## How to work with the owner

- **Always answer in Uzbek**, plainly, with no jargon. Write short reports:
  what changed, what was verified, what they must do.
- **Before a bigger feature, show it first.** Explain the plan, or make a
  mockup (HTML → PNG with Playwright, sent with SendUserFile). When they ask
  for a presentation, make a PDF deck in the brand style (skill `vp-deck`).
  Build only after they say «ha» / «boshla».
- Say plainly what was verified against real data and what is a mockup or
  sample numbers.
- Their priorities: sales control first; «kam AI bilan ko'proq natija»
  (simple tools that work, not AI for its own sake).
- **Standing request:** keep a list of what changed. At the end, make one
  presentation for the managers that covers all of it.

## Security rules (never break these)

- Never ask for, accept or print API keys, passwords or card details in
  chat. Secrets live only in GitHub Secrets and Variables.
- Customer personal data (names, phones, notes) must never reach GitHub
  Actions logs. Checks print aggregates only, or hashes.
- **Writing to the database needs the owner's approval first.** Read-only
  checks are fine.
- Personal-data imports go through the app's Excel import, not workflows.
- Do not connect to Firestore directly from this container.

## Repo map

- `src/` — React 18 + TypeScript + Vite + Tailwind; Firebase Auth and Firestore.
  - `src/modules/*` — one folder per page (routes in `src/App.tsx`, menu in
    `src/components/layout/nav.ts`):
    - Sotuv bo'limi (leads, incl. «Nazorat» / SalesControl),
    - Darslik, Buyurtmalar, Mijozlar, Mahsulotlar, Tijorat taklifi,
    - Ishlab chiqarish, Pechatnik, Textil, Ombor, Moliya,
    - Marja, KPI, Hisobot, AI Ofis, Davomat va KPI, Vazifalar.
  - `src/lib/*` — the logic, kept testable:
    - `salesKpi.ts`, `margin.ts`, `salesControl.ts`, `orderScope.ts`,
      `amoStats.ts`, `salesPeriod.ts`;
    - types in `types.ts`.
  - `src/lib/firestoreDb.ts` — every database call. `upsertOne` merges.
- `meta-webhook/` — the Node server on the VPS (`/opt/meta-webhook`, a
  systemd service). It holds the Telegram bots, the amoCRM sync, push, the
  KPI sums and the daily lists:
  - `amocrm.js` with `amoTasks.js`, `amoCalls.js`, `amoDeals.js` — amoCRM;
  - `salesKpi.js`, `bonus.js` — KPI sums and the bonus messages;
  - `recall.js` (old customers), `debts.js` (debts);
  - `assistant.js`, `staffbot.js`, `chief.js`, `marketing.js` — bots and agents;
  - `server.js` — the entry point.
  - Its `.env` is rewritten on every deploy from `.github/workflows/deploy.yml`.
- `functions/` — Firebase Cloud Functions (Node 22; Node 20 was retired on 2026-10-31).
- `firestore.rules` — the admin-only collections (costs, KPI, recall …).
- `tests/` — vitest, for both `src/lib` and `meta-webhook`.

## Commands

- `npx tsc --noEmit -p .` — typecheck.
- `npx vitest run` — all tests (about 180).
- `npm run build` — production build.
- Run `git checkout tsconfig.tsbuildinfo` before committing.
- Never commit `meta-webhook/package-lock.json`.
- To render-check a page with mock data, use the vite harness (skill `vp-mockup`).

## Git and deploy

- Develop on `claude/server-talabini-ayt-s48oig`, then:
  - `git push -u origin claude/server-talabini-ayt-s48oig`
  - `git push origin HEAD:main`
- No pull requests. No model names in commits or code.
- A push to `main` runs «Deploy to printvodiy.uz» with four jobs: test, deploy
  (site), deploy-meta-webhook (server) and deploy-functions (Firebase).
  Always watch it until it finishes (skill `vp-deploy`).
- Never use `pkill -f` with a pattern that matches its own command line:
  it kills the shell.

## Business facts (as of 2026-11-03 — re-check numbers with `vp-data`)

- **When data is reliable:**
  - the ERP is used for every order from **July 2026**;
  - December 2025–June 2026 were imported from Excel, so treat them as history;
  - **costs (tannarx) are typed only from September 2026**
    (`COST_TRACKING_FROM` in `src/lib/margin.ts`). Never compute margin
    from older months.
  - Margin: September 34.3%, October 34.6%.
- **Managers ("Managerlar" collection):** Muhammadiyor, Nuriddin, Muhammadali.
  - An order belongs to a manager **by `manager_name`**
    (`isManagersOrder` in `src/lib/orderScope.ts`: trimmed, lower-cased
    name). `manager_id` on orders is empty.
  - Maryam (21 orders) and Moxlaroy (14) appear on orders but are not in
    Managerlar.
  - 453 orders have an empty `manager_name` (old imports).
  - Dilmurodjon is the production manager, not a seller.
  - Staff links: Muhammaddiyor's and Nuriddin's accounts are linked to
    their Managerlar records. Maryam's account is linked to none. No staff
    account is linked to Muhammadali.
  - Monthly plans: Nuriddin 60 mln, Muhammadiyor 120 mln, Muhammadali
    8 mln (possibly a typo for 80).
  - The recall and debt bots go to `RECALL_MANAGERS`
    (deploy.yml, default "Muhammadiyor,Maryam,Nuriddin").
- **amoCRM** (read only, `AMO_SUBDOMAIN` / `AMO_TOKEN`):
  - Users: «Diyorbek» (13825110) is Muhammadiyor's account,
    Nuriddin (13825130), and «Menejer 2» (14021786) is Maryam's.
    Staff are linked to amoCRM users by `staff.amo_user_id`.
  - One pipeline «Воронка», with these stages in order:
    Неразобранное → Қабул Қилинди → маълумот берилди → Таклиф Юборилди →
    Дизайн/аванс → ишлаб чикариш → етказилди (won, 142) / Муваффақиятсиз (lost, 143).
  - October: 745 leads; 24 won in amoCRM against ~94 orders in the ERP.
  - 513 leads sit in Қабул Қилинди; no lead is in Таклиф.
  - No lost lead has a reason.
- **KPI:**
  - payout = sales × `sales_rate` (7.5%, always paid) + collected ×
    `collect_rate` (2%). The second part is paid only if attendance and
    amoCRM tasks are both ≥ 80%.
  - The server writes `kpi_sales/{YYYY-MM}_{managerId}` for every month that
    has data.
  - An approved month is frozen in `kpi_months.snapshot`. If its orders
    change later, the card shows «Qayta hisoblash»; `paid_before` keeps
    what was already paid.
  - In October the snapshots were stale (approved before the data was
    complete). Muhammadiyor's October has been recounted: approved, payout
    9 781 583, of which 1 148 183 was already paid. Nuriddin's and
    Muhammadali's October are still open.
- **Launch gates:** these went live on **2026-11-02**:
  - the recall lists (5 old customers per manager a day, oldest first);
  - the debt lists;
  - the deal alerts (10:00 and 15:00);
  - the missed-call buttons.
- **Products:**
  - 72 active products, all with price tiers.
  - The sales fields are almost empty: description 1/72, SPIN, sales
    notes, advantages and upsell 0/72.
  - Order lines are typed by hand, so there are 127 distinct names.
  - About 15–20 products bring about 2/3 of sales: paket, bloknot,
    futbolka, kepka, nimcha/bomber, bakal, ruchka, papka, flayer, gift box.

## Firestore collections

- **Orders and customers:** `orders`, `order_products`, `order_payments`,
  `order_status_history`, `order_costs` (admin), `customers`, `customer_notes`.
- **People:**
  - `staff` — doc id = email; holds `report_manager_id`, `amo_user_id`,
    `telegram_chat_id` and `permissions`;
  - `managers` — `monthly_plan` and the rates.
- **KPI:** `kpi_sales`, `kpi_months`, `kpi_settings/sales`.
- **amoCRM:** `amo_stats`, `amo_tasks`, `amo_calls`, `amo_meta/status`
  (users and stages), `amo_missed`.
- **Bots:** `recall_calls`, `recall_days`, `debt_calls`, `debt_days`.
- **Content:** `lessons` (Darslik overrides), `products`, `product_costs` (admin).
- **Audit of data fixes:** `data_fixes`.

## Read-only workflows (Actions → Run workflow; see skill `vp-data`)

- `snapshot.yml` — **start here**. One run gives everything as aggregates:
  sales, managers, kpi, debt, cost, amo, products, productfacts, guide.
- Narrower checks:
  - `kpi-check.yml`, `cost-coverage.yml`, `amo-stages.yml`, `product-check.yml`;
  - `business-stats.yml` — the long SWOT-style stats;
  - `check-import.yml` — modes no / yes / ref / near.
- Writers, run only with the owner's approval: `fix-order-totals.yml`,
  `fix-order-dates.yml`.

## Open items (as of 2026-11-03)

- **Sales funnel report («Voronka»):** the deck has been sent and waits for
  the owner's answers:
  - a call counts as «gaplashildi» from 30 s?
  - a lead → order window of 60 days?
  - a bot reminder about lost leads with no reason?
  - The owner should also make the loss reason required in amoCRM.
- **New-seller onboarding — built 2026-11-03** (Darslik → «Mahsulot
  qo'llanmasi», `/darslik/qollanma`):
  - `meta-webhook/guideFacts.js` writes `guide_facts/{family}` and `_meta`
    every 6 hours. There are 17 families; the top 10 are 89% of sales.
    Catalog images are inline data URLs, so they are never copied into docs.
  - Card texts come from the Darslik lessons, so edit them there.
  - The 5-day path lives in `lesson_progress/{email}.guide`; team results
    show it.
  - Next: a printable PDF guide; fill the catalog (24 products without a
    photo, 14 without a category, «Paket 8» twice); make choosing a catalog
    product required on order lines (258/324 lines since July are typed by hand).
- **The owner still has to:**
  - set the November plans on the KPI page;
  - approve October for Nuriddin and Muhammadali;
  - decide on Muhammadali's debts;
  - add Maryam and Moxlaroy to Managerlar if needed.
- **Still to build for sales control:** proposal tracking, weekly ranking, AI ROP.
