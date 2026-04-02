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
     "sourceType": "claude-search",
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

## 🌐 SEARCH METHOD: WebFetch vs Browser MCP

When searching job boards, Claude uses two methods. **Always try WebFetch first.** Fall back to Browser MCP when WebFetch fails.

### Method 1: WebFetch (default)
Use `WebFetch` for all boards by default. It's fast and token-efficient.

**WebFetch works well for:**
- Boards with public REST APIs (e.g. Remotive: `https://remotive.com/api/remote-jobs?category=software-dev&search=react&limit=20`)
- Static HTML job pages
- Google search snippets to find individual job URLs

**WebFetch FAILS for:**
- JS-rendered boards (React/Next.js apps) — returns empty HTML shell, no job data
- Sites with bot protection (Cloudflare, Incapsula) — returns 403 or challenge page
- Pages requiring login/subscription (e.g. FlexJobs)

### Method 2: Browser MCP (fallback)
If WebFetch returns no job data, an empty page, a 403/404/410, or bot-challenge HTML, **connect to Browser MCP** using the `mcp__Claude_in_Chrome__` tools.

**How to switch to Browser MCP:**
```
- Use mcp__Claude_in_Chrome__tabs_context_mcp to get an active tab
- Use mcp__Claude_in_Chrome__navigate to load the job board URL
- Use mcp__Claude_in_Chrome__get_page_text or read_page to extract job listings
- Wait for JS to render if needed (mcp__Claude_in_Chrome__computer with wait)
```

**Browser MCP works for:**
- JS-rendered boards (Himalayas, Wellfound, startup.jobs, YC Work at a Startup)
- Sites returning 403 to headless fetchers but accessible in real browser
- Pages that require scrolling/interaction to load more listings

### Boards requiring Browser MCP (identified in past searches)

| Board | Reason | Notes |
|-------|--------|-------|
| Himalayas (himalayas.app) | JS-rendered, API 404 | ✅ Works via Browser MCP. URL pattern: `https://himalayas.app/jobs/worldwide?q=ROLE&experience=mid-level%2Csenior&type=full-time` — search react+developer, frontend+engineer, react+native separately. Use `/companies/SLUG/jobs/JOB-SLUG` URLs for job pages. |
| Wellfound / AngelList (wellfound.com) | 403 on all direct pages | Good startup jobs |
| startup.jobs (startup.jobs) | 403 on all direct pages | Good startup jobs |
| Y Combinator Work at a Startup (workatastartup.com) | JS-rendered, most URLs 404 | YC-backed companies |
| Remote.co (remote.co) | Timeouts (60s+) | Worldwide remote focus |
| Working Nomads (workingnomads.com) | JS-rendered, no data via WebFetch | ✅ Works via Browser MCP. URL: `https://www.workingnomads.com/jobs?category=development&tag=react` — returns 50+ results. Apply URLs are at `/job/go/{ID}/` which redirect to external site. Use `document.querySelectorAll('a[href*="/jobs/"]')` to extract links. |
| Otta / Welcome to the Jungle (welcometothejungle.com) | JS-rendered, returns no results | Otta was acquired by WTTJ |
| The Muse (themuse.com) | Individual job URLs return 404 | Some worldwide listings |
| Turing (turing.com) | Incapsula bot-blocking | Talent vetting platform |
| Toptal (toptal.com) | 403 on all pages | Freelance talent network |

### Boards with structural issues (not bot-blocking)

| Board | Status | Notes |
|-------|--------|-------|
| FlexJobs (flexjobs.com) | Paywall — subscription required | Not worth Browser MCP |
| Triplebyte (triplebyte.com) | **Defunct** — shut down March 2023, acquired by Karat | Remove from board list |
| Hired (hired.com) | **Acquired** — redirects to LHH Recruitment Solutions (June 2024) | Changed from tech marketplace to broad HR |
| Dice (dice.com) | US-centric — all listings require US location/timezone | Not useful for worldwide remote |

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
