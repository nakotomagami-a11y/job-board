import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SOURCES_PATH = path.join(process.cwd(), "data", "user", "sources.json");

const DEFAULT_SOURCES = [
  { name: "LinkedIn Jobs", url: "https://linkedin.com/jobs", enabled: true },
  { name: "WeWorkRemotely", url: "https://weworkremotely.com", enabled: true },
  { name: "RemoteOK", url: "https://remoteok.com", enabled: true },
  { name: "arc.dev", url: "https://arc.dev/remote-jobs", enabled: true },
  { name: "Wellfound", url: "https://wellfound.com", enabled: true },
  { name: "web3.career", url: "https://web3.career", enabled: true },
  { name: "reactjobs.io", url: "https://reactjobs.io", enabled: true },
  { name: "Greenhouse boards", url: "https://boards.greenhouse.io", enabled: true },
  { name: "Lever boards", url: "https://jobs.lever.co", enabled: true },
  { name: "HN Who is Hiring", url: "https://hnhiring.com", enabled: true },
  { name: "Hitmarker (Gaming)", url: "https://hitmarker.net/jobs", enabled: true },
  { name: "CryptoJobsList", url: "https://cryptojobslist.com", enabled: true },
  { name: "EU Remote Jobs", url: "https://euremotejobs.com", enabled: true },
  { name: "startup.jobs", url: "https://startup.jobs", enabled: true },
];

export async function GET() {
  try {
    const data = await fs.readFile(SOURCES_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    // First time — create default sources
    await fs.mkdir(path.dirname(SOURCES_PATH), { recursive: true });
    await fs.writeFile(SOURCES_PATH, JSON.stringify(DEFAULT_SOURCES, null, 2));
    return NextResponse.json(DEFAULT_SOURCES);
  }
}

export async function PUT(req: Request) {
  try {
    const sources = await req.json();
    await fs.mkdir(path.dirname(SOURCES_PATH), { recursive: true });
    await fs.writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2));
    return NextResponse.json(sources);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
