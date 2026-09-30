# Meta Lead Ads + Mois Zvonki webhooks

A tiny, standalone Node process that hosts two integrations and writes
straight into the app's Firestore collections — the same shapes the
Lidlar module reads:

- **Meta Lead Ads** — receives Instagram/Facebook Lead Ads submissions.
- **Mois Zvonki** — receives phone call events (incl. recordings) from
  the [Mois Zvonki](https://www.moizvonki.ru/) call-tracking app and
  logs them onto the matching lead's "Faoliyat" timeline (or, for an
  unmatched incoming call, auto-creates a new lead — a call should
  never go untracked, same rule as any other lead source).

It is deployed and kept running independently of the main frontend
(see `deploy/meta-webhook.service` and the `deploy-meta-webhook` job in
`.github/workflows/deploy.yml`), and does **not** require Firebase's
Blaze billing plan — it's a plain server using the Admin SDK, not a
Cloud Function.

## What it needs (GitHub repo secrets)

| Secret | Where to get it |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project settings → Service accounts → Generate new private key. (Same secret already used for the `deploy-functions` job — if it's set, this reuses it.) |
| `META_APP_SECRET` | Meta for Developers → your App → Settings → Basic → App Secret |
| `META_PAGE_ACCESS_TOKEN` | A long-lived Page access token for the Facebook Page the lead forms belong to (Graph API Explorer, or a System User token from Business Manager — System User is recommended since it doesn't expire) |
| `META_VERIFY_TOKEN` | Any string you make up yourself — you'll type the same value into Meta's webhook setup screen |

Until all four are set, the `deploy-meta-webhook` job skips itself
(same pattern as `deploy-functions`) — nothing breaks, the webhook
just isn't live yet.

Separately, for the Mois Zvonki call integration (optional — the Meta
side works without these):

| Secret | Where to get it |
|---|---|
| `MOIZVONKI_DOMAIN` | Mois Zvonki dashboard → Настройки → Интеграция → "Ваш адрес API" (e.g. `vodiyprint.moizvonki.ru`, without `https://`) |
| `MOIZVONKI_USER_EMAIL` | The login email of a Mois Zvonki **Administrator** account (subscribing to webhooks requires admin rights) |
| `MOIZVONKI_API_KEY` | Same page → "Ваш ключ API" |
| `MOIZVONKI_WEBHOOK_TOKEN` | Any string you make up yourself — appended as `?token=...` on the callback URL, since Mois Zvonki (unlike Meta) doesn't sign its webhook requests |

Once all four `MOIZVONKI_*` secrets are set, the server self-subscribes
to Mois Zvonki's `call.finish` webhook on every boot/restart (safe to
repeat — re-subscribing just replaces the handler URL) — no manual step
needed on the Mois Zvonki side beyond having those credentials.

## Setting it up on Meta's side, once the secrets are in place

1. [developers.facebook.com](https://developers.facebook.com) → Create App → type **Business**.
2. Add the **Webhooks** and **Lead Ads** products to the app.
3. Connect the Facebook Page the ads run on (and its linked Instagram
   account, for Instagram Target ads).
4. Webhooks → Page → Subscribe, with:
   - Callback URL: `https://printvodiy.uz/webhooks/meta-leads`
   - Verify token: the same value you put in the `META_VERIFY_TOKEN` secret
   - Subscribed field: `leadgen`
5. Subscribe the Page itself to the app's webhook (Page → Webhooks →
   your app), and pick the Lead Ads form(s) you want flowing in.

From then on, every new Lead Ads submission appears in **Lidlar → Kanban**
within seconds, tagged with its real campaign/ad set/ad/form names.

## Local testing

```
cd meta-webhook
npm install
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
META_VERIFY_TOKEN=test META_APP_SECRET=... META_PAGE_ACCESS_TOKEN=... \
npm start
```

## Hisobchi — Telegram Q&A bot (`assistant.js`)

Answers questions typed into the report channel ("Kans Printga qancha
qarzimiz bor?", "bizdan qancha qarzdorlik bor?") using Claude with
read-only Firestore tools (receivables, supplier balances, cash flow,
orders, leads, warehouse). On every start it registers
`https://printvodiy.uz/webhooks/telegram` with Telegram (fresh secret
token each time) and only answers chats listed in `ASSISTANT_CHAT_IDS`.

Needs `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY` and `ASSISTANT_CHAT_IDS`
(defaults to the IT report channel); stays off until all are set.
`ASSISTANT_MODEL` optionally overrides the Claude model.

It can also make changes (`actions.js`): order status, customer payments,
expenses / supplier payments, supplier invoices and warehouse in/out.
Claude only *proposes* them — each is stored as a pending `bot_actions`
record and posted with ✅/❌ buttons; it runs only when a current
administrator of that chat taps ✅, within 30 minutes, using the same
rules as the web app (payment recalculates the order's debt, an order
with debt can't be closed, stock can't go negative). Nothing can be
deleted. `bot_actions` is also the audit log (who confirmed, when,
result).

### AI Ofis feed and website commands

Every question, answer, proposal and confirmed action is also written to
`agent_events` (the daily report agents add theirs, and keep
`agent_status/{agent}` with their alert flag). The AI Ofis page
(`src/modules/aioffice`) listens to both and animates them in a 3D office.

The page can also talk to the bot: `POST /webhooks/assistant {text}` and
`POST /webhooks/assistant/confirm {id, ok}`, authenticated with the
caller's Firebase ID token (`Authorization: Bearer …`) and allowed only
for staff with role `admin`. Website questions are posted to the Telegram
channel too, and a confirmation made on either side updates the other.

## HR agent (`hr.js`)

Runs inside this service (same bot token):
- at work start + 5 min, every staff member with
  `attendance_notify !== false` and a phone or a linked Telegram who
  hasn't checked in gets a reminder. The start time comes from their own
  `work_schedules/{email}` (`workStart`, `workEnd`, `offDays` 0 = Sunday)
  or the general `work_schedules/default` (09:05 by default). It skips
  their days off, `holidays` and approved `leave_requests`. Each start
  time is claimed once per day in `hr_runs/{date}_{HHMM}`, so restarts
  never double-send;
- a fresh late check-in (`attendance.lateMinutes > 0`) gets one notice,
  claimed via `attendance.lateNotifiedAt`.

Delivery: the employee's Telegram when linked (free), otherwise SMS via
Eskiz.uz. Every message is logged in `hr_notifications`. Employees link
Telegram from Davomat → "Telegram'ga ulash" (`POST /webhooks/hr/link`
returns a one-time `t.me/<bot>?start=<code>` link; the bot stores their
chat id on their staff record).

Env: `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, optional `ESKIZ_FROM` (default
`4546`). Without them the agent sends Telegram only. Eskiz delivers only
texts matching templates approved in its cabinet — submit these two:

    Hurmatli %w, ish kuni soat %w da boshlandi. Siz hali ishga kelganingizni belgilamadingiz. Vodiy Print
    Hurmatli %w, bugun ishga %w kech qoldingiz (kelgan vaqtingiz %w). Iltimos, vaqtida keling. Vodiy Print

### Price sheets: PDF, PNG or text (`pdf.js`, `png.js`)

"Paket 45 narxini PDF / rasm / matn qilib ber" → the `product_price_sheet` tool finds
the product (by code, e.g. `45`, or name), renders the customer-facing
price sheet (same content as the website's mijoz narx varag'i: price
tiers, specs, contacts, 30-day validity — never cost or supplier data)
with pdfkit and the bundled DejaVu fonts (Latin + Cyrillic), and the bot
posts it to the channel as a document. An optional quantity adds a
"N dona uchun jami" box.

## Work group with Topics (`groups.js`)

Instead of one channel, agents post to their own topic in a Telegram
group with Topics enabled. Linking (Sozlamalar → Telegram guruh) gives an
admin a one-time `/ulash CODE` (30 min); posted in the group, the bot
checks Topics are on and it is an admin with "Manage topics", creates the
topics (Hisobchi, IT, Sotuv, Moliya, Ishlab chiqarish, Ombor / Ta'minot,
HR / Davomat) and saves `telegram_config/main`. Adding the bot to any
other group does nothing without a code.

After linking: daily reports go to their agent's topic, HR messages and
check-in/out selfies to HR / Davomat, website questions to Hisobchi. The
Hisobchi answers everything in its own topic and elsewhere only when
@mentioned or replied to, answering in the same topic. Before linking
everything keeps going to the channel.
The format follows the request: `pdf` (document), `png` (drawn with
@napi-rs/canvas at 2x, sent as a photo) or `text` (written into the reply).

## Instagram Direct agent (`instagram.js`)

Answers people who write to the business Instagram's Direct — or comment
under a post (a one-time private reply) — asking for their name and phone.
When a phone number arrives it creates a lead in Sotuv bo'limi (source
"Instagram Direct" / "Instagram izoh"; an existing lead with the same phone
just gets an activity), thanks the person and posts to the
"📸 Instagram Direct" topic of the work group (the topic is created on
start if the group is already linked).

- At most three messages per person: greeting → one reminder → thank you.
  After that further messages are only forwarded to Telegram.
- When a manager replies from Instagram themselves (an echo we didn't
  send), the agent leaves that chat for good; a phone number left there is
  still saved as a lead, silently.
- Texts and the on/off switches live in `instagram_config/main`
  (Sozlamalar → Instagram Direct); empty text = the default in
  `DEFAULT_TEXTS`. Chats are in `ig_conversations/{igsid}`.
- Webhooks come to the same `/webhooks/meta-leads` callback (object
  `instagram`). On start the service subscribes the app to the `instagram`
  object (`messages`, `comments`) through the Graph API using
  `META_APP_SECRET`, so nothing has to be clicked in the dashboard.
- `GET /webhooks/instagram/status` (admin) reports the Page, the linked
  Instagram account, missing token permissions and the webhook
  subscription; `POST` re-runs the subscription first.

Needs, besides the Lead Ads setup: the Instagram professional account
linked to the Facebook Page, "Allow access to messages" turned on in the
Instagram app, and a Page token with `instagram_basic`,
`instagram_manage_messages`, `instagram_manage_comments`,
`pages_manage_metadata` in `META_PAGE_ACCESS_TOKEN`.

## Marketolog agent (`marketing.js`)

Every Monday 09:00 (Tashkent) posts the weekly marketing report to the
"📣 Marketing" topic (claimed once per week in `marketing_runs/{date}`,
stored in `marketing_reports/{date}`):

1. Numbers, computed in code: leads by source and how many reached the
   advance stage / an order, lost reasons, median first response, orders
   and revenue by customer source, new vs returning customers, top
   products with margin (from `product_costs`), ad spend (expenses in the
   "Reklama" category) → cost per lead and per new customer; vs last week.
2. Meta ads per campaign (spend, CTR, leads, cost per lead, and the CRM's
   leads/orders for the same campaign) — only with `META_ADS_TOKEN`
   (a system-user token with `ads_read`) and `META_AD_ACCOUNT_ID`.
3. Claude's recommendations and a six-post content plan tied to upcoming
   holidays (fixed dates + the ERP's holidays) and the catalog.
4. Customers with no order for 60+ days (largest buyers first) with a
   ready personal message for each.

Anything written in the Marketing topic is answered by the same agent
with read-only tools (overview for a period, dormant customers, Meta ads,
catalog, upcoming dates). `/hisobot` there — or `POST
/webhooks/marketing/run` as an admin — sends the report right away.

### Competitors

`competitors` (Sozlamalar → Raqobatchilar; readable by sales staff, who
pick one in the lost-lead form together with the competitor's price) are
researched every Monday after the report, from the panel, or with
`/raqobat` in the Marketing topic. For each: the public Telegram channel
is read from `https://t.me/s/<name>` (last posts, views, subscribers),
the site's text is fetched, and Claude adds web search results
(`web_search_20260209` / `web_fetch_20260209`, Google Maps reviews,
prices, news), compares with the previous run and returns prices,
promotions, strengths, weaknesses and what changed → saved in
`competitor_research/{id}`. The message also lists who we lost leads to
in the last 30 days and how their price compared with ours
(`lead.estimated_amount` vs `lost_competitor_price`), and ends with what
it means for us. If web search is off for the API organisation, the agent
falls back to what it read itself. Instagram isn't readable by bots, and
Meta's Ad Library API doesn't cover commercial ads in Uzbekistan, so the
message links each competitor's Ad Library search instead.

## Bosh agent (`chief.js`)

The chief-of-staff agent. Monday–Saturday at 08:30 (claimed once per day
in `chief_runs/{date}`) it posts to the "🧠 Bosh agent" topic:

- where the month stands — plan progress, run-rate to month end and the
  daily amount still needed (`monthly_plans`), 30-day cash in/out,
  receivables with their age, what we owe suppliers, alerts (unanswered
  leads, late orders, low stock) — all computed in code;
- the model's read: the three biggest problems and opportunities, and up
  to three proposals (plan, expected effect, ready posts, a message for a
  customer segment, staff tasks, how it's measured) under ✅ / ❌.

Model: `CHIEF_MODEL` (default `claude-opus-5`, adaptive thinking, effort
high, streamed via `@anthropic-ai/sdk`, structured JSON output) with the
server-side `fallbacks: "default"` for policy declines; if the account
can't use the model it switches to `ASSISTANT_MODEL`.

Only a chat admin's ✅ acts: it creates `tasks` for the staff who own the
area (by module permission, else the approver), posts the ready posts to
the Marketing topic and the customer list + message to the Sales topic,
and stores a baseline. On `review_date` the next brief measures the same
metric over the same number of days and reports the change. Everything is
in `chief_proposals` and is fed back as memory: rejected ideas (and the
reason, if you reply to the rejected message) aren't repeated, results
steer the next proposals.

In the topic: reply to a pending proposal to have it rewritten; any other
message is a question answered from the same snapshot and memory; `/brif`
(or `POST /webhooks/chief/run` as an admin) runs the brief now.

## Employees' questions (`staffbot.js`)

In the bot's private chat, a linked employee whom an admin allowed
(`staff.bot_ask`, Sozlamalar → Xodimlar; admins always) can ask Claude
about:
- product prices: the customer price sheet as text / PDF / PNG, with no
  cost. Only for staff with Mahsulotlar view;
- their own tasks, attendance (by their own schedule) and monthly KPI;
- their own sales, plan and customer debts, if linked to a Managerlar
  record (`report_manager_id`).

Every tool reads only the asker's records, so company totals, costs and
other people's data never reach the model. Details:
- Other linked staff get "admin ruxsat berishi kerak".
- Unlinked chats fall through to the HR agent.
- Up to 30 questions an hour per chat.
- The last 4 exchanges are kept for 30 minutes, for follow-ups.

## Task notifications (`tasks.js`)

Tasks go Yangi → Ishga olindi → Bajarildi (`status`: new / in_progress /
done, with `started_at`, `completed_at`, `result_note` and a `history`
of who moved it when). A Firestore listener on `tasks`:

- a new task → its assignee's private chat (the one linked for
  attendance) gets it with [▶️ Ishga oldim] [✅ Bajardim] buttons
  (`task:start:<id>` / `task:done:<id>`, only the assignee can press);
- a task reaching Bajarildi — on the site or by button — → whoever gave
  it gets "✅ Vazifa bajarildi" with the note and a late warning; tasks
  from an agent go to the admins who linked Telegram.

Each notice is claimed once in the task (`assign_notified_at`,
`done_notified_at`), and only tasks touched in the last 24 hours are
notified. Firestore rules let the assignee change the status fields of
their own task even without tasks.edit.

Also:

- `priority` (high / normal / low), links to an order (`order_id`,
  `order_number`) and a customer (`customer_id`, `customer_name`); the
  order and customer pages show their tasks.
- Comments (`tasks/{id}/comments`) reach the assignee and the giver,
  except the author (`notified_at` on the comment). Any bot message about
  a task is remembered in `tg_task_msgs/{chat}_{message}`, so replying to
  it in Telegram adds a comment.
- Proof files (`tasks/{id}/files`, data URLs up to ~650 KB): attached on
  the site when finishing. After ✅ in Telegram the bot waits 15 minutes
  (`tg_task_pending/{chat}`) for a note (→ `result_note`) or a
  photo/document (→ a file). The done notice sends up to 3 files, and
  proof added later is forwarded too. `comment_count` / `file_count` are
  kept on the task.
- Recurring tasks: `task_templates` (`repeat`: daily except Sunday /
  weekly `weekday` 1–7 / monthly `day`, `due_in_days`, `active`). From
  07:00 each due template makes one task (`last_created_date`, in a
  transaction).
- 09:00 Mon–Sat: each linked employee gets their open tasks (overdue,
  due today, due tomorrow, the rest). The giver of each newly overdue
  task is told once (`overdue_notified_at`).
- Daily jobs are claimed in `task_runs/{date}_{job}`.
- The Reyting tab on the site (admins) scores each employee per month:
  share done on time, minus half a point per open overdue task.
