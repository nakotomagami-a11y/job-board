import { NextResponse } from "next/server";
import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import {
  TIER1_BOARDS, TIER2_BOARDS, TIER3_BOARDS,
  ALL_BOARDS,
} from "@shared/config/priority-boards";
import { rateLimit } from "@lib/rate-limit";

export const maxDuration = 60;

const PROJECT_ROOT = process.cwd().replace(/\\/g, "/");
const USER_DIR = path.join(process.cwd(), "data", "user");
const JOBS_PATH = path.join(USER_DIR, "jobs.json");
const PENDING_PATH = path.join(USER_DIR, "pending-search.json");
const BATCH_PATH = path.join(USER_DIR, "search-batch-state.json");

interface SearchConfig {
  regions?: string[];
  roleTypes?: string[];
  seniority?: string[];
  categories?: string[];
  remoteOnly?: boolean;
  localOnly?: boolean;
  salaryMin?: string;
  customQuery?: string;
  countries?: string[];
  maxBoards?: number;
  searchScope?: string;
  parallelMode?: boolean;
}

interface BatchState {
  searchedBoards: string[];
  remainingBoards: string[];
  totalBoards: number;
  startedAt: string;
  lastBatchAt: string;
  jobsFoundTotal: number;
  filters: string;
}

// Process-wide mutex so two concurrent batch searches can't both read the
// same `search-batch-state.json`, both compute the next batch, and both write
// — leaving the second writer's view of "remaining boards" stale.
let batchMutex: Promise<unknown> = Promise.resolve();
function withBatchLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = batchMutex.then(fn, fn);
  batchMutex = next.catch(() => {});
  return next;
}

function getExistingIds(): string[] {
  try { return JSON.parse(readFileSync(JOBS_PATH, "utf-8")).map((j: { id: string }) => j.id); }
  catch { return []; }
}

function getBatchState(): BatchState | null {
  try { return JSON.parse(readFileSync(BATCH_PATH, "utf-8")); }
  catch { return null; }
}

function abs(relPath: string): string {
  return `${PROJECT_ROOT}/${relPath}`;
}

function buildSearchPrompt(config?: SearchConfig): { prompt: string; batchState: BatchState } {
  const existingIds = getExistingIds();

  // Filters for the pending-search.json
  const filterParts: string[] = [];
  if (config?.regions?.length) filterParts.push(`Regions: ${config.regions.join(", ")}`);
  if (config?.remoteOnly) filterParts.push("Remote positions ONLY");
  if (config?.roleTypes?.length) filterParts.push(`Role types: ${config.roleTypes.join(", ")}`);
  if (config?.seniority?.length) filterParts.push(`Seniority: ${config.seniority.join(", ")}`);
  if (config?.categories?.length) filterParts.push(`Industries: ${config.categories.join(", ")}`);
  if (config?.salaryMin) filterParts.push(`Min salary: $${config.salaryMin}/yr`);
  if (config?.customQuery) filterParts.push(`Focus: ${config.customQuery}`);
  if (config?.countries?.length) {
    filterParts.push(`${config.localOnly ? "LOCAL ONLY" : "Also local"}: ${config.countries.join(", ")}`);
  }

  // Determine boards for batch tracking
  const maxBoards = config?.maxBoards || 4;
  const existingBatch = getBatchState();
  const allBoardsOrdered = config?.searchScope === "focused"
    ? [...TIER1_BOARDS, ...TIER2_BOARDS, ...TIER3_BOARDS]
    : ALL_BOARDS;

  let boardsForThisBatch: string[];
  if (existingBatch && existingBatch.remainingBoards.length > 0) {
    boardsForThisBatch = existingBatch.remainingBoards.slice(0, maxBoards);
  } else {
    boardsForThisBatch = allBoardsOrdered.slice(0, maxBoards);
  }

  const searchedSoFar = existingBatch?.searchedBoards || [];
  const afterThisBatch = [...searchedSoFar, ...boardsForThisBatch];
  const remaining = allBoardsOrdered.filter(b => !afterThisBatch.includes(b));

  const batchState: BatchState = {
    searchedBoards: afterThisBatch,
    remainingBoards: remaining,
    totalBoards: allBoardsOrdered.length,
    startedAt: existingBatch?.startedAt || new Date().toISOString(),
    lastBatchAt: new Date().toISOString(),
    jobsFoundTotal: existingBatch?.jobsFoundTotal || 0,
    filters: filterParts.join("; ") || "broad",
  };

  // Minimal prompt — Claude reads the files itself
  const parallelEnabled = config?.parallelMode && boardsForThisBatch.length > 1;

  const parallelInstructions = parallelEnabled ? `

PARALLEL MODE ENABLED — search all ${boardsForThisBatch.length} boards simultaneously:
- Launch one Agent per board using the Agent tool (all in a single message for true parallelism)
- Each agent searches ONE board and returns found jobs as JSON
- After ALL agents complete, merge results, deduplicate against existing ${existingIds.length} jobs, and append to jobs.json
- If an agent fails, log the error and continue with results from the others` : "";

  const sequentialNote = !parallelEnabled && boardsForThisBatch.length > 1
    ? "\nSearch boards one by one, sequentially." : "";

  const prompt = `Run the CHECK_NEW_JOBS command for the JobHunt app.

Project: ${PROJECT_ROOT}
Read these files for context:
- ${abs("docs/COMMANDS.md")} — full instructions and JSON format
- ${abs("data/user/profile.json")} — candidate skills and preferences
- ${abs("data/user/jobs.json")} — existing ${existingIds.length} jobs (skip duplicates)
- ${abs("data/user/search-batch-state.json")} — batch progress
- ${abs("src/shared/config/priority-boards.ts")} — all board URLs

This batch: search these ${boardsForThisBatch.length} boards:
${boardsForThisBatch.map((b, i) => `${i + 1}. ${b}`).join("\n")}
${filterParts.length > 0 ? `\nFilters: ${filterParts.join(", ")}` : ""}
${searchedSoFar.length > 0 ? `\nBatch progress: ${searchedSoFar.length}/${allBoardsOrdered.length} done, ${remaining.length} remaining after this.` : ""}${parallelInstructions}${sequentialNote}

After searching: append jobs to ${abs("data/user/jobs.json")}, update ${abs("data/user/search-batch-state.json")}, and log in ${abs("docs/SEARCH_LOG.md")}.`;

  return { prompt, batchState };
}

