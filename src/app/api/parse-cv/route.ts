import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { rateLimit } from "@lib/rate-limit";

const USER_DIR = path.join(process.cwd(), "data", "user");

export async function POST(req: Request) {
  const limited = rateLimit(req, { bucket: "parse-cv", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);

    // Save raw CV text for Claude Code to analyze
    await fs.mkdir(USER_DIR, { recursive: true });
    await fs.writeFile(path.join(USER_DIR, "cv-raw.txt"), data.text);

    // Clear any previous analysis so the app knows to wait for new one
    try {
      await fs.unlink(path.join(USER_DIR, "cv-analysis.json"));
    } catch {
      // doesn't exist yet, fine
    }

    return NextResponse.json({
      text: data.text,
      pages: data.numpages,
    });
  } catch (e) {
    console.error("PDF parse error:", e);
    return NextResponse.json(
      { error: `Failed to parse PDF: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
