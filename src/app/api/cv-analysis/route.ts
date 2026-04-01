import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const USER_DIR = path.join(process.cwd(), "data", "user");
const ANALYSIS_PATH = path.join(USER_DIR, "cv-analysis.json");
const CV_RAW_PATH = path.join(USER_DIR, "cv-raw.txt");

// GET: check if analysis results exist
export async function GET() {
  try {
    const data = await fs.readFile(ANALYSIS_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(null);
  }
}

// POST: trigger Claude Code CLI to analyze the CV
export async function POST() {
  try {
    const cvText = await fs.readFile(CV_RAW_PATH, "utf-8");
    if (!cvText.trim()) {
      return NextResponse.json({ error: "No CV text found." }, { status: 400 });
    }

    // Write the full prompt to a file — avoids shell argument length limits
    const promptPath = path.join(USER_DIR, "cv-prompt.txt");
    await fs.writeFile(promptPath, `Analyze this CV/resume and return ONLY valid JSON (no markdown, no code fences, just raw JSON):

${cvText}

Return exactly this JSON structure:
{"name":"Full name only no titles","email":"email or null","location":"City, Country or null","skills":["every tech and tool mentioned"],"suggestedRoles":["job titles to search for"],"suggestedSeniority":["level"],"suggestedCategories":["matching industries"],"yearsExperience":0,"summary":"1-2 sentence summary"}`);

    // Pipe file content to claude via shell — works reliably on all platforms
    const promptPathUnix = promptPath.replace(/\\/g, "/");
    const { stdout } = await execAsync(
      `cat "${promptPathUnix}" | claude -p --output-format text`,
      {
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
        shell: process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/bash",
        env: { ...process.env },
      }
    );

    // Extract JSON from response
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      await fs.mkdir(USER_DIR, { recursive: true });
      await fs.writeFile(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
      return NextResponse.json(analysis);
    }

    return NextResponse.json(
      { error: "Could not parse Claude's response", raw: stdout.substring(0, 300) },
      { status: 500 }
    );
  } catch (e) {
    console.error("CV analysis error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    // Check if Claude CLI is not installed
    if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("not recognized")) {
      return NextResponse.json(
        { error: "Claude CLI not installed. Run: npm install -g @anthropic-ai/claude-code" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Analysis failed: ${msg}` },
      { status: 500 }
    );
  }
}

// DELETE: clear analysis
export async function DELETE() {
  try { await fs.unlink(ANALYSIS_PATH); } catch { /* ok */ }
  return NextResponse.json({ ok: true });
}