function buildLocalSearchPrompt(countries: string[]): string {
  const existingIds = getExistingIds();

  return `Run LOCAL_SEARCH for the JobHunt app.

Project: ${PROJECT_ROOT}
Read: ${abs("docs/COMMANDS.md")} for instructions, ${abs("data/user/profile.json")} for candidate info.

Countries to search: ${countries.join(", ")}
Discover local job boards for each country, search for frontend/React/mobile jobs.
Append to ${abs("data/user/jobs.json")} (${existingIds.length} existing, skip duplicates).
Update ${abs("docs/SEARCH_LOG.md")}.`;
}

function buildLinkedInFeedPrompt(): string {
  const existingIds = getExistingIds();
  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return `Run LINKEDIN_FEED_SCAN for the JobHunt app.

Project: ${PROJECT_ROOT}
Today: ${today}
Deadline: ${deadline} — HARD STOP at this time regardless of progress. Save whatever you have and exit.
Existing jobs: ${existingIds.length} (skip duplicates by URL or company+title combo)

Use the Chrome MCP browser tools to doom-scroll the LinkedIn feed and extract job posts.

═══ STEP 1: Navigate & sort by Most Recent ═══

1a. Navigate to: https://www.linkedin.com/feed/

1b. Wait 3s for feed to load.

1c. Click "Most recent first" via javascript_tool:
    (async () => {
      const btn = Array.from(document.querySelectorAll('*')).find(
        el => el.innerText?.trim() === 'Select feed view: Most recent first'
      );
      if (btn) btn.click();
    })()

1d. Wait 2s for the feed to re-sort.

═══ STEP 2: Scroll & collect raw post texts ═══

Scroll the feed's main container (NOT window) in a loop. Use this scroll snippet:
    document.querySelector('main').scrollTop += 1400

Do 8–10 scroll iterations, waiting 2s between each. After each scroll, extract visible post containers using this snippet:
    (() => {
      const socialBars = Array.from(document.querySelectorAll('*')).filter(
        el => el.innerText?.trim() === 'Like\\nComment\\nRepost\\nSend'
      );
      return socialBars.map(bar => {
        let el = bar;
        for (let i = 0; i < 5; i++) el = el.parentElement || el;
        const links = Array.from(el.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(h => h.includes('linkedin.com'))
          .slice(0, 3);
        return { text: el.innerText.slice(0, 1200), links };
      });
    })()

Accumulate all unique posts (deduplicate by first 80 chars of text). Stop immediately if current time >= deadline.

═══ STEP 3: Classify — THIS IS THE MOST IMPORTANT STEP ═══

The LinkedIn feed is FULL of noise. For EVERY collected post, you must decide:
IS THIS A GENUINE JOB OPPORTUNITY or NOT?

A post IS a job opportunity if it:
  ✓ Explicitly announces an open position (role title + company)
  ✓ Is a LinkedIn native "Promoted" job ad card with a job title
  ✓ A recruiter or hiring manager posting "We're hiring a [role]"
  ✓ A company page post with "Apply here" / "Join our team" + specific role

A post is NOT a job opportunity if it is:
  ✗ Career advice, tips, motivational content
  ✗ "Like if you agree" / engagement bait
  ✗ News articles (Bloomberg, Reuters, Business Insider, etc.)
  ✗ Coursera / LinkedIn Learning certificates
  ✗ Programming memes or jokes
  ✗ Reposts without a concrete role listed
  ✗ Someone announcing they started a new job (vs. hiring)
  ✗ Product launches, company milestones without job openings
  ✗ Interview prep content, coding challenges

For each post classified as a job opportunity, also check: is the role relevant?
Keep ONLY: Frontend Engineer, Software Engineer, React Developer, Frontend Developer,
UI Engineer, Full-Stack (frontend-leaning), TypeScript Developer, Next.js Developer.
Discard: DevOps, Backend-only, Data Science, Sales, Marketing, Design-only, etc.

═══ STEP 4: Build Job objects ═══

For each post that passed classification, extract a Job object:
{
  id: "linkedin-feed-<slugified-company>-<slugified-title>",
  title: "<exact job title>",
  company: "<company name>",
  companyType: <infer: "Startup" | "Tech Giant" | "Agency" | "SaaS / Dev Tools" | "Fintech" | "E-Commerce" | "Other">,
  location: "<city, country or Remote>",
  region: <infer: "Remote" | "Europe" | "North America" | "UK" | "Asia" | "Hybrid">,
  remote: <true if "remote" appears in title or location>,
  roleType: <"Frontend" | "Full-Stack (Frontend-leaning)" | "Mobile" | "Design Engineer">,
  seniority: <infer from title: "Junior" | "Mid" | "Senior" | "Staff" | "Lead" | "Manager">,
  url: "<best LinkedIn URL from post links, prefer /jobs/ link>",
  tags: [<tech tags: "React", "TypeScript", "Next.js", etc.>],
  postedDate: "<YYYY-MM-DD from 'X days/hours ago' relative to ${today}>",
  verifiedDate: "${today}",
  source: "LinkedIn Feed",
  sourceType: "claude-search",
  category: <infer: "Gaming" | "Crypto / Web3" | "AI / ML" | "Fintech" | "SaaS / Dev Tools" | "E-Commerce" | "Social / Community" | "Other">
}

═══ STEP 5: Save ═══

5a. Deduplicate against existing ${existingIds.length} jobs — skip same URL or same company+title.
5b. Read ${abs("data/user/jobs.json")}, append new jobs, write back.
5c. Report: "Added X new jobs from LinkedIn Feed. Scanned Y posts, Y were job opportunities, Y matched role filter."`;
}

function buildLinkedInApplyPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const jobsPath = abs("data/user/jobs.json");
  const profilePath = abs("data/user/profile.json");
  const auditPath = abs("data/user/apply-audit.json");

  let linkedInJobs: { id: string; title: string; company: string; url: string; source: string }[] = [];
  try {
    const all = JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
    linkedInJobs = all.filter((j: { source?: string; applied?: boolean; rejected?: boolean }) =>
      j.source?.toLowerCase().includes("linkedin") && !j.applied && !j.rejected
    ).map((j: { id: string; title: string; company: string; url: string; source: string }) => ({
      id: j.id, title: j.title, company: j.company, url: j.url, source: j.source,
    }));
  } catch { /* no jobs yet */ }

  return `Run LINKEDIN_AUTO_APPLY for the JobHunt app.

Project: ${PROJECT_ROOT}
Today: ${today}
Jobs to process: ${linkedInJobs.length} unapplied LinkedIn jobs

Read ${profilePath} for candidate profile data.

════════════════════════════════════════
PHASE 1 — AUDIT ONLY. DO NOT APPLY YET.
════════════════════════════════════════

Visit each job URL below using the Chrome MCP browser tools.
For each job, determine:
  a) Is the URL a direct job posting or a recruiter profile?
  b) Does it have a LinkedIn "Easy Apply" button, an external apply link, or neither?
  c) What form fields does the application require? Read the form carefully.
  d) Which fields can be answered from profile.json (name, email, location, skills, CV)?
  e) Which fields are MISSING from the profile:
       - Phone number
       - LinkedIn profile URL
       - Portfolio / website URL
       - Work authorisation / right to work in the job's country
       - Expected salary
       - Notice period / earliest start date
       - Years of total experience (number)
       - Cover letter (yes/no — does the form require one?)
       - Any custom screening questions (list them verbatim)

Jobs to audit:
${linkedInJobs.map((j, i) => `${i + 1}. [${j.id}] ${j.title} @ ${j.company}\n   URL: ${j.url}\n   Source: ${j.source}`).join("\n\n")}

════════════════════════════════════════
PHASE 2 — REPORT. WAIT FOR CONFIRMATION.
════════════════════════════════════════

After visiting ALL jobs, write your findings to ${auditPath} as JSON:
[
  {
    "id": "<job id>",
    "title": "<title>",
    "company": "<company>",
    "url": "<url>",
    "applyType": "easy-apply" | "external" | "recruiter-profile" | "dead-link",
    "externalApplyUrl": "<url if different from job url>",
    "readyToApply": true | false,
    "missingData": ["phone", "portfolio", ...],
    "customQuestions": ["Question text here?", ...],
    "needsCoverLetter": true | false,
    "notes": "<any other observations>"
  }
]

Then output a HUMAN-READABLE SUMMARY to the user in this format:

╔══ AUTO-APPLY AUDIT — ${today} ══╗

For each job:
  ✅ READY  — [title] @ [company] ([applyType])
  ⚠️  NEEDS  — [title] @ [company]: missing [phone, portfolio, ...]
  ❌ SKIP   — [title] @ [company]: [dead link / recruiter profile / no apply button]

Then list ALL missing data fields across all jobs (deduplicated), e.g.:
  Missing across jobs:
  • Phone number (needed by 3 jobs)
  • Portfolio URL (needed by 2 jobs)
  • Expected salary (needed by 1 job)

Then ask:
"Please provide the missing data above, then tell me which jobs to apply to (e.g. 'apply to job 1 and 3').
⚠️  I will NOT submit any application until you explicitly confirm each one."

════════════════════════════════════════
PHASE 3 — APPLY (only after user confirms)
════════════════════════════════════════

Only proceed to this phase when the user explicitly says which jobs to apply to.

For each confirmed job:
1. Navigate to the job URL (or externalApplyUrl if different).
2. Click "Easy Apply" or the apply button.
3. Fill in all form fields using profile data + any data the user provided.
4. For cover letters: write a concise, tailored 3-paragraph cover letter using the candidate's CV and the job description. Show it to the user before submitting.
5. For custom screening questions: answer using profile data, showing each answer to the user before proceeding.
6. STOP before the final "Submit" button. Show the user:
   "About to submit application for [title] @ [company]. All fields filled. Ready?"
7. Only click Submit after the user says yes/confirmed.
8. After successful submission:
   - Update ${jobsPath}: set applied=true, appliedDate="${today}" for that job id.
   - Tell the user: "Applied to [title] @ [company] ✅"

If anything goes wrong (CAPTCHA, login wall, broken form), stop and report to the user.`;
}

