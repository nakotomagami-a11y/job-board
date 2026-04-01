import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const COMPANIES_PATH = path.join(process.cwd(), "data", "user", "companies.json");

export async function GET() {
  try {
    const data = await fs.readFile(COMPANIES_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(req: Request) {
  try {
    const companies = await req.json();
    await fs.mkdir(path.dirname(COMPANIES_PATH), { recursive: true });
    await fs.writeFile(COMPANIES_PATH, JSON.stringify(companies, null, 2));
    return NextResponse.json(companies);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
