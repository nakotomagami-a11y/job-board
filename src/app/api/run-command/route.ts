import { NextResponse } from "next/server";
import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import {
  boardLabel,
  getBoardsForScope,
  sortBoardsByRegionPriority,
  type JobBoard,
} from "@shared/config/priority-boards";
import { rateLimit } from "@lib/rate-limit";
import { readBoardStatsSync, lowYieldBoards } from "@lib/board-stats";
import { hashQuery, readSearchHistorySync, pruneRecentlySearched, recordSearches } from "@lib/search-history";
import type { Job } from "@shared/types/job";

// Route only generates a prompt + writes a few small JSON files; should never
// take more than a couple seconds.
export const maxDuration = 10;

const PROJECT_ROOT = process.cwd().replace(/\\/g, "/");
const USER_DIR = path.join(process.cwd(), "data", "user");
const JOBS_PATH = path.join(USER_DIR, "jobs.json");
const PROFILE_PATH = path.join(USER_DIR, "profile.json");
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

interface ExistingJob {
  id: string;
  company?: string;
  title?: string;
}

function getExistingJobs(): ExistingJob[] {
  try { return JSON.parse(readFileSync(JOBS_PATH, "utf-8")) as ExistingJob[]; }
  catch { return []; }
}

interface RejectedHint {
  company?: string;
  title?: string;
  tags?: string[];
}

function getRejectedHints(limit = 12): RejectedHint[] {
  try {
    const all = JSON.parse(readFileSync(JOBS_PATH, "utf-8")) as Job[];
    return all
      .filter((j) => j.rejected)
      .slice(-limit)
      .map((j) => ({ company: j.company, title: j.title, tags: j.tags }));
  } catch {
    return [];
  }
}

interface ProfileSnapshot {
  skills?: string[];
  preferredRoles?: string[];
  preferredSeniority?: string[];
  preferredRegions?: string[];
  preferredCategories?: string[];
  remotePreference?: string;
}

function getProfile(): ProfileSnapshot | null {
  try { return JSON.parse(readFileSync(PROFILE_PATH, "utf-8")) as ProfileSnapshot; }
  catch { return null; }
}

function getBatchState(): BatchState | null {
  try { return JSON.parse(readFileSync(BATCH_PATH, "utf-8")); }
  catch { return null; }
}

function abs(relPath: string): string {
  return `${PROJECT_ROOT}/${relPath}`;
}

interface BuiltSearch {
  prompt: string;
  batchState: BatchState;
  queryHash: string;
  boardsSearched: string[];
}

