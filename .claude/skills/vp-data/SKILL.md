---
name: vp-data
description: Get real Vodiy Print numbers (sales, managers, KPI, debts, cost and margin, amoCRM funnel, product cards) safely as aggregates, by running the read-only GitHub workflows on the server and reading their logs. Use before any analysis, presentation or fix that depends on what is in the database.
---

# Real data, read only

This container cannot reach Firestore. The server (`/opt/meta-webhook`)
can. Read-only GitHub workflows SSH into it, run a script and print
**aggregates only**. Customer names, phones and notes must never be
printed, because they would land in GitHub Actions logs.

## Start with the snapshot

```bash
R=sodiqovmuhammadali897-arch/vodiy-print-v2-yangi
gh api -X POST repos/$R/actions/workflows/snapshot.yml/dispatches -f ref=main -f "inputs[sections]=all"
for i in $(seq 1 30); do r=$(gh api "repos/$R/actions/workflows/snapshot.yml/runs?per_page=1" --jq '.workflow_runs[0] | "\(.id) \(.status) \(.conclusion)"'); case "$r" in *completed*) break;; esac; sleep 10; done
gh api "repos/$R/actions/runs/${r%% *}/jobs" --jq '.jobs[0].id'   # → job id
```

Then read the log with `mcp__github__get_job_logs`:
- load it with ToolSearch `select:mcp__github__get_job_logs`;
- arguments: owner `sodiqovmuhammadali897-arch`, repo `vodiy-print-v2-yangi`,
  the `job_id`, `return_content: true`, `tail_lines: 300`.

(`gh api` cannot follow the log redirect to blob storage.)

**Sections:** `sales managers kpi debt cost amo products`. Pass a few, for
example `-f "inputs[sections]=kpi cost"`, for a shorter log.

- **sales** — by month (revenue, paid, debt) and by month × `manager_name`.
  `*` marks a name that is not in Managerlar.
- **managers** — Managerlar (plan, rates) and the staff linked to a
  manager or an amoCRM user.
- **kpi** — per month × manager: the live sums, the `kpi_sales` doc and
  the approved snapshot. `STALE` = the snapshot no longer matches.
- **debt** — by order status × manager.
- **cost** — tannarx coverage and margin by month. Costs are tracked from 2026-09.
- **amo** — amoCRM users, stages with the open counts now, leads
  created / won / lost by month, and loss reasons.
- **products** — card fields filled out of 72, categories, top 25 products
  since July 2026.

The script is `meta-webhook/checks/snapshot.js` (test: `tests/snapshot.test.ts`).
It reaches the server only with a deploy.

## Narrower or older checks

- `kpi-check.yml`, `cost-coverage.yml`, `amo-stages.yml`, `product-check.yml`
  — the same data, one subject each.
- `business-stats.yml` — the long SWOT stats: products, regions, sources,
  buyers, margin.
- `check-import.yml` — before an Excel import (modes no / yes / ref / near).
- `recall-preview.yml` — sends the SINOV recall and debt lists to the admins (Telegram).

## Adding a check

- Prefer a new section in `meta-webhook/checks/snapshot.js`. Add it to
  `NEEDS`, keep it pure (data in, lines out), and extend the test with a
  "never prints customer data" assertion.
- A one-off script also works: an inline `ssh-action` workflow as in
  `kpi-check.yml`. It requires `/opt/meta-webhook/node_modules/firebase-admin`
  and `service-account.json` and prints only counts and sums.
- **Never** write to the database from a check. Writers (`fix-*.yml`) take
  `apply: no|yes` and need the owner's explicit approval; they record what
  they changed in `data_fixes`.

## Reading the numbers right

- ERP data is reliable from **2026-07**. Earlier months are Excel imports.
- Cost and margin come only from **2026-09** (`COST_TRACKING_FROM`).
- Orders belong to managers by `manager_name`. amoCRM users are matched
  to staff by `staff.amo_user_id`.
- When you report to the owner, say which numbers are real and which are samples.