function buildCompanySearchPrompt(companies: { name: string; careersUrl: string }[]): string {
  const existingIds = getExistingIds();
  const companyList = companies.map(c =>
    c.careersUrl ? `${c.name} (${c.careersUrl})` : c.name
  ).join(", ");

  return `Run COMPANY_SEARCH for the JobHunt app.

Project: ${PROJECT_ROOT}
Read: ${abs("docs/COMMANDS.md")} for instructions, ${abs("data/user/profile.json")} for candidate info.

Companies: ${companyList}
Check their career pages + LinkedIn for frontend/React/mobile positions.
Append to ${abs("data/user/jobs.json")} (${existingIds.length} existing, skip duplicates).
Update ${abs("docs/SEARCH_LOG.md")}.`;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, { bucket: "run-command", limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await req.json();
  const { command, countries, companies, searchConfig } = body;

  try {
    if (command === "audit") return handleAudit();
    if (command === "clear-all") return handleClearAll();
    if (command === "reset-batch") return handleResetBatch();

    let prompt = "";
    let searchType = "";
    let batchInfo: BatchState | null = null;

    if (command === "linkedin-feed") {
      prompt = buildLinkedInFeedPrompt();
      searchType = "linkedin-feed";
    } else if (command === "linkedin-apply") {
      prompt = buildLinkedInApplyPrompt();
      searchType = "linkedin-apply";
    } else if (command === "search") {
      const result = await withBatchLock(async () => {
        const built = buildSearchPrompt(searchConfig);
        // Persist the new batch state inside the lock so a concurrent caller
        // sees the updated `searchedBoards` before computing its own batch.
        await fs.writeFile(BATCH_PATH, JSON.stringify(built.batchState, null, 2));
        // Auto-reset once every board in the rotation has been searched, so
        // the next "search" naturally starts a fresh sweep instead of
        // returning an empty board list.
        if (built.batchState.remainingBoards.length === 0) {
          await fs.writeFile(BATCH_PATH, "{}");
        }
        return built;
      });
      prompt = result.prompt;
      batchInfo = result.batchState;
      searchType = "search";
    } else if (command === "local-search") {
      prompt = buildLocalSearchPrompt(countries);
      searchType = "local-search";
    } else if (command === "company-search") {
      prompt = buildCompanySearchPrompt(companies);
      searchType = "company-search";
    } else {
      return NextResponse.json({ error: "Unknown command" }, { status: 400 });
    }

    // Save prompt and pending search (batch state is written inside the lock above)
    const promptPath = path.join(USER_DIR, "command-prompt.txt");
    await fs.writeFile(promptPath, prompt);

    await fs.writeFile(PENDING_PATH, JSON.stringify({
      type: searchType,
      config: searchConfig || { countries, companies },
      createdAt: new Date().toISOString(),
      batchState: batchInfo,
    }, null, 2));

    return NextResponse.json({
      mode: "prompt",
      prompt,
      message: `Search prompt generated. Tell Claude Code: "Run the job search"`,
      searchType,
      batchState: batchInfo,
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Status codes that mean "this listing is gone for good".
// 5xx, 429, network errors etc. are treated as transient and the job is kept.
const DEAD_STATUSES = new Set([404, 410]);
const HEALTH_TIMEOUT_MS = 6000;
const HEALTH_CONCURRENCY = 8;

interface AuditedJob {
  postedDate: string;
  url?: string;
  applied?: boolean;
}

async function checkLink(url: string): Promise<"alive" | "dead"> {
  try {
    new URL(url);
  } catch {
    return "dead";
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 JobHuntLinkCheck/1.0" },
    });
    // Some sites reject HEAD with 405/403 — retry with GET before declaring dead.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 JobHuntLinkCheck/1.0" },
      });
    }
    return DEAD_STATUSES.has(res.status) ? "dead" : "alive";
  } catch {
    // Network error / timeout — treat as alive (don't punish transient failures).
    return "alive";
  } finally {
    clearTimeout(timer);
  }
}

