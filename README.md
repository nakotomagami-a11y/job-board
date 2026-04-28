# JobHunt

> A region-aware remote job board that uses your existing Claude Code session to search 60+ boards, filter against your profile, and keep everything in one place. **No API keys, no subscriptions** — Claude Code (the agent) does all the work.

Instead of manually checking dozens of sites every day, you tell Claude to run a search — it pulls free ATS APIs first, then delegates per-board scrapes to a Haiku 4.5 subagent for cost efficiency, applies a server-side rubric, dedupes, and appends verified active listings directly to your local job list.

---

## How it works

1. **Onboard** — paste your CV, set your preferred roles, regions (in priority order), and seniority
2. **Search** — tell Claude: *"Run the job search"* — it works through 60+ boards in batches sorted by your region priority, deduplicates, and appends only fresh listings
3. **Browse** — filter, score, and track jobs in the dashboard
4. **Repeat** — Claude tracks which boards it already searched (with query fingerprints + 24h TTL) so it picks up where it left off

All data lives in local JSON files. Nothing leaves your machine except the job-board fetches Claude makes during search.

### Fetching layers — cheapest first

The agent searches in three layers, dropping down only when the previous fails:

| Layer | What | Cost |
|-------|------|------|
| **0. Direct ATS APIs** | `POST /api/board-fetch` — pulls Greenhouse / Lever / Ashby / Workable JSON for a curated list of companies | Free, deterministic, no agent |
| **1. WebFetch** | Plain HTTP fetch for boards with public HTML / REST APIs | Cheap |
| **2. Playwright (`/api/scrape`)** | Headless browser for JS-rendered or bot-protected boards | Slower; needs Chromium installed once |

Per-board scrapes are delegated to a Haiku 4.5 subagent (`.claude/agents/job-board-scraper.md`) — about 5× cheaper than the parent's tokens, ideal for structured extraction.

---

## Stack

- **Next.js 16** — app router, API routes
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Playwright** — headless Chromium for JS-rendered boards (`/api/scrape`)
- **unpdf** — CV upload support
- **Claude Code (CLI)** — drives the actual search; CV analysis shells out via `claude -p`
- Data layer: flat JSON files in `data/user/` (no database)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/nakotomagami-a11y/job-board.git
cd job-board
yarn install        # or npm / pnpm
```

### 2. Playwright Chromium (auto-installed)

Playwright's headless Chromium is downloaded automatically by the `postinstall` hook (powers `/api/scrape` for JS-heavy boards: Himalayas, Wellfound, Working Nomads, etc.). It's about a 200 MB download on first install.

To skip it (e.g. in CI or if you don't need JS-rendered boards):

```bash
SKIP_PLAYWRIGHT_BROWSER_INSTALL=1 yarn install
```

You can install it later with `npx playwright install chromium`. Without it, `/api/scrape` returns a clear error rather than crashing.

### 3. Set up your user data folder

```bash
# macOS / Linux
cp -r data/user.example data/user

