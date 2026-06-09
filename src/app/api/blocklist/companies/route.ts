import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Job } from "@/types/job";
import { readBlocklist, addCompany, removeCompany, isBlocked } from "@lib/data-access";

const JOBS_PATH = path.join(process.cwd(), "data", "user", "jobs.json");

async function getJobs(): Promise<Job[]> {
  try {
    return JSON.parse(await fs.readFile(JOBS_PATH, "utf-8")) as Job[];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const list = await readBlocklist();
    return NextResponse.json({
      companies: list.companies,
      count: list.companies.length,
      updatedAt: list.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { company?: string; retroactive?: boolean };
    const company = (body.company ?? "").trim();
    if (!company) {
      return NextResponse.json({ error: "company is required and must not be blank" }, { status: 400 });
    }

    const retroactive = body.retroactive !== false;
    const { added, alreadyPresent } = await addCompany(company);

    let retroactiveCount = 0;
    if (retroactive) {
      const jobs = await getJobs();
      const blocklist = await readBlocklist();
      const now = new Date().toISOString();
      let dirty = false;
      const updated = jobs.map((j) => {
        if (!j.rejected && isBlocked(j.company ?? '', blocklist)) {
          retroactiveCount += 1;
          dirty = true;
          return {
            ...j,
            rejected: true,
            rejectedReason: "Company on blocklist",
            rejectedAt: now,
          };
        }
        return j;
      });
      if (dirty) {
        await fs.writeFile(JOBS_PATH, JSON.stringify(updated, null, 2));
      }
    }

    return NextResponse.json({ added, alreadyPresent, retroactiveCount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { company?: string };
    const company = (body.company ?? "").trim();
    if (!company) {
      return NextResponse.json({ error: "company is required and must not be blank" }, { status: 400 });
    }
    const { removed } = await removeCompany(company);
    return NextResponse.json({ removed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
