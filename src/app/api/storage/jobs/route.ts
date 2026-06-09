import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Job } from "@/types/job";
import type { UserProfile } from "@/types/profile";
import { mergeJobs, classifyDiscipline } from "@lib/job-utils";
import { sanitizeJobs } from "@lib/job-utils";
import { recordSubmission, recordRejection } from "@lib/data-access";
import { rubricReject } from "@lib/job-scoring";
import { classifyRegion } from "@lib/job-utils";
import { readBlocklist, isBlocked } from "@lib/data-access";

const USER_JOBS_PATH = path.join(process.cwd(), "data", "user", "jobs.json");
const PROFILE_PATH = path.join(process.cwd(), "data", "user", "profile.json");
const FRESHNESS_DAYS = 7;

// Returns the ISO date (YYYY-MM-DD) cutoff; anything strictly older is stale.
function freshnessCutoff(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - FRESHNESS_DAYS);
  return d.toISOString().slice(0, 10);
}

// Lets the Claude for Chrome extension POST scraped jobs from a third-party
// origin (linkedin.com, wellfound.com, etc.) directly to this localhost API,
// closing the scrape loop without copy-paste. Local-first dev tool; the
// freshness filter, rubric, and dedup still gate everything.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function getProfile(): Promise<UserProfile | null> {
  try { return JSON.parse(await fs.readFile(PROFILE_PATH, "utf-8")) as UserProfile; }
  catch { return null; }
}

async function getJobs(): Promise<Job[]> {
  try {
    const data = await fs.readFile(USER_JOBS_PATH, "utf-8");
    return JSON.parse(data) as Job[];
  } catch {
    return [];
  }
}

export async function GET() {
  const jobs = await getJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  try {
    const submitted = sanitizeJobs((await req.json()) as Job[]);
    const existing = await getJobs();
    const existingIds = new Set(existing.map((j) => j.id));

    // Drop stale or undated listings before any other processing. Jobs older
    // than FRESHNESS_DAYS or without a postedDate never reach the rubric or
    // dedup paths.
    const cutoff = freshnessCutoff();
    const staleRejected: { id: string; postedDate: string | null }[] = [];
    const newJobs: Job[] = submitted.filter((j) => {
      if (!j.postedDate || j.postedDate < cutoff) {
        staleRejected.push({ id: j.id, postedDate: j.postedDate ?? null });
        return false;
      }
      return true;
    });

    // Hard region gate — EU/EEA/UK only. Non-EU jobs are dropped before rubric
    // or dedup so they never touch storage. 'unknown' verdicts (ambiguous or
    // worldwide-remote) are let through for manual review.
    const regionRejected: { id: string; location: string }[] = [];
    const unknownEu: { id: string; location: string }[] = [];
    const afterRegion = newJobs.filter((j) => {
      const verdict = classifyRegion(j.location ?? '', j.region ?? '', j.remote ?? false);
      if (verdict === 'non_eu') {
        regionRejected.push({ id: j.id, location: j.location ?? '' });
        console.log(`[region-filter] rejected non-EU: ${j.id} — "${j.location ?? ''}"`);
        return false;
      }
      if (verdict === 'unknown') {
        unknownEu.push({ id: j.id, location: j.location ?? '' });
        console.log(`[region-filter] let through as unknown: ${j.id} — "${j.location ?? ''}"`);
      }
      return true;
    });

    // Hard company blocklist — drop permanently blocked companies before rubric.
    const blocklist = await readBlocklist();
    const blockedRejected: { id: string; company: string }[] = [];
    const afterBlocklist = afterRegion.filter((j) => {
      if (isBlocked(j.company ?? '', blocklist)) {
        blockedRejected.push({ id: j.id, company: j.company ?? '' });
        console.log(`[company-blocklist] rejected: ${j.id} — "${j.company ?? ''}"`);
        return false;
      }
      return true;
    });

    // Apply the hard-reject rubric BEFORE dedup. Anything failing it never
    // reaches storage — keeps the agent honest even if its filtering is loose.
    // Skip the rubric when no profile is set (e.g. fresh install) so we don't
    // throw away legitimate jobs before onboarding completes.
    const profile = await getProfile();
    const rubricRejected: { id: string; reason: string }[] = [];
    const accepted: Job[] = profile
      ? afterBlocklist.filter((j) => {
          const reason = rubricReject(j, profile);
          if (reason) {
            rubricRejected.push({ id: j.id, reason });
            return false;
          }
          return true;
        })
      : afterBlocklist;

    const classified = accepted.map((j) => ({ ...j, roleType: classifyDiscipline(j) }));
    const { merged, added } = mergeJobs(existing, classified);

    // Per-board breakdown — submitted = everything we received from that board,
    // kept = the subset that survived rubric + dedupe and made it into merged.
    const perBoard: Record<string, { submitted: number; kept: number }> = {};
    for (const j of newJobs) {
      const src = j.source || "unknown";
      perBoard[src] ??= { submitted: 0, kept: 0 };
      perBoard[src].submitted += 1;
    }
    for (const j of merged) {
      if (existingIds.has(j.id)) continue;
      const src = j.source || "unknown";
      perBoard[src] ??= { submitted: 0, kept: 0 };
      perBoard[src].kept += 1;
    }

    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(merged, null, 2));
    await recordSubmission(perBoard);

    return NextResponse.json({
      added,
      total: merged.length,
      rejectedByRubric: rubricRejected.length,
      rejectedAsStale: staleRejected.length,
      rejectedAsNonEu: regionRejected.length,
      rejectedAsBlocked: blockedRejected.length,
      letThroughAsUnknown: unknownEu.length,
    }, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function PUT(req: Request) {
  try {
    const submitted = sanitizeJobs((await req.json()) as Job[]);
    const cutoff = freshnessCutoff();
    const jobs = submitted.filter((j) => j.postedDate && j.postedDate >= cutoff);
    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
    return NextResponse.json({ total: jobs.length, droppedStale: submitted.length - jobs.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...updates } = (await req.json()) as Partial<Job> & { id?: string };
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const existing = await getJobs();
    const target = existing.find((j) => j.id === id);
    const jobs = existing.map((j) => (j.id === id ? { ...j, ...updates } : j));
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));

    // If the user just marked this job as rejected, bump the source's rejection
    // counter — drives the auto-deprioritization signal in board-stats.
    if (updates.rejected === true && target && !target.rejected) {
      await recordRejection(target.source);
    }

    return NextResponse.json({ updated: id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = (await req.json()) as { id: string };
    const existing = await getJobs();
    const filtered = existing.filter((j) => j.id !== id);
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(filtered, null, 2));
    return NextResponse.json({ deleted: id, total: filtered.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