function buildSearchPrompt(config?: SearchConfig): BuiltSearch {
  const existingJobs = getExistingJobs();
  const profile = getProfile();
  const rejectedHints = getRejectedHints();

  // HARD constraints — every kept job must satisfy these (filter rejects, not preferences).
  const hardConstraints: string[] = [];
  // SOFT preferences — bias toward but don't reject for missing them.
  const softConstraints: string[] = [];

  if (config?.regions?.length) hardConstraints.push(`Region in: ${config.regions.join(", ")}`);
  if (config?.remoteOnly) hardConstraints.push("Remote work allowed (remote: true)");
  if (config?.roleTypes?.length) hardConstraints.push(`Role type in: ${config.roleTypes.join(", ")}`);
  if (config?.seniority?.length) hardConstraints.push(`Seniority in: ${config.seniority.join(", ")}`);
  if (config?.salaryMin) hardConstraints.push(`Salary >= $${config.salaryMin}/yr when listed (allow if unlisted)`);
  if (config?.categories?.length) softConstraints.push(`Prefer industries: ${config.categories.join(", ")}`);
  if (config?.customQuery) softConstraints.push(`Focus area: ${config.customQuery}`);
  if (config?.countries?.length) {
    if (config.localOnly) hardConstraints.push(`Country in: ${config.countries.join(", ")}`);
    else softConstraints.push(`Also include local roles in: ${config.countries.join(", ")}`);
  }

  // Stable hash of the search semantics — used to skip boards we already
  // queried with this exact filter set in the last 24h.
  const queryHash = hashQuery({
    regions: config?.regions,
    roleTypes: config?.roleTypes,
    seniority: config?.seniority,
    categories: config?.categories,
    remoteOnly: config?.remoteOnly,
    localOnly: config?.localOnly,
    salaryMin: config?.salaryMin,
    customQuery: config?.customQuery,
    countries: config?.countries,
    searchScope: config?.searchScope,
  });

  // Determine board pool: drop low-yield boards and any searched recently
  // with this query. Auto-deprioritized boards still appear in the rotation
  // eventually (after the recent ones are exhausted).
  const stats = readBoardStatsSync();
  const lowYield = new Set(lowYieldBoards(stats, { threshold: 0.1, minSubmissions: 20 }));
  const history = readSearchHistorySync();

  const maxBoards = config?.maxBoards || 4;
  const existingBatch = getBatchState();

  // Region priority drives the rotation order: top entry in profile.preferredRegions
  // (or the explicit config.regions filter) is hit first, then later entries, then
  // global aggregators, then off-region boards. Within each priority bucket we sort
  // by tier ascending so high-volume boards (LinkedIn) come before niche ones.
  const regionPriority =
    config?.regions?.length ? config.regions :
    profile?.preferredRegions?.length ? profile.preferredRegions :
    [];

  const scopedBoards: JobBoard[] = getBoardsForScope(config?.searchScope);
  const sortedBoards = sortBoardsByRegionPriority(scopedBoards, regionPriority);
  const allBoardsOrdered = sortedBoards
    .map(boardLabel)
    .filter((label) => !lowYield.has(label));

  let candidateBoards: string[];
  if (existingBatch && existingBatch.remainingBoards.length > 0) {
    candidateBoards = existingBatch.remainingBoards.slice(0, maxBoards * 2);
  } else {
    candidateBoards = allBoardsOrdered.slice(0, maxBoards * 2);
  }

  // Skip any of those boards we just searched with the same query.
  const { fresh, skipped } = pruneRecentlySearched(candidateBoards, queryHash, history);
  const boardsForThisBatch = (fresh.length > 0 ? fresh : candidateBoards).slice(0, maxBoards);

  const searchedSoFar = existingBatch?.searchedBoards || [];
  const afterThisBatch = [...searchedSoFar, ...boardsForThisBatch];
  const remaining = allBoardsOrdered.filter((b) => !afterThisBatch.includes(b));

  const filtersSummary = [...hardConstraints, ...softConstraints].join("; ") || "broad";

  const batchState: BatchState = {
    searchedBoards: afterThisBatch,
    remainingBoards: remaining,
    totalBoards: allBoardsOrdered.length,
    startedAt: existingBatch?.startedAt || new Date().toISOString(),
    lastBatchAt: new Date().toISOString(),
    jobsFoundTotal: existingBatch?.jobsFoundTotal || 0,
    filters: filtersSummary,
  };

  const parallelEnabled = config?.parallelMode && boardsForThisBatch.length > 1;
  const parallelInstructions = parallelEnabled ? `

PARALLEL MODE — delegate each board to a cheap Haiku subagent:
- Launch ONE \`job-board-scraper\` subagent per board, all in a single message for real parallelism.
  (See \`.claude/agents/job-board-scraper.md\` — it runs on Haiku 4.5 for cost efficiency.)
- Pass each subagent: the board name/URL, the hard filters above, and the candidate's top skills.
- Each subagent returns a JSON array; you (the parent) merge them and POST to \`/api/storage/jobs\`.
- The storage route applies the hard-reject rubric server-side and dedupes — you don't need to
  refilter perfectly, just hand off broad-but-relevant results.
- If a subagent fails, log it and continue with the others.` : `

DELEGATE EACH BOARD TO HAIKU:
- For each board, launch the \`job-board-scraper\` subagent (defined in \`.claude/agents/job-board-scraper.md\`,
  runs on Haiku 4.5 — much cheaper than doing the scrape yourself).
- Pass it the board, the hard filters, and the candidate's top skills.
- Merge returned arrays and POST to \`/api/storage/jobs\` once. The route applies the rubric and dedupes.`;

  const sequentialNote = !parallelEnabled && boardsForThisBatch.length > 1
    ? "\nLaunch the subagents one-by-one (sequentially) if you want to stay under the rate limit." : "";

  // Inline profile so the agent doesn't have to fetch it just to apply the rubric.
  const profileSummary = profile
    ? [
        `Skills: ${(profile.skills ?? []).slice(0, 12).join(", ") || "(none recorded)"}`,
        `Preferred roles: ${(profile.preferredRoles ?? []).join(", ") || "Frontend, Mobile"}`,
        `Preferred seniority: ${(profile.preferredSeniority ?? []).join(", ") || "Mid, Senior"}`,
        `Preferred regions: ${(profile.preferredRegions ?? []).join(", ") || "Remote, Europe"}`,
        `Remote preference: ${profile.remotePreference ?? "remote"}`,
      ].join("\n")
    : "(no profile saved — search broadly for Frontend / Mobile / React / React Native roles)";

  // Top recent jobs as inline dedupe hints. Storage still dedupes after, but
  // pre-filtering avoids wasted searches and re-emitting the same listings.
  const recentDedupe = existingJobs
    .slice(-40)
    .filter((j) => j.company && j.title)
    .map((j) => `- ${j.company} — ${j.title}`)
    .join("\n");

  const negativeExamples = rejectedHints.length
    ? rejectedHints
        .map((r) => `- ${r.company ?? "?"} — ${r.title ?? "?"}${r.tags?.length ? ` [${r.tags.join(", ")}]` : ""}`)
        .join("\n")
    : "(none yet)";

  const skippedNote = skipped.length
    ? `\n(Skipped ${skipped.length} board(s) already searched with this exact filter in the last 24h: ${skipped.join(", ")})`
    : "";

  const prompt = `Run CHECK_NEW_JOBS for the JobHunt app.

Project: ${PROJECT_ROOT}
Reference files (read for full context):
- ${abs("docs/COMMANDS.md")} — JSON schema and search method (WebFetch first, /api/scrape fallback)
- ${abs("data/user/profile.json")} — full candidate profile
- ${abs("data/user/jobs.json")} — existing ${existingJobs.length} jobs (full dedup list)
- ${abs("src/shared/config/priority-boards.ts")} — board URLs

CANDIDATE PROFILE (already extracted — apply during filtering):
${profileSummary}

REGION PRIORITY (the rotation already sorted by this — top entry first):
${regionPriority.length ? regionPriority.map((r, i) => `${i + 1}. ${r}`).join("\n") : "(none — search broadly)"}

THIS BATCH — search these ${boardsForThisBatch.length} board(s):
${boardsForThisBatch.map((b, i) => `${i + 1}. ${b}`).join("\n")}${searchedSoFar.length > 0 ? `\n\nBatch progress: ${searchedSoFar.length}/${allBoardsOrdered.length} done, ${remaining.length} remaining after this.` : ""}${skippedNote}

FREE ATS FETCH (do this FIRST, before any agent search):
- POST \`http://localhost:3000/api/board-fetch\` with no body to pull jobs from all known
  Greenhouse / Lever / Ashby companies (defined in \`src/shared/config/ats-companies.ts\`).
- These come back as ready-to-store JSON — no agent tokens spent. Submit to \`/api/storage/jobs\`.
- Then proceed to the agent-driven board scrape below for boards that don't have public APIs.

LINKEDIN REGION FILTER:
- When a global aggregator (LinkedIn, Indeed, Wellfound, Greenhouse) is in the batch,
  pass the candidate's top-priority region as a location filter so the results match.
- For LinkedIn specifically: ${regionPriority[0] === "Europe" ? "use `&location=European%20Union` (or per-country `&location=Lithuania` etc.) plus `&f_WT=2` for remote-allowed roles" : regionPriority[0] === "Remote" ? "use `&f_WT=2` (remote) without a specific location" : regionPriority[0] ? `use \`&location=${encodeURIComponent(regionPriority[0])}\`` : "search broadly without a location filter"}.

