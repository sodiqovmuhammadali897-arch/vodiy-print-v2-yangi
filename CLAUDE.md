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
- **Two app channels (since 2026-11-04, the owner's request):**
  - A deploy reaches the owner's admin account at once: the app sets the
    cookie `vp_channel=next`, and nginx then serves `index-next.html`.
  - Everyone else gets the new version at 19:00 Tashkent, through a cron
    calling `/usr/local/bin/vodiyprint-promote`. A deploy between 19:00 and
    07:00 reaches everyone at once.
  - For an urgent fix, run the `promote.yml` workflow.
  - The server (bots) and the Firestore rules still go live at once for
    everyone, so keep them compatible with yesterday's app.

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
  - Loss reasons: managers fill the custom select field «Ёпилиш сабаби»
    (id 304899), not amoCRM's built-in loss reason (0 used). 2 082 of
    2 181 deals lost from July to 5 Nov have it: Алоқа йўқ 576, Хато рақам 477,
    Буюртма бекор бўлди 398, Нарх қиммат 343, Рақобатчи танланди 142,
    Қадриятимизга тушмади 77, Тахи 54. `lossOf` in `amocrm.js` reads both;
    `amo-loss.yml` counts them.
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
  (users and stages), `amo_missed`, `amo_funnel/{month}`,
  `amo_lost/{day}` (lost deals with reason, admin read).
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

- **Sales funnel («Voronka») — built 2026-11-04** (Sotuv bo'limi → Voronka):
  - `meta-webhook/amoFunnel.js` runs from the amoCRM sync every 30 minutes
    and writes `amo_funnel/{month}` (admin read). It uses stage history
    from amoCRM events since July 2026. «Talked» means a call of 30 s or
    more. An ERP order counts when the phone matches and it comes within
    60 days of the lead.
  - Calls are loaded only from the previous month, so «talked» and
    first-call speed are unknown for older months.
  - The 10:00 manager message lists deals lost in the last 3 days with
    no reason.
  - October, real: 745 leads → 571 talked → 34 reached info → 27 offer
    → 24 ERP orders matched → 24 paid. Of the 101 ERP orders in October,
    only 24 came from an October amoCRM lead; the rest are repeat
    customers, other channels or phone mismatches. 517 leads are stuck in
    the first stage.
  - Until 2026-11-05 the server read only the built-in loss reason, so the
    funnel and the 10:00 message wrongly said «no reason». Fixed: the
    reasons now show on the Voronka page («Nega yo'qotdik»).
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
- **AI ROP (test, 2026-11-04):** `meta-webhook/callReview.js` +
  `checks/callReviewRun.js`, run by hand from `call-review.yml`. It takes
  amoCRM calls (`amo_calls.record` = Mois Zvonki's recording link on the
  amoCRM note, downloadable without auth; ~270 of 505 calls in 3 days have
  one), transcribes them (OpenAI), scores them with Claude against the
  Darslik call order, writes `call_reviews/{amoCallId}` (admin only) and
  sends the admins a Telegram report. The server's ANTHROPIC_API_KEY was
  invalid (401) on 2026-11-04 — the owner must renew the GitHub Secret;
  `ai-check.yml` verifies it. `amo-records.yml` checks the recording links.
- **Yutqazilganlar — built 2026-11-05** (Sotuv bo'limi → Yutqazilganlar,
  `?v=yutqazilgan`): `meta-webhook/amoLost.js` writes `amo_lost/{day}`
  every 10 minutes (lost deals since July: reason, group, stage reached,
  sum, manager by staff name) and at 19:00 sends the admins the day's
  lost deals by reason and manager (`amo_meta/lost_daily`). Groups:
  price, competitor, no_answer, wrong_number, cancelled, other, none.
  The owner may want each manager to get their own list too (asked, not
  answered yet). «Тахи» meaning unknown — asked the owner.
- **Qarzdorlik filters — built 2026-11-05** (Moliya → Qarzdorlik,
  `DebtsPanel.tsx` + `src/lib/debts.ts`): period by order date (Hammasi,
  Hafta, Oy, O'tgan oy, Yil), four status groups (Yangi/dizayn, Ishlab
  chiqarilmoqda, Tayyor, Yetkazildi — pul yo'q, shown red), manager chips
  by `manager_name`, Excel export. Real on 2026-11-05: 119.0 mln / 42
  orders; delivered-unpaid 17.2 mln (8).
- **Moliya dashboard — built 2026-11-08** (Moliya page top,
  `src/modules/finance/dash/*`, logic in `src/lib/financeDash.ts`). From
  the owner's «ERP Moliya 2.0» PDF (45 pages, a full accounting TZ) only the
  parts that work with today's data were built:
  - KPI cards with ↑↓: Buyurtmalar (order date), Topshirilgan (first
    «Yetkazildi/Yopildi» in order_status_history), Tushgan pul (payment
    date), Yalpi foyda, Sof foyda («Dastlabki» while data is missing);
    «Bu oy» compares with the same days of last month (`compareSpan`);
  - Ma'lumot sifati (missing cost, no ijara/maosh/reklama/kommunal this
    month, «Naqd» share, customers without region);
  - month charts from July 2026, the savdo→foyda waterfall, breakdowns by
    viloyat / manba / mahsulot, debt aging, 30-day outlook, reklama CPL/CAC;
  - Doimiy xarajatlar: `expense_templates` (finance rules); «Kiritish»
    adds that month's expense with `template_id` — never automatic.
  - Not built: double-entry ledger, kassa/bank accounts, inventory
    valuation, payroll, branches, period close, the PDF's progressive KPI.
  - **Owner's decisions (2026-11-08):** one branch only (Farg'ona) — no
    branch/consolidation; no buxgalter — keep everything simple, one-click;
    sales are recognised **when the order is taken** (order date — as now;
    «Topshirilgan» is information only); **KPI stays** as it is
    (7.5% of sales + 2% of collected), no progressive scale.
- **Tushlik eslatmasi — built 2026-11-10** (`meta-webhook/lunch.js`, run by
  the HR agent in `hr.js`): at the general schedule's breakStart (the owner
  sets 12:00–13:00 on the Davomat page; the code default is 13:00–14:00)
  each person at work (checked in, not out, Telegram linked, not on leave
  or day off, not a holiday) gets «Ism, tushlik (abet) vaqti bo'ldi…»; at
  breakEnd «abet vaqti tugadi» with «✅ Ishxonadaman» (callback `ln:`,
  `lunch_breaks/{day}_{email}`, admin read); at breakEnd+15 the admins get
  who came back. `LUNCH_REMINDERS=off` turns it off.
- **Gift box narxi — built 2026-11-10, reworked the same day** (menu
  «Gift box narxi», `/giftbox`; logic in `src/lib/giftbox.ts`). A box is
  bought at the market (170–200k) and the logo is UV-printed on the items
  inside. **The manager types the box's name and market price and ticks the
  items** (owner: no admin-made types — «chalg'itadi»). Cost of one box =
  market price + Σ items × print price; price = cost + markup by quantity
  tier, rounded up to 1 000.
  - `giftbox_settings/main` (prints, tiers, round) is admin-only. Saving
    also writes `giftbox_prices/main` (per tier: box multiplier `k` and each
    item's sale-price part; `names`) — what managers read. The markup can
    still be worked out from price ÷ market price; told the owner.
    `giftbox_types` / `giftbox_costs` are the first version's, unused.
  - Order form: category «Gift Box» shows name, market price, items; the
    unit price follows the quantity and is read-only for managers (once the
    table exists); an admin's typed price sets `price_manual`. Lines keep
    `giftbox {name, box_cost, items}`.
  - Marja suggests a gift box line's cost from `box_cost` + prints.
  - Access: the owner, or staff given «Gift box narxi» in Xodimlar
    (permission `giftbox`: view = see costs, edit = save; `canGiftbox` in
    `rolePermissions.ts`, `giftboxPerm` in the rules). Never a manager
    account, even with role=admin.
  - Gift box taklifi (menu «Gift box taklifi» `/gift-box`, or Tijorat
    taklifi → «Gift box taklifi»; `GiftboxOfferEditor.tsx` +
    `GiftboxOfferPreview.tsx`): customer, box name, market price, items,
    quantity, «Tayyor bo'ladi» typed by hand, optional valid-until; the
    note writes itself (`offerNote`). Saved in `proposals` with `giftbox`;
    PNG/PDF like the proposal. No photo (owner: not needed).
- **Still to build for sales control:** weekly ranking.
  Proposal tracking was dropped by the owner on 2026-11-04: «tijorat
  taklifi shart emas».
