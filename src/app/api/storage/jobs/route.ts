import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Job } from "@shared/types/job";
import type { UserProfile } from "@shared/types/profile";
import { mergeJobs } from "@lib/job-dedup";
import { sanitizeJobs } from "@lib/sanitize-job";
import { recordSubmission, recordRejection } from "@lib/board-stats";
import { rubricReject } from "@lib/score-job";

const USER_JOBS_PATH = path.join(process.cwd(), "data", "user", "jobs.json");
const PROFILE_PATH = path.join(process.cwd(), "data", "user", "profile.json");
const FRESHNESS_DAYS = 7;

// Returns the ISO date (YYYY-MM-DD) cutoff; anything strictly older is stale.
function freshnessCutoff(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - FRESHNESS_DAYS);
  return d.toISOString().slice(0, 10);
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

    // Apply the hard-reject rubric BEFORE dedup. Anything failing it never
    // reaches storage — keeps the agent honest even if its filtering is loose.
    // Skip the rubric when no profile is set (e.g. fresh install) so we don't
    // throw away legitimate jobs before onboarding completes.
    const profile = await getProfile();
    const rubricRejected: { id: string; reason: string }[] = [];
    const accepted: Job[] = profile
      ? newJobs.filter((j) => {
          const reason = rubricReject(j, profile);
          if (reason) {
            rubricRejected.push({ id: j.id, reason });
            return false;
          }
          return true;
        })
      : newJobs;

    const { merged, added } = mergeJobs(existing, accepted);

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
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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
