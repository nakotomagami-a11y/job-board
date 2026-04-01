import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const USER_JOBS_PATH = path.join(process.cwd(), "data", "user", "jobs.json");
const SEED_JOBS_PATH = path.join(process.cwd(), "data", "jobs.json");

async function getJobs(): Promise<unknown[]> {
  try {
    const data = await fs.readFile(USER_JOBS_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    // First launch — seed from starter data
    try {
      const seed = await fs.readFile(SEED_JOBS_PATH, "utf-8");
      const jobs = JSON.parse(seed).map((j: Record<string, unknown>) => ({
        ...j,
        sourceType: j.sourceType || "seed",
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
    const newJobs = await req.json();
    const existing = await getJobs();
    const existingIds = new Set(
      (existing as Array<{ id: string }>).map((j) => j.id)
    );
    const toAdd = (newJobs as Array<{ id: string }>).filter(
      (j) => !existingIds.has(j.id)
    );
    const all = [...existing, ...toAdd];
    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(all, null, 2));
    return NextResponse.json({ added: toAdd.length, total: all.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const jobs = await req.json();
    await fs.mkdir(path.dirname(USER_JOBS_PATH), { recursive: true });
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
    return NextResponse.json({ total: (jobs as unknown[]).length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const existing = await getJobs();
    const jobs = (existing as Array<Record<string, unknown>>).map((j) =>
      j.id === id ? { ...j, ...updates } : j
    );
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(jobs, null, 2));
    return NextResponse.json({ updated: id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const existing = await getJobs();
    const filtered = (existing as Array<{ id: string }>).filter(
      (j) => j.id !== id
    );
    await fs.writeFile(USER_JOBS_PATH, JSON.stringify(filtered, null, 2));
    return NextResponse.json({ deleted: id, total: filtered.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
