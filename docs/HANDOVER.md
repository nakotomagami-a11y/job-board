# Handover — 2026-04-29

Picks up after the search-engine overhaul (#20) and follow-ups (#23, #25, #28, #29, #30, #31). Read [`docs/COMMANDS.md`](COMMANDS.md) for the live agent reference; this file is the running list of *what's pending and known to be wrong*.

## State

- All 6 PRs merged to master.
- End-to-end search verified end-to-end on 2026-04-28: 50 jobs persisted to `data/user/jobs.json`.
  - 24 from Layer 0 (`/api/board-fetch` — Greenhouse + Ashby).
  - 26 from Layer 1 agent search (RemoteOK + Remotive + arc.dev).
  - 0 rejected by `rubricReject`. 16 dropped by dedup.
- Per-board stats and search history fingerprints are populated in `data/user/board-stats.json` and `data/user/search-history.json`.

## Open issues to fix

Ordered by impact. None are urgent — the pipeline works.

### 1. Sub-agent permissions are not inherited

When the parent agent spawns sub-agents (the `job-board-scraper` Haiku subagent or `general-purpose`), they don't inherit your session's allowlist. In the verification run, three of seven sub-agents were blocked on `Bash(curl:*)` and `WebFetch` before they could fetch anything.

**Fix:** in your next session, run `/fewer-permission-prompts` and accept the suggestions. At minimum add:

```jsonc
// .claude/settings.json (or ~/.claude/settings.json for cross-project)
{
  "permissions": {
    "allow": [
      "Bash(curl:*)",
      "Bash(node:*)",
      "WebFetch(domain:remoteok.com)",
      "WebFetch(domain:remotive.com)",
      "WebFetch(domain:weworkremotely.com)",
      "WebFetch(domain:himalayas.app)",
      "WebFetch(domain:linkedin.com)",
      "WebFetch(domain:www.linkedin.com)",
      "WebFetch(domain:arc.dev)",
      "WebFetch(domain:jobicy.com)",
      "WebFetch(domain:arbeitnow.com)",
      "WebFetch(domain:www.arbeitnow.com)",
      "WebFetch(domain:greenhouse.io)",
      "WebFetch(domain:job-boards.greenhouse.io)",
      "WebFetch(domain:boards-api.greenhouse.io)"
    ]
  }
}
```

Without this you'll keep doing scrapes from the parent agent (more expensive, no parallelism).

### 2. Restart Claude Code to pick up the Haiku subagent

`.claude/agents/job-board-scraper.md` was created mid-session in #20 and only loaded at session start. **A fresh `claude` invocation will list it.** Verify with `Agent ` autocomplete; it should appear alongside `general-purpose`, `Explore`, etc.

### 3. ATS slugs returning 404 in `/api/board-fetch`

These slugs in [`src/shared/config/ats-companies.ts`](../src/shared/config/ats-companies.ts) returned HTTP 404 during the verification run. Need either fresh slugs or removal:

| Provider | Slug | Status | Action |
|----------|------|--------|--------|
| Greenhouse | `notion` | 404 | Notion likely moved boards. Check `notionhq` / `notionsoftware` or remove. |
| Greenhouse | `ramp` | 404 | Ramp may use Ashby now. Verify at ramp.com/careers. |
| Greenhouse | `openai` | 404 | OpenAI uses their own ATS. Drop. |
| Greenhouse | `huggingface` | 404 | Likely Lever or Ashby. Verify. |
| Lever | `shopify` | 404 | Shopify uses Greenhouse (`shopify`). Move provider. |
| Lever | `twitch` | 404 | Amazon ATS. Drop or replace with Amazon Jobs route. |
| Lever | `ubisoft` | 404 | Workday. Drop. |
| Lever | `clio` | 404 | Verify slug. |

Easy verification: hit each URL manually, e.g. `curl -I https://boards-api.greenhouse.io/v1/boards/notion/jobs`. If 200, the slug works; if 404, fix or remove.

### 4. `/api/board-fetch` should ALSO discover ATS-hosted jobs from URLs the agent finds

When the agent finds a Greenhouse / Lever / Ashby URL during a scrape (e.g. `https://boards.greenhouse.io/somecompany/jobs/123`), we should auto-add `somecompany` to the ATS list. Right now the list is curated by hand — every discovery is wasted work next time.

**Suggested approach:** add a `POST /api/ats-companies/discover` route that takes a job URL, parses out the company slug, and appends to a separate `data/user/ats-discovered.json`. `/api/board-fetch` reads both the static config and the discovered file.

### 5. Search config UI default uses an invalid region

[`src/modules/jobs/components/search-config.tsx:31`](../src/modules/jobs/components/search-config.tsx#L31) defaults `regions: ["Worldwide"]`. "Worldwide" isn't a valid `BoardRegion` — the rotation falls into the "Global" bucket via the off-region fallback, which works but is confusing.

**Fix:** either rename the option to "Global" or seed from `profile.preferredRegions` on first mount.

### 6. Profile salary range may be malformed

Sample profile saved during verification: `"salaryRange": { "min": 80000, "max": 0, "currency": "USD" }`. The `max: 0` is invalid and `parseSalary()` will fall back to the unlisted-bonus path, dropping 5pts unfairly.

**Fix:** in onboarding, when only `min` is set, leave `max` undefined (or `Infinity`) rather than `0`. [`src/modules/onboarding/components/step-preferences.tsx`](../src/modules/onboarding/components/step-preferences.tsx) — find the salary input.

### 7. cvbankas.lt / pracuj.pl / meetfrank.com Playwright path not yet verified

Those three boards are tagged in `priority-boards.ts` as needing `/api/scrape`. None of them got hit during the verification run because the rotation didn't reach them with `searchScope: "focused"` (only Tiers 1-3). When you run a `searchScope: "all"` sweep, confirm the Playwright fallback fires correctly on at least one of them.

## Lower-priority cleanups

- **Concurrency**: only `search-batch-state.json` has a mutex. Concurrent writes to `jobs.json`, `board-stats.json`, `search-history.json` could lose data under load. Fine for single-user local-first; not OK if deployed.
- **`/api/cv-analysis` shells to the local `claude` CLI** — won't work in any non-local environment. Out of scope unless deploying.
- **Dashboard panel for `board-stats.json`** — surface per-board win-rate so you can see which sources are noise. Currently only readable as JSON.
- **`scripts/add-browser-mcp-jobs.js`** in `scripts/` is leftover from the old Browser MCP path. Probably dead — verify before deletion.

## How to resume scraping

1. **Restart Claude Code** in this directory (loads the Haiku subagent).
2. Approve the permission allowlist (issue #1 above).
3. From the dashboard, click "Generate search prompt" — that builds the prompt and writes it to `data/user/command-prompt.txt`.
4. In the Claude Code session, say *"Run the job search"* — the parent will:
   - `POST /api/board-fetch` first (free Layer 0 pulls).
   - Delegate per-board scrapes to the `job-board-scraper` subagent (Haiku 4.5).
   - Aggregate and `POST /api/storage/jobs`.
5. Refresh the dashboard. New jobs land with full rubric + dedup applied.

Confirm with:

```bash
curl -s http://localhost:3000/api/storage/jobs | jq length
cat data/user/board-stats.json | jq
```

## Quick reference — key files and routes

| Concern | File |
|---|---|
| Layer 0 (ATS API) | [`src/app/api/board-fetch/route.ts`](../src/app/api/board-fetch/route.ts) |
| Layer 2 (Playwright scrape) | [`src/app/api/scrape/route.ts`](../src/app/api/scrape/route.ts) |
| Search prompt generator | [`src/app/api/run-command/route.ts`](../src/app/api/run-command/route.ts) |
| Storage + rubric + stats | [`src/app/api/storage/jobs/route.ts`](../src/app/api/storage/jobs/route.ts) |
| Hard-reject rubric | [`src/lib/score-job.ts`](../src/lib/score-job.ts) — `rubricReject()` |
| Dedup logic | [`src/lib/job-dedup.ts`](../src/lib/job-dedup.ts) — `mergeJobs()` |
| Per-board stats | [`src/lib/board-stats.ts`](../src/lib/board-stats.ts) |
| Search-query TTL | [`src/lib/search-history.ts`](../src/lib/search-history.ts) |
| Master board list | [`src/shared/config/priority-boards.ts`](../src/shared/config/priority-boards.ts) |
| ATS slug list | [`src/shared/config/ats-companies.ts`](../src/shared/config/ats-companies.ts) |
| Haiku subagent | [`.claude/agents/job-board-scraper.md`](../.claude/agents/job-board-scraper.md) |
