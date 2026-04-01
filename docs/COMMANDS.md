# Commands Reference

Commands for Claude Code to execute when maintaining the job board app.

## How It Works

The app generates search prompts (saved to `data/user/command-prompt.txt` and `data/user/pending-search.json`). You tell Claude Code to run the search, and Claude searches + writes results directly to `data/user/jobs.json`. **No extra API calls, no extra token cost** — it all happens in your existing Claude Code conversation.

**Quick commands you can say:**
- "Run the job search" — reads pending-search.json and executes
- "Search for frontend jobs in Europe" — direct search
- "Search local boards in Lithuania" — local search
- "Check Rockstar and EA for jobs" — company search
- "Audit my job list" — remove expired jobs
- "Add this job: [url]" — manual add

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
