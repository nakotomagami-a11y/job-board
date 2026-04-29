# Browser-side scrape prompt

**Primary path for bot-blocked boards.** Use this with the [Claude for Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) extension whenever a board blocks our automated scrapers (Wellfound's DataDome, Indeed's Cloudflare, Glassdoor's bot detection, HiringCafe, startup.jobs, Weekday's login wall, JustRemote's heavy-JS render) or when you want to harvest job posts from your authenticated LinkedIn feed.

## Fallback hierarchy

When automated subagents return `[]` because of anti-bot detection, the priority is:

1. **Claude for Chrome (this prompt)** — primary, automated. The extension runs Claude inside your authenticated browser tab; with the desktop app paired, it does the scrape end-to-end and POSTs results straight to `http://localhost:3000/api/storage/jobs` (the storage route has CORS open for this). Not a copy-paste workflow.
2. **BrowserMCP** (`.mcp.json` registers `@browsermcp/mcp`) — fallback. Claude Code drives your already-open tab via the [browsermcp.io](https://browsermcp.io) Chrome/Brave extension. Use this when Claude for Chrome isn't running, or when you want the parent agent to orchestrate a repeated sweep.
3. **Manual paste** — last resort. You dump raw HTML or a list of job cards and ask Claude Code to parse them.

## How to use

1. Make sure the Next.js dev server is running locally (`yarn dev` — endpoint is `http://localhost:3000`).
2. Open one of the URLs from [§ Starter URLs](#starter-urls) in Brave/Chrome with your normal logged-in session.
3. Open the Claude extension on that tab.
4. Paste the prompt block below, replacing `__TODAY__` with today's date.
5. The extension will scrape and POST the results into our pipeline. The freshness filter (7-day), the hard-reject rubric, and dedup all run server-side — no need to perfect the filtering on your side.

## The prompt to paste

```
You are scraping the current page for frontend / mobile engineering job listings for a remote-first React/React Native/TypeScript candidate.

TODAY: __TODAY__
FRESHNESS CUTOFF: postedDate must be >= TODAY - 7 days. Drop anything older. Drop anything without a visible posted date — we cannot prove freshness, so it doesn't go in.

HARD FILTERS — every kept job MUST satisfy ALL:
- Remote work allowed (location is "Remote" / global / worldwide, OR the listing explicitly allows remote)
- Salary >= $80k/yr if a salary IS listed (allow if unlisted — unlisted is fine, do not drop)
- Role type is one of: Frontend, Mobile, React Native, React, JavaScript, TypeScript, UI Engineer, Full-Stack (frontend-leaning). Drop pure backend, devops, data, PM, QA, recruiter, marketing, design (non-engineering), Solidity-only, or staff-augmentation listings with no tech.
- Tech stack overlaps with at least one of: React, React Native, TypeScript, JavaScript, Next.js, Vue, Mobile, iOS, Android, Frontend.

OUTPUT SCHEMA — one entry per job. Match this exactly:
{
  "id": "company-slug-shortdesc-4charhash",
  "title": "Exact title from the listing",
  "company": "Company name",
  "companyType": "Startup" | "AAA Game Studio" | "Indie Game Studio" | "Gaming Platform" | "Tech Giant" | "Gaming Hardware" | "Dev Tools" | "Other",
  "location": "City, Country" | "Remote",
  "region": "Remote" | "Europe" | "North America" | "Asia" | "UK" | "Hybrid",
  "roleType": "Frontend" | "Mobile" | "Full-Stack (Frontend-leaning)" | "Design Engineer" | "Creative Developer",
  "seniority": "Junior" | "Mid" | "Senior" | "Staff" | "Principal" | "Lead" | "Manager",
  "url": "https://direct-application-url-not-the-search-page",
  "tags": ["React", "TypeScript", "..."],
  "salary": "$120k-$150k" | null,
  "postedDate": "YYYY-MM-DD",
  "verifiedDate": "__TODAY__",
  "source": "linkedin" | "wellfound" | "linkedin-feed" | "hiring-cafe" | "startup-jobs" | "weekday" | etc,
  "remote": true,
  "category": "Gaming" | "Crypto / Web3" | "AI / ML" | "Fintech" | "SaaS / Dev Tools" | "E-Commerce" | "Social / Community" | "Other",
  "sourceType": "agent",
  "description": "1-2 sentence summary"
}

PROCESS:
1. Scroll the page so all visible listings are loaded (LinkedIn / Wellfound paginate via scroll).
2. For each listing visible on the page, read title, company, location, and the posted-date label ("2 days ago", "1 week ago", an absolute date, etc.) and convert to YYYY-MM-DD relative to TODAY.
3. HARD RULE on dates — if a listing has no visible posted-date label on the card, click into its detail page to find the exact "Posted N days ago" or absolute date. If even the detail page doesn't surface a date, SKIP THE LISTING. Never invent a date, never substitute today's date, never use the URL filter (`fromage=7`, `f_TPR=r604800`) as a stand-in for the actual postedDate. The storage layer rejects dateless entries server-side anyway.
4. If a listing's posted-date is older than 7 days, SKIP IT.
5. If clicking the listing opens a side panel or detail page, harvest the apply URL (the "Apply on company website" link or the canonical job URL — never the search-results URL).
6. Skip Easy Apply roles unless no other URL is available — for those, use the LinkedIn `/jobs/view/{ID}` URL.
7. Cap at 25 jobs per session. Quality over quantity.
8. POST the result to the local pipeline (CORS is open on this endpoint):
   ```js
   fetch("http://localhost:3000/api/storage/jobs", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(jobs)  // the array you built
   }).then(r => r.json()).then(console.log)
   ```
   The response will look like `{ added, total, rejectedByRubric, rejectedAsStale }`. Report it back to the user — done in one shot, no copy-paste.
```

## Starter URLs

Paste the prompt above on any of these. Replace your candidate skills/keywords as needed.

### LinkedIn — job search (Worldwide scope)

⚠️ Always include `&geoId=92000000` (Worldwide) — without it, LinkedIn auto-pins the search to your profile country (e.g. Lithuania) and the result count collapses from ~thousands to ~100. Worldwide remote is what we want.

- React: <https://www.linkedin.com/jobs/search/?keywords=react&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- React Native: <https://www.linkedin.com/jobs/search/?keywords=react%20native&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- Frontend Engineer: <https://www.linkedin.com/jobs/search/?keywords=frontend%20engineer&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- TypeScript Engineer: <https://www.linkedin.com/jobs/search/?keywords=typescript%20engineer&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- Mobile Engineer: <https://www.linkedin.com/jobs/search/?keywords=mobile%20engineer&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- Design Engineer: <https://www.linkedin.com/jobs/search/?keywords=design%20engineer&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- Next.js: <https://www.linkedin.com/jobs/search/?keywords=next.js&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>
- UI Engineer: <https://www.linkedin.com/jobs/search/?keywords=ui%20engineer&f_TPR=r604800&f_WT=2&geoId=92000000&sortBy=DD>

Other useful `geoId` values (swap into URL if you want region-scoped fallback): `91000000` European Union · `103644278` United States · `101174742` Canada · `101165590` United Kingdom.

### LinkedIn — your feed
- <https://www.linkedin.com/feed/>

For the feed, modify the prompt's PROCESS step 1: "Scroll until you see ~50 posts. For each post that looks like a job share (someone in your network announcing they're hiring, or reposting a role with a link), extract it as a job listing. The post's relative timestamp ('3d', '2w') is the postedDate." Use `source: "linkedin-feed"`.

### Wellfound (post-CAPTCHA, your session)
- Frontend Engineer, remote: <https://wellfound.com/jobs?role_types[]=Frontend%20Engineer&remote=true>
- React, remote: <https://wellfound.com/jobs?keywords=react&remote=true>
- React Native, remote: <https://wellfound.com/jobs?keywords=react%20native&remote=true>

### HiringCafe
- Frontend, Remote: <https://hiring.cafe/?searchState=%7B%22searchQuery%22%3A%22frontend%22%2C%22workplaceTypes%22%3A%5B%22Remote%22%5D%7D>
- React Native, Remote: <https://hiring.cafe/?searchState=%7B%22searchQuery%22%3A%22react%20native%22%2C%22workplaceTypes%22%3A%5B%22Remote%22%5D%7D>

### startup.jobs
- React, remote: <https://startup.jobs/?remote=true&q=react>
- Frontend, remote: <https://startup.jobs/?remote=true&q=frontend>

### Weekday (requires your account)
- Frontend, remote: <https://jobs.weekday.works/jobs?role=frontend-engineer&workplaceType=remote>

## Handoff to the local pipeline

The prompt above already includes the `fetch()` call back to `http://localhost:3000/api/storage/jobs` — when the extension is paired with the desktop app, this happens automatically and the loop closes itself. CORS is open on this endpoint specifically to allow the Chrome extension running on third-party origins (linkedin.com, wellfound.com, etc.) to POST directly.

If for some reason `fetch()` is blocked (older extension build, off-network, etc.), fall back to copy-paste:

```bash
# paste the JSON array into /tmp/jobs.json first
curl -sf -X POST http://localhost:3000/api/storage/jobs \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/jobs.json | jq
```

The response is always `{ added, total, rejectedByRubric, rejectedAsStale }`. `rejectedAsStale > 0` means a few 7+ day listings slipped through and the server caught them — expected, that's the safety net. `added < input length` means dedup or the rubric did its job.

## After a sweep

```bash
curl -s http://localhost:3000/api/storage/jobs | jq 'length'
curl -s http://localhost:3000/api/storage/jobs | jq '[.[] | select(.source == "linkedin")] | length'
```

Or refresh the dashboard at <http://localhost:3000>.
