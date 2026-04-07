import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Job } from "@shared/types/job";
import { mergeJobs } from "@lib/job-dedup";
import { sanitizeJobs } from "@lib/sanitize-job";

const USER_JOBS_PATH = path.join(process.cwd(), "data", "user", "jobs.json");
const SEED_JOBS_PATH = path.join(process.cwd(), "data", "jobs.json");

async function getJobs(): Promise<Job[]> {
  try {
    const data = await fs.readFile(USER_JOBS_PATH, "utf-8");
    return JSON.parse(data) as Job[];
  } catch {
    // First launch — seed from starter data
    try {
      const seed = await fs.readFile(SEED_JOBS_PATH, "utf-8");
      const jobs = (JSON.parse(seed) as Job[]).map((j) => ({
        ...j,
        sourceType: j.sourceType || ("seed" as const),
      }));
      await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
      await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
      return jobs;
    } catch {
      return [];
    }
  }
}

export async function GET() {
  const jobs = await getJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  try {
    const newJobs = sanitizeJobs((await req.json()) as Job[]);
    const existing = await getJobs();
    const { merged, added } = mergeJobs(existing, newJobs);
    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(merged, null, 2));
    return NextResponse.json({ added, total: merged.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const jobs = sanitizeJobs((await req.json()) as Job[]);
    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
    return NextResponse.json({ total: jobs.length });
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
    const jobs = existing.map((j) => (j.id === id ? { ...j, ...updates } : j));
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
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
