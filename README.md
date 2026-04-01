# JobHunt

> An AI-powered remote job board that uses Claude Code to search 55+ job boards, score listings against your profile, and keep everything in one place.

Instead of manually checking dozens of sites every day, you tell Claude to run a search — it crawls the boards, filters by your skills and preferences, and appends verified active listings directly to your local job list. No subscriptions, no scraper APIs, no extra cost beyond your existing Claude Code session.

---

## How it works

1. **Onboard** — paste your CV, set your preferred roles, regions, and seniority
2. **Search** — tell Claude: *"Run the job search"* — it works through 55+ boards in batches, deduplicates, and appends only fresh listings
3. **Browse** — filter, score, and track jobs in the dashboard
4. **Repeat** — Claude tracks which boards it already searched so it picks up where it left off

All data lives in local JSON files. Nothing is sent anywhere except the job board requests Claude makes during search.

---

## Stack

- **Next.js 16** — app router, API routes
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Anthropic SDK** — Claude powers CV analysis, job scoring, and the search itself
- **pdf-parse** — CV upload support
- Data layer: flat JSON files in `data/user/` (no database needed)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/nakotomagami-a11y/job-board.git
cd job-board
npm install        # or yarn / pnpm
```

### 2. Set up your user data

```bash
# Windows
xcopy data\user.example data\user\ /E /I

# macOS / Linux
cp -r data/user.example data/user
```

### 3. Add your Claude API key

```bash
cp .env.example .env.local
# then edit .env.local and paste your key
# Get one at: https://console.anthropic.com/settings/keys
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the onboarding wizard will walk you through the rest.

---

## Running a job search

Once onboarded, open a Claude Code session in this project directory and say:

```
Run the job search
```

Claude will read your profile, check which boards it has already searched, pick the next batch, and append new listings to `data/user/jobs.json`.

You can also be specific:

```
Search for React Native jobs in Europe
Search Wellfound and startup.jobs for frontend roles
Add this job: https://example.com/jobs/123
```

See [`docs/COMMANDS.md`](docs/COMMANDS.md) for the full command reference.

---

## Project structure

```
job-board/
├── src/
│   ├── app/
│   │   ├── api/              # Next.js API routes (jobs, profile, CV, search)
│   │   ├── dashboard/        # Main job board view
│   │   ├── onboarding/       # Setup wizard
│   │   └── settings/         # Preferences
│   ├── modules/
│   │   ├── jobs/             # Job board components, hooks, scoring
│   │   └── onboarding/       # Onboarding wizard steps
│   └── shared/
│       ├── config/           # Board list, filters, scoring weights
│       └── types/            # Job and profile TypeScript types
├── data/
│   ├── jobs.json             # Seed job data (example listings)
│   └── user.example/         # Template — copy to data/user/ to start
├── docs/
│   ├── COMMANDS.md           # Full Claude command reference
│   ├── SEARCH_LOG.md         # Log of every search run
│   └── SEARCH_STRATEGY.md    # Board priority and search approach
└── .env.example
```

---

## Job boards covered

**55+ boards across 7 tiers:**

| Tier | Boards |
|------|--------|
| Mega aggregators | LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter |
| Remote-first | WeWorkRemotely, RemoteOK, arc.dev, FlexJobs, Himalayas, Remotive, Remote.co, Working Nomads, JustRemote |
| Startup & tech | Wellfound, YC Work at a Startup, startup.jobs, Built In, Otta, Dice, Turing, Toptal |
| ATS platforms | Greenhouse, Lever, Ashby, Workable, SmartRecruiters, BambooHR |
| Frontend-specific | reactjobs.io, HN Who is Hiring, JavaScript Job Board |
| Niche / industry | web3.career, CryptoJobsList, Hitmarker (gaming), AI Jobs |
| European-focused | EU Remote Jobs, The Hub, landing.jobs, No Fluff Jobs, Just Join IT, MeetFrank |

> **Note:** Some boards (Wellfound, startup.jobs, Himalayas, Remote.co) block automated fetching and require running the search via the Browser MCP tool in Claude Code.

---

## Data privacy

Your personal data never leaves your machine:

- `data/user/profile.json` — your name, email, location, skills
- `data/user/cv-raw.txt` — your CV text
- `data/user/jobs.json` — your job list
- `data/user/search-*.json` — search history and batch state

All of the above are gitignored. See [`data/user.example/`](data/user.example/) for the file structure.

---

## License

MIT