# Windows
xcopy data\user.example data\user\ /E /I
```

### 4. Run

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) — the onboarding wizard will walk you through the rest.

### 5. (Optional) Reduce permission prompts

Add an allowlist to `.claude/settings.json` to skip confirmations for routine commands. The included `/fewer-permission-prompts` skill scans your transcript and suggests one tailored to your usage.

---

## Running a job search

Once onboarded, open a Claude Code session in this project directory and say:

```
Run the job search
```

Claude reads your profile, sorts the board rotation by your region priority, picks the next batch, calls `/api/board-fetch` for free ATS pulls, delegates the rest to per-board Haiku subagents, and appends new listings to `data/user/jobs.json`.

You can also be specific:

```
Search for React Native jobs in Europe
Search Wellfound and startup.jobs for frontend roles
Add this job: https://example.com/jobs/123
Audit my job list           # removes expired (>30d) and dead-link listings
```

See [`docs/COMMANDS.md`](docs/COMMANDS.md) for the full command reference and the LinkedIn deep-coverage strategy.

---

## Region priority

The "Preferred Regions" picker is *ordered* — the first entry is your top priority. With `["Europe", "Remote"]`:

- **Search rotation**: Tier 7 EU boards (Berlin Startup Jobs, Landing.jobs, NoFluff, etc.) hit first → Remote-first boards next → Global aggregators (LinkedIn, Indeed) with EU location filters → off-region boards last
- **Scoring**: top-priority region gets full credit (20 pts); listed but lower-priority gets 14; off-region remote gets 10; off-region non-remote gets 0

LinkedIn (the highest-yield single source) is always passed your top region as a `&location=…` filter so global searches still skew to your priority.

---

## Project structure

```
job-board/
├── src/
│   ├── app/api/
│   │   ├── board-fetch/      # Layer 0: direct ATS API pulls (free)
│   │   ├── scrape/           # Layer 2: Playwright headless render
│   │   ├── run-command/      # Generates the agent's search prompt
│   │   ├── storage/          # Jobs CRUD + rubric + dedup + per-board stats
│   │   ├── cv-analysis/      # CV analysis via `claude -p` CLI
│   │   └── parse-cv/         # PDF text extraction (unpdf)
│   ├── modules/
│   │   ├── jobs/             # Job board components, hooks, scoring
│   │   └── onboarding/       # Onboarding wizard steps
│   ├── lib/
│   │   ├── score-job.ts      # Server-side rubric + graduated region match
│   │   ├── job-dedup.ts      # URL + company+title dedup
│   │   ├── board-stats.ts    # Per-board win-rate tracking
│   │   └── search-history.ts # Query fingerprints with 24h TTL
│   └── shared/
│       ├── config/
│       │   ├── priority-boards.ts  # Master board list with regions + tiers
│       │   └── ats-companies.ts    # Greenhouse/Lever/Ashby company slugs
│       └── types/                  # Job + profile TypeScript types
├── .claude/agents/
│   └── job-board-scraper.md  # Haiku 4.5 subagent for per-board scraping
├── data/
│   └── user.example/         # Template — copy to data/user/ to start
└── docs/
    └── COMMANDS.md           # Full agent command reference + LinkedIn guide
```

---

## Job boards covered

**60+ boards across 7 tiers**, each tagged with the regions it primarily covers. The full list with metadata lives in [`src/shared/config/priority-boards.ts`](src/shared/config/priority-boards.ts).

| Tier | Examples |
|------|----------|
| 1. Mega aggregators | LinkedIn (guest API), Indeed, Glassdoor, Google Jobs |
| 2. Remote-first | WeWorkRemotely, RemoteOK (API), Remotive (API), Himalayas, Jobicy (API), Arbeitnow (API) |
| 3. Startup & tech | Wellfound, YC Work at a Startup, startup.jobs, Built In, Levels.fyi |
| 4. ATS platforms | Greenhouse, Lever, Ashby, Workable, SmartRecruiters |
| 5. Frontend-specific | reactjobs.io, HN Who is Hiring, Frontend Focus |
| 6. Niche / industry | web3.career, CryptoJobsList, Hitmarker (gaming), AI Jobs, Climatebase |
| 7. European-focused | Berlin Startup Jobs, NoFluff, Just Join IT, Pracuj.pl, CVbankas (LT), Welcome to the Jungle, Relocate.me, MeetFrank |

> Some boards (Wellfound, startup.jobs, Himalayas, Working Nomads, WTTJ, MeetFrank, Pracuj) are JS-rendered or bot-protected and require `/api/scrape` (Playwright).

---

## Data privacy

Your personal data never leaves your machine:

- `data/user/profile.json` — your name, email, location, skills
- `data/user/cv-raw.txt` — your CV text
- `data/user/jobs.json` — your job list
- `data/user/board-stats.json` — per-board win-rate stats
- `data/user/search-history.json` — query fingerprints (last 500)
- `data/user/search-batch-state.json` — rotation state

All of the above are gitignored. See [`data/user.example/`](data/user.example/) for the file structure.

---

## License

MIT