HARD FILTERS — every kept job MUST satisfy ALL of these:
${hardConstraints.length ? hardConstraints.map((c) => `- ${c}`).join("\n") : "- (no hard filters set — apply profile defaults)"}

SOFT PREFERENCES — bias toward but don't reject for missing:
${softConstraints.length ? softConstraints.map((c) => `- ${c}`).join("\n") : "- (none)"}

PRECISION RUBRIC (the storage layer enforces this server-side — your job is to
extract broadly and let it filter):
1. URL is a direct apply page (not a search/listing index).
2. postedDate within last 30 days.
3. roleType in: Frontend, Mobile, Full-Stack (Frontend-leaning), Design Engineer, Creative Developer.
4. Skill overlap > 0 with the candidate's skills above.
5. Not a duplicate of existing jobs (storage dedupes by id + normalized URL + company+title).

NEGATIVE EXAMPLES (the candidate has rejected these — avoid similar):
${negativeExamples}

RECENT EXISTING JOBS (skip duplicates against these):
${recentDedupe || "(none — first search)"}${parallelInstructions}${sequentialNote}

After searching: POST aggregated results to \`http://localhost:3000/api/storage/jobs\` (storage
applies the hard rubric and dedupes; the response tells you how many were rejected vs kept).
Update \`docs/SEARCH_LOG.md\` with one line summarizing this run.`;

  return { prompt, batchState, queryHash, boardsSearched: boardsForThisBatch };
}

