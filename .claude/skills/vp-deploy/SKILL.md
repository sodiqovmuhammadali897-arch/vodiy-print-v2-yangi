---
name: vp-deploy
description: Commit, push and ship a Vodiy Print change to printvodiy.uz and the server, then watch the deploy until it is green. Use after every finished change to code, the server (meta-webhook) or the workflows.
---

# Commit → push → deploy → watch

## Before committing

```bash
npx tsc --noEmit -p . && npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL"
npm run build 2>&1 | tail -1            # for site changes
git checkout tsconfig.tsbuildinfo       # the build touches it
git status --short                      # never add meta-webhook/package-lock.json
```

## Commit and push (no pull requests)

- Stage the exact files with `git add <paths>`, not `-A`.
- The message: a short summary line, a blank line, then the why. End it
  with the attribution lines from the system reminder. No model names.

```bash
git push -u origin claude/server-talabini-ayt-s48oig
git push origin HEAD:main
```

If the network fails, retry up to 4 times (2s, 4s, 8s, 16s).

## Watch the deploy

A push to `main` runs «Deploy to printvodiy.uz» with four jobs: `test`,
`deploy` (site), `deploy-meta-webhook` (server, which rewrites its `.env`)
and `deploy-functions` (Firebase rules and functions).

```bash
R=sodiqovmuhammadali897-arch/vodiy-print-v2-yangi; S=$(git rev-parse HEAD)
for i in $(seq 1 50); do r=$(gh api "repos/$R/actions/runs?head_sha=$S&per_page=10" --jq '.workflow_runs[] | select(.head_branch=="main" and .name=="Deploy to printvodiy.uz") | "\(.id) \(.status) \(.conclusion)"' | head -1); case "$r" in *completed*) break;; esac; sleep 15; done
gh api "repos/$R/actions/runs/${r%% *}/jobs" --jq '.jobs[] | "\(.id) \(.name) \(.conclusion)"'
```

## If a job fails

- Read its log with `mcp__github__get_job_logs` (`job_id`, `return_content: true`, `tail_lines: 60`).
- **SSH «i/o timeout»** (Bootstrap server / deploy-meta-webhook) is
  transient. Run `gh api -X POST repos/$R/actions/runs/<id>/rerun-failed-jobs`
  and watch again.
- **deploy-functions:** the functions runtime is Node 22 (in both
  `functions/package.json` and deploy.yml). Google retires old Node versions.
- **test:** reproduce it locally with `npx vitest run <file>`.

## Server settings

- Server env vars live in deploy.yml (`cat > /opt/meta-webhook/.env`).
- Values come from GitHub Secrets (keys) or Variables (for example
  `RECALL_MANAGERS`).
- Adding a new variable means editing deploy.yml. Never put a secret's
  value in the repo or the chat.

## Report

Tell the owner in Uzbek:
- what changed;
- that the deploy is green, or what failed and why;
- what they need to do in the app, if anything.
