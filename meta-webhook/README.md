# Meta Lead Ads webhook

A tiny, standalone Node process that receives Instagram/Facebook Lead
Ads submissions from Meta and writes them straight into the app's
`leads` Firestore collection — the same shape the Lidlar module reads.

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