function buildLocalSearchPrompt(countries: string[]): string {
  const existing = getExistingJobs();
  const profile = getProfile();
  const skills = (profile?.skills ?? []).slice(0, 12).join(", ") || "React, TypeScript, Next.js";

  return `Run LOCAL_SEARCH for the JobHunt app.

Project: ${PROJECT_ROOT}
Reference: ${abs("docs/COMMANDS.md")} (search method), ${abs("data/user/profile.json")} (full profile).

Countries: ${countries.join(", ")}
Candidate skills: ${skills}

Discover local job boards for each country (e.g. Lithuania → cvbankas.lt; Poland → nofluffjobs.com),
search for Frontend / React / Mobile / React Native roles. Include local-language listings.

PRECISION RUBRIC — reject if URL is a search-results page, postedDate > 30 days, role is unrelated
discipline, or zero skill overlap. Append to ${abs("data/user/jobs.json")} (${existing.length} existing,
skip duplicates by company+title or normalized URL). Append a line to ${abs("docs/SEARCH_LOG.md")}.`;
}

function buildCompanySearchPrompt(companies: { name: string; careersUrl: string }[]): string {
  const existing = getExistingJobs();
  const profile = getProfile();
  const skills = (profile?.skills ?? []).slice(0, 12).join(", ") || "React, TypeScript, Next.js";
  const companyList = companies.map(c =>
    c.careersUrl ? `${c.name} (${c.careersUrl})` : c.name
  ).join(", ");

  return `Run COMPANY_SEARCH for the JobHunt app.

Project: ${PROJECT_ROOT}
Reference: ${abs("docs/COMMANDS.md")} (search method), ${abs("data/user/profile.json")} (full profile).

Companies: ${companyList}
Candidate skills: ${skills}

Check each company's careers page + LinkedIn / Greenhouse / Lever / Ashby boards for Frontend /
Mobile / React / React Native positions.

PRECISION RUBRIC — reject if URL is a search-results page, postedDate > 30 days, role is unrelated
discipline, or zero skill overlap. Append to ${abs("data/user/jobs.json")} (${existing.length} existing,
skip duplicates). Append a line to ${abs("docs/SEARCH_LOG.md")}.`;
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

    if (command === "search") {
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
        // Record the fingerprint so re-running the same search with the same
        // filters skips boards we already hit in the last 24h.
        await recordSearches(built.boardsSearched, built.queryHash);
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
