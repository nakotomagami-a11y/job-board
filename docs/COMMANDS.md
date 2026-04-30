# Commands Reference

Commands for Claude Code to execute when maintaining the job board app.

## How It Works

The app generates search prompts (saved to `data/user/command-prompt.txt` and `data/user/pending-search.json`). You tell Claude Code to run the search, and Claude searches + writes results directly to `data/user/jobs.json`. **No extra API calls, no extra token cost** — it all happens in your existing Claude Code conversation.

**Quick commands you can say:**
- `/search-latest` — quick scan of all high-yield boards for latest postings (first page only, last 7 days)
- "Run the job search" — reads pending-search.json and executes full batch
- "Search for frontend jobs in Europe" — direct search
- "Search local boards in Lithuania" — local search
- "Check Rockstar and EA for jobs" — company search
- "Audit my job list" — remove expired jobs
- "Add this job: [url]" — manual add

---

## ⚡ SEARCH_LATEST (Quick Scan)

**Trigger:** User runs `/search-latest` or says "check latest jobs"

**What it does:** Quick-scans the first page of all 13 high-yield boards for jobs posted in the last 7 days. Unlike CHECK_NEW_JOBS which processes boards in batches, this hits all reliable boards at once using parallel agents — designed for daily use.

**Boards checked (13):** Remotive (API), RemoteOK (API), Himalayas, arc.dev, WeWorkRemotely, Working Nomads, Wellfound, LinkedIn, Indeed, Built In, web3.career, Jobicy (API), DailyRemote

**Key differences from CHECK_NEW_JOBS:**
- First page only — no pagination
- Last 7 days only — skip older listings
- All boards in parallel — much faster
- Skips known-dead boards (FlexJobs, Turing, Toptal, etc.)

**Steps:**
1. Read profile, existing jobs, and COMMANDS.md for context
2. Launch parallel agents (4 groups of 2-3 boards each)
3. Each agent checks first page, collects jobs from last 7 days
4. Merge, deduplicate against existing jobs, append new ones to jobs.json
5. Update search-batch-state.json with timestamp and count

---

## 🔍 CHECK_NEW_JOBS (Main Search)

**Trigger:** User clicks "Find New Jobs" in the app, or says "run the job search"

**Steps:**

1. Read `data/user/pending-search.json` for search config (filters, scope, etc.)
2. Read `data/user/command-prompt.txt` for the full prompt with context
3. Read `data/user/profile.json` for candidate skills and preferences
4. Read `data/user/jobs.json` to get existing IDs (avoid duplicates)
5. Search job boards based on the prompt's board list and filters
6. For each board, search for matching roles (frontend, React, mobile, etc.)
7. Verify each job is:
   - Active (real apply URL, not a search results page)
   - Recent (posted within last 30 days)
   - Not a duplicate of existing IDs