// Total budget for the link-check phase. Anything still pending when this
// elapses is left as alive — we'd rather under-prune than nuke valid jobs.
const HEALTH_BUDGET_MS = 45_000;

async function checkLinksParallel(jobs: AuditedJob[]): Promise<Set<number>> {
  const deadIndices = new Set<number>();
  const deadline = Date.now() + HEALTH_BUDGET_MS;
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < HEALTH_CONCURRENCY; i++) {
    workers.push((async () => {
      while (Date.now() < deadline) {
        const idx = cursor++;
        if (idx >= jobs.length) return;
        const job = jobs[idx];
        if (!job.url) continue;
        const result = await checkLink(job.url);
        if (result === "dead") deadIndices.add(idx);
      }
    })());
  }
  await Promise.all(workers);
  return deadIndices;
}

async function handleAudit() {
  try {
    const jobs: AuditedJob[] = JSON.parse(await fs.readFile(JOBS_PATH, "utf-8"));
    const now = new Date();

    // Step 1: drop anything older than 30 days.
    const recent = jobs.filter((j) => {
      const days = Math.floor((now.getTime() - new Date(j.postedDate).getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    });
    const removedByDate = jobs.length - recent.length;

    // Step 2: link health check on the survivors. Skip jobs the user already
    // applied to — even if the listing is gone, we want to keep the record.
    const checkable = recent.map((j, i) => ({ job: j, originalIndex: i }))
      .filter(({ job }) => !job.applied && !!job.url);
    const deadCheckable = await checkLinksParallel(checkable.map((c) => c.job));
    const deadOriginalIndices = new Set(
      [...deadCheckable].map((i) => checkable[i].originalIndex)
    );

    const alive = recent.filter((_, i) => !deadOriginalIndices.has(i));
    const removedByLink = recent.length - alive.length;

    await fs.writeFile(JOBS_PATH, JSON.stringify(alive, null, 2));
    return NextResponse.json({
      message: `Removed ${removedByDate} old + ${removedByLink} dead links. ${alive.length} remaining.`,
      removedByDate,
      removedByLink,
      remaining: alive.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function handleClearAll() {
  try {
    await fs.writeFile(JOBS_PATH, "[]");
    return NextResponse.json({ message: "All jobs cleared.", remaining: 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function handleResetBatch() {
  try {
    await fs.writeFile(BATCH_PATH, "{}");
    return NextResponse.json({ message: "Batch state reset. Next search starts fresh." });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
