import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "data", "user", "search-history.json");

export interface SearchHistoryEntry {
  timestamp: string;
  command: string;
  filters: string;
  jobsFound: number;
  sources: string[];
}

export async function GET() {
  try {
    const data = await fs.readFile(HISTORY_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const entry: SearchHistoryEntry = await req.json();
    let history: SearchHistoryEntry[] = [];
    try {
      history = JSON.parse(await fs.readFile(HISTORY_PATH, "utf-8"));
    } catch { /* empty */ }

    // Keep last 50 entries
    history = [entry, ...history].slice(0, 50);
    await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
    await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
