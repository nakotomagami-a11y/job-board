import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const PROFILE_PATH = path.join(process.cwd(), "data", "user", "profile.json");

export async function GET() {
  try {
    const data = await fs.readFile(PROFILE_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(null);
  }
}

export async function PUT(req: Request) {
  try {
    const profile = await req.json();
    profile.updatedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(PROFILE_PATH), { recursive: true });
    await fs.writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2));
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