8. Append new jobs to `data/user/jobs.json` (don't overwrite existing)
9. Each job object must have:
   ```json
   {
     "id": "company-slug-title",
     "title": "Job Title",
     "company": "Company Name",
     "companyType": "Startup|Agency|Big Tech|Other",
     "location": "City, Country",
     "region": "Europe|Remote|North America|UK|Asia|Hybrid",
     "roleType": "Frontend|Mobile|Full-Stack (Frontend-leaning)|Design Engineer|Creative Developer",
     "seniority": "Junior|Mid|Senior|Staff|Principal|Lead|Manager",
     "url": "https://actual-apply-link",
     "tags": ["React", "TypeScript"],
     "salary": "$100k-150k or null",
     "postedDate": "YYYY-MM-DD",
     "verifiedDate": "YYYY-MM-DD",
     "source": "board name",
     "remote": true,
     "category": "Gaming|Crypto / Web3|AI / ML|Fintech|SaaS / Dev Tools|E-Commerce|Other",
     "sourceType": "agent",
     "description": "1-2 sentence description"
   }
   ```

---

## 🌍 LOCAL_SEARCH

**Trigger:** User selects countries and clicks "Search Local Boards"

**Steps:**

1. Read `data/user/pending-search.json` for country list
2. For each country, discover popular local job boards (e.g. Lithuania: cvbankas.lt; Poland: nofluffjobs.com)
3. Search those boards for frontend/React/mobile positions
4. Include local-language listings
5. Append to `data/user/jobs.json`

---

## 🏢 COMPANY_SEARCH

**Trigger:** User adds companies to track and clicks "Search"

**Steps:**

1. Read `data/user/pending-search.json` for company list + career URLs
2. Visit each company's careers page
3. Also search LinkedIn/Greenhouse for positions at these companies
4. Append matching frontend/mobile positions to `data/user/jobs.json`

---

## 📄 ANALYZE_CV

**Trigger:** User uploads CV in onboarding

**Steps:**

1. Read `data/user/cv-raw.txt`
2. Extract: name, email, location, skills, suggested roles, seniority, categories, years experience, summary
3. Write to `data/user/cv-analysis.json`

---

## 🧹 AUDIT (runs locally, no Claude needed)

**Trigger:** User clicks "Audit" button

Automatically removes jobs older than 30 days. No Claude call needed — handled by the app's API.

---

## 📊 STATUS_REPORT

**Trigger:** "Give me a job board status report"

1. Read `data/user/jobs.json`
2. Report: total listings, by region, by role type, by company type, oldest listing, etc.

---

## ➕ ADD_JOB_MANUALLY

**Trigger:** "Add this job: [url]"

1. Visit the URL, verify it's active
2. Extract job details (title, company, location, etc.)
3. Generate unique ID
4. Append to `data/user/jobs.json`

---

## 🌐 SEARCH METHOD: layered fetching (cheapest first)

Always go in this order — drop down only when the previous layer fails:

### Layer 0: Direct ATS APIs (no agent, no tokens, no scraping)
**Always run this first.** Many companies use Greenhouse / Lever / Ashby / Workable, which expose public JSON job-board APIs:

```
POST http://localhost:3000/api/board-fetch
```

(no body needed — fetches all companies in `src/shared/config/ats-companies.ts`).
Returns ready-to-store jobs already filtered to frontend/mobile titles.
Submit them to `/api/storage/jobs` and move on.

Add new companies to `ats-companies.ts` as you discover them — every entry there means one less agent task forever.

### Layer 1: WebFetch (cheap, no rendering)
For everything outside the ATS list, default to `WebFetch`.

**Works for:**
- Boards with public REST APIs (Remotive, RemoteOK, Jobicy)
- Static HTML job pages
- Google search snippets

**Fails for:**
- JS-rendered boards
- Sites with bot protection (403 / Cloudflare challenges)
- Pages requiring login/subscription

### Layer 2: `/api/scrape` (Playwright, fallback for JS-rendered boards)
When WebFetch returns empty HTML, a 403, or a bot-challenge:

```
POST http://localhost:3000/api/scrape
{
  "url": "https://himalayas.app/jobs/worldwide?q=react",
  "waitFor": "networkidle",
  "waitForSelector": ".job-card",          // optional
  "extractSelector": "article.job-card"    // optional — returns text only
}
```

Returns either rendered HTML or extracted text. Handles JS-rendered boards in-process (no Chrome app needed, deterministic).

Note: requires Chromium installed locally. One-time setup: `npx playwright install chromium`.

### Layer 3: Chrome MCP (`mcp__Claude_in_Chrome__*`, last-resort fallback for anti-bot boards)
Some boards block both WebFetch (403) AND Playwright (DataDome / Cloudflare / login wall). For these, drive the user's real, logged-in Chrome session via Chrome MCP:

- Boards that REQUIRE this layer: Wellfound, Welcome to the Jungle, NoFluffJobs, The Hub, WorkInStartups, CryptoJobsList, Solana Jobs (Getro), LinkedIn feed, Glassdoor, Indeed, Weekday, HiringCafe.
- Tools: `mcp__Claude_in_Chrome__navigate`, `read_page`, `get_page_text`, `find`, `javascript_tool`, `tabs_create_mcp`.
- The parent agent (not the subagent) drives Chrome MCP. Subagents return `[]` with `botBlocked: true` and the parent picks them up.

**Hard rule: never skip a board on first failure.** If WebFetch fails → try `/api/scrape` → if that fails → drive Chrome MCP. Skipping is a bug, not a feature.

**Login-required boards** (e.g. LinkedIn feed, Wellfound, Glassdoor logged-in views) get **queued for the end of the run**. The user will log in on demand; the parent then drives Chrome MCP through the authenticated session. Surface a single consolidated "ready to log in" prompt at the end — don't interrupt mid-batch.

### Cheap-execution rule: delegate the actual scrape to Haiku
Do NOT run the WebFetch / `/api/scrape` calls from the parent agent yourself. Launch the **`job-board-scraper` subagent** (`.claude/agents/job-board-scraper.md`) — it runs on Haiku 4.5 and costs ~5× less. One subagent per board, in parallel when possible. The parent only orchestrates and merges the JSON arrays each subagent returns.

### Boards needing /api/scrape (JS-rendered or guest-restricted)

| Board | Reason | Notes |
|-------|--------|-------|
| Himalayas (himalayas.app) | JS-rendered | URL pattern: `https://himalayas.app/jobs/worldwide?q=ROLE&experience=mid-level%2Csenior&type=full-time` — search react+developer, frontend+engineer, react+native separately. Use `/companies/SLUG/jobs/JOB-SLUG` for job pages. |
| Wellfound / AngelList (wellfound.com) | 403 on direct pages | Good startup jobs |
| startup.jobs (startup.jobs) | 403 on direct pages | Good startup jobs |
| Y Combinator Work at a Startup (workatastartup.com) | JS-rendered, most URLs 404 | YC-backed companies |
| Working Nomads (workingnomads.com) | JS-rendered | URL: `https://www.workingnomads.com/jobs?category=development&tag=react` — 50+ results. Apply URLs at `/job/go/{ID}/` redirect off-site. Extract via `a[href*="/jobs/"]`. |
| Welcome to the Jungle (welcometothejungle.com) | JS-rendered | Use `/jobs?query=react&refinementList[contract_type][]=Full+time`. Now also hosts ex-Otta listings. |
| Climatebase (climatebase.org/jobs) | JS-rendered | Climate-tech aggregator, growing frontend inventory |
| The Muse (themuse.com) | Individual job URLs return 404 | Some worldwide listings |
| MeetFrank (meetfrank.com) | 403 to headless fetchers | Baltics-focused career app, public board is thin |
| pracuj.pl | 403 to headless fetchers | Poland's largest general board, use Playwright |
| javascriptjob.xyz | 403 to headless fetchers | Try Playwright before giving up |

### Boards with structural issues

| Board | Status | Notes |
|-------|--------|-------|
| Dice (dice.com) | US-centric — all listings require US location/timezone | Not useful for worldwide remote |
| MeetFrank | Pivoted to anonymized matching app | Public board still exists but thin |

### Removed from rotation (verified dead / acquired / single-company / paywalled)

- **Triplebyte** — defunct (shut down March 2023, acquired by Karat)
- **Turing** — single-company talent vetting / contractor marketplace
- **Toptal** — single-company freelance network
- **Contra** — single-company freelance work marketplace
- **Otta** — redirects to Welcome to the Jungle (use WTTJ instead)
- **Hired** — acquired by LHH/Adecco; redirects to lhh.com (HR services, no public board)
- **CSS-Tricks Jobs** — wound down after DigitalOcean acquisition ("coming back soon" forever)
- **Smashing Magazine Jobs** — page exists, no listings
- **mljobs.org** — parked domain ("under construction")
- **hireweb3.io/jobs** — 404
- **IndieDragoness game-dev jobs** — stale curated page (2021 content, broken feeds)
- **remote100k.com** — 0 jobs visible
- **FlexJobs** — paywall-only (subscription required to view full jobs)

---

## 🔵 LINKEDIN: heavy-coverage strategy

LinkedIn has by far the largest tech job inventory but the public web page hits a soft login wall after 60 results. **Use the guest API endpoint instead** — verified working without auth as of 2026-04-28.

### Guest API endpoint (the workhorse)

```
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={KW}&location={LOC}&start={N}
```

Returns an HTML fragment with ~10–25 `<li>` job-search-card elements per request. Each card contains `data-entity-urn="urn:li:jobPosting:{JOB_ID}"`, the title, company, location, and a relative posting date.

For full job details + apply URL:
```
https://www.linkedin.com/jobs/view/{JOB_ID}
```
The off-site apply URL is in the page's JSON-LD `<script type="application/ld+json">` block (`hiringOrganization.url`) and on the "Apply on company website" button. Easy Apply postings have no off-site URL — record them as `apply_via_linkedin`.

### Query parameters (verified)

| Param | Meaning | Useful values |
|---|---|---|
| `keywords` | Search text (URL-encoded; `%22` for exact-phrase quotes) | `"react developer"`, `frontend engineer`, `"react native"` |
| `location` | Human-readable | `Lithuania`, `European Union`, `Remote` |
| `geoId` | LinkedIn internal geo ID (more reliable than `location` — resolve once via the search page redirect, then cache) | resolve dynamically; LinkedIn renumbers occasionally |
| `f_TPR` | Time posted | `r86400` (24h), `r604800` (7d), `r2592000` (30d) |
| `f_WT` | Work type | `1` onsite, `2` remote, `3` hybrid (comma-join: `f_WT=2,3`) |
| `f_E` | Experience | `1` intern, `2` entry, `3` associate, `4` mid-senior, `5` director, `6` exec |
| `f_JT` | Job type | `F` full-time, `P` part-time, `C` contract |
| `start` | Pagination offset | `0, 25, 50, ...` |
| `sortBy` | Sort | `DD` date desc, `R` relevance |

### Pagination strategy

- 25 results per page via `start=0,25,50,...`
- Hard cap around `start=975` — beyond that returns empty fragments
- Always sort `DD` (date desc) so the newest jobs come first; combine with `f_TPR=r86400` for daily sweeps to avoid hitting the cap
- Stop when a page returns fewer than 25 cards or zero

### Keyword combinations that move volume

Run each as a separate query and dedupe by `JOB_ID`:
- `"react developer"`, `react.js`, `"react native"`
- `"frontend engineer"`, `"front-end developer"`, `"front end engineer"`
- `"design engineer"`, `"ui engineer"`, `"creative developer"`, `"creative technologist"`
- `"javascript engineer"`, `"typescript engineer"`
- `"web developer"` + `f_E=3,4` to filter junior junk
- Mobile: `"mobile engineer"`, `"ios engineer"`, `"android engineer"`, `flutter developer`

Combining a keyword with `f_WT=2` (remote) + `f_TPR=r86400` (24h) typically yields 200–500 fresh hits per day across all keywords for EU+remote.

### Anti-detection

- Rotate `User-Agent` across recent desktop Chrome/Firefox strings. Known-good: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`
- Set `Accept-Language: en-US,en;q=0.9` and `Accept: text/html,application/xhtml+xml`
- Throttle: **1 request every 2–4 seconds** is safe; 1/sec gets soft-blocked within an hour
- Single IP soft cap is around 1k–2k requests/day before 429s
- The `seeMoreJobPostings` endpoint is more lenient than the full search page — prefer it
- Do **not** send LinkedIn cookies from a logged-in browser — that escalates to authenticated mode and triggers stricter detection on the guest endpoint
- On 429: exponential backoff starting 60s, doubling

### Example URLs (verified working)

```
# Lithuania, last 7 days, remote, react
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=react%20developer&location=Lithuania&f_TPR=r604800&f_WT=2&start=0

# EU-wide, last 24h, remote, react native
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=%22react%20native%22&location=European%20Union&f_TPR=r86400&f_WT=2&start=0

# Poland, last 7 days, mid-senior frontend
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=frontend%20engineer&location=Poland&f_TPR=r604800&f_E=3,4&start=0
```

### When to use which

| Goal | Endpoint |
|---|---|
| Daily fresh sweep | `/jobs-guest/.../seeMoreJobPostings/search` with `f_TPR=r86400` and `sortBy=DD` |
| Weekly fill-in | same endpoint with `f_TPR=r604800` |
| Specific job apply URL | `/jobs/view/{JOB_ID}`, parse JSON-LD |
| Full HTML search page | `/jobs/search/?...` — only when the guest endpoint fails (rare) |

### Search state tracking

After each search session, update `data/user/search-batch-state.json`:
- Add newly searched boards to `searchedBoards`
- Remove them from `remainingBoards`
- Add bot-blocked boards to `botBlockedBoards` with the reason
- Update `jobsFoundTotal` with total count from `data/user/jobs.json`

### Remotive API (reliable data source)
Remotive provides a free public API — use it when available:
```
https://remotive.com/api/remote-jobs?category=software-dev&search=react&limit=20
https://remotive.com/api/remote-jobs?category=software-dev&search=frontend&limit=20
https://remotive.com/api/remote-jobs?category=software-dev&search=react+native&limit=20
```
This returns clean JSON with worldwide remote jobs. Always deduplicate against existing `jobs.json` IDs.
