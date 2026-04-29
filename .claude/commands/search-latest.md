# Search Latest Jobs

Quick-refresh command that checks **only the latest/first page** of all high-yield job boards for new listings. Designed for **daily use** — fast, parallel, EU-first.

## Instructions

You are searching for the latest job postings across multiple job boards for a frontend/React developer. This is a QUICK SCAN — only check the first page / most recent listings on each board. Do NOT paginate or scroll through all pages.

### Step 1: Read context files

Read these files first:
- `data/user/profile.json` — candidate skills and role preferences
- `data/user/jobs.json` — existing jobs (extract all IDs to avoid duplicates)
- `docs/COMMANDS.md` — search methods (WebFetch vs Browser MCP) and blocked sources list
- `src/shared/config/priority-boards.ts` — board URLs reference

**IMPORTANT: Before searching, read the blocked sources section in COMMANDS.md. Never search or include results from: DailyRemote, RemoteOK, WeWorkRemotely, FlexJobs, micro1, Dice.**

### Step 2: Search these boards in parallel (latest page only)

Launch parallel agents (4 groups). Each agent handles 2-3 boards simultaneously.

**Group A — API & WebFetch boards (fast):**
1. **Remotive API** — `https://remotive.com/api/remote-jobs?category=software-dev&search=react&limit=20` + `&search=frontend&limit=20` + `&search=react+native&limit=20`
2. **Jobicy API** — `https://jobicy.com/api/v2/remote-jobs?count=20&tag=react`
3. **arc.dev** — `https://arc.dev/remote-jobs?search=react` (WebFetch)

**Group B — EU-focused boards (Browser MCP):**
4. **No Fluff Jobs** — `https://nofluffjobs.com/jobs/frontend?criteria=seniority=senior,expert` (Browser MCP)
5. **Just Join IT** — `https://justjoin.it/job-offers/frontend?experience-level=mid,senior` (Browser MCP)
6. **MeetFrank** — `https://meetfrank.com/jobs/frontend` (Browser MCP)
7. **landing.jobs** — `https://landing.jobs/jobs?search=react&remote=true` (WebFetch or Browser MCP)

**Group C — Aggregators & startup boards (WebFetch/Browser MCP):**
8. **LinkedIn Jobs** — WebSearch for `site:linkedin.com/jobs "react" OR "frontend" remote Europe posted:week`
9. **Wellfound** — `https://wellfound.com/role/frontend-engineer` (Browser MCP)
10. **Himalayas** — `https://himalayas.app/jobs/worldwide?q=react+developer&experience=mid-level%2Csenior&type=full-time` (Browser MCP)

**Group D — Additional boards:**
11. **Working Nomads** — `https://www.workingnomads.com/jobs?category=development&tag=react` (Browser MCP)
12. **Built In** — `https://builtin.com/jobs/remote?search=react` (WebFetch)
13. **web3.career** — `https://web3.career/react-jobs` (Browser MCP)

### Step 3: For each board

- Only check the **first page** of results — do NOT paginate
- Only collect jobs posted in the **last 7 days** (skip older listings)
- Skip any job whose ID already exists in `data/user/jobs.json`
- **Reject immediately** any job from a blocked source or spam company (see COMMANDS.md blocked list)
- **Prefer EU/EMEA/Worldwide remote** — deprioritize US-only roles
- For each new job, extract all required fields matching the schema in COMMANDS.md
- Set `sourceType: "claude-search"` and `verifiedDate` to today's date

### Step 4: Save results

- Append all new (non-duplicate) jobs to `data/user/jobs.json`
- Update `data/user/search-batch-state.json`:
  - Set `lastBatchAt` to current timestamp
  - Update `jobsFoundTotal` with new total count
  - Add note to `nextStep`: "Quick scan completed [date] — [N] new jobs found"
- Log a summary: how many boards checked, how many new jobs found, which boards had new listings

### Search filters (from profile)
- **Roles:** Frontend, React, React Native, JavaScript, TypeScript (Developer/Engineer variants)
- **Remote:** Yes, worldwide — **EU/EMEA preferred**
- **Seniority:** Any
- **Recency:** Last 7 days only

### Important rules
- ALWAYS try WebFetch first. Fall back to Browser MCP only for known JS-rendered / 403 boards
- Use parallel Agents to search multiple boards simultaneously for speed
- **NEVER include results from blocked boards:** DailyRemote, RemoteOK, WeWorkRemotely, FlexJobs, micro1
- Do NOT re-search boards that consistently return 0 results (Remote.co, startup.jobs, The Muse, Turing, Toptal, Triplebyte, Hired, Dice)
- Each job MUST have a real apply URL (not a search results page)
- Deduplicate by checking both `id` field AND `url` field against existing jobs
- If a job has no clear location or says "US only" / "must be in US", skip it
