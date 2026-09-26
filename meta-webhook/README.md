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
- at work start + 5 min (from `work_schedules/default`, 09:05 by default)
  every staff member with `attendance_notify !== false` and a phone or a
  linked Telegram who hasn't checked in gets a reminder (skips the weekly
  day off, `holidays` and approved `leave_requests`; claimed once per day
  in `hr_runs/{date}` so restarts never double-send);
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

### Price sheet PDFs (`pdf.js`)

"Paket 45 narxini PDF qilib tashla" → the `product_price_pdf` tool finds
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
