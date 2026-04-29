import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  loadAnswerBank,
  saveAnswerBank,
  upsertEntry,
  deleteEntry,
  addNormalization,
} from "@modules/auto-apply/answer-bank";
import { seedAnswerBank } from "@modules/auto-apply/seed";
import type { UserProfile } from "@shared/types/profile";
import type { AnswerEntry, NormalizationRule } from "@modules/auto-apply/types";

const PROFILE_PATH = path.join(process.cwd(), "data", "user", "profile.json");
const CV_ANALYSIS_PATH = path.join(process.cwd(), "data", "user", "cv-analysis.json");

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const bank = await loadAnswerBank();
  return NextResponse.json(bank);
}

// Upsert an entry, add a normalization rule, delete an entry, or reseed.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as
      | { op: "upsert"; entry: AnswerEntry }
      | { op: "delete"; id: string }
      | { op: "addNormalization"; rule: NormalizationRule }
      | { op: "reseed" };

    let bank = await loadAnswerBank();

    if (body.op === "upsert") {
      bank = upsertEntry(bank, body.entry);
    } else if (body.op === "delete") {
      bank = deleteEntry(bank, body.id);
    } else if (body.op === "addNormalization") {
      bank = addNormalization(bank, body.rule);
    } else if (body.op === "reseed") {
      const profile = await readJsonOrNull<UserProfile>(PROFILE_PATH);
      const cvAnalysis = await readJsonOrNull<Record<string, unknown>>(CV_ANALYSIS_PATH);
      bank = seedAnswerBank(bank, { profile, cvAnalysis });
    } else {
      return NextResponse.json({ error: "unknown op" }, { status: 400 });
    }

    await saveAnswerBank(bank);
    return NextResponse.json(bank);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
