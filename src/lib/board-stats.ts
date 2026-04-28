import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";

const STATS_PATH = path.join(process.cwd(), "data", "user", "board-stats.json");

export interface BoardStat {
  /** Total jobs ever submitted from this board (including duplicates / rejects). */
  submitted: number;
  /** Jobs that survived dedupe + scoring and were actually persisted. */
  kept: number;
  /** Jobs the user explicitly rejected after the fact. */
  rejected: number;
  /** ISO timestamp of the last submission. */
  lastSeen: string;
}

export type BoardStats = Record<string, BoardStat>;

export function readBoardStatsSync(): BoardStats {
  try { return JSON.parse(readFileSync(STATS_PATH, "utf-8")); }
  catch { return {}; }
}

export async function readBoardStats(): Promise<BoardStats> {
  try { return JSON.parse(await fs.readFile(STATS_PATH, "utf-8")); }
  catch { return {}; }
}

export async function writeBoardStats(stats: BoardStats): Promise<void> {
  await fs.mkdir(path.dirname(STATS_PATH), { recursive: true });
  await fs.writeFile(STATS_PATH, JSON.stringify(stats, null, 2));
}

/** Update stats after a merge: bump submitted/kept by the per-board breakdown. */
export async function recordSubmission(perBoard: Record<string, { submitted: number; kept: number }>): Promise<void> {
  const stats = await readBoardStats();
  const now = new Date().toISOString();
  for (const [board, delta] of Object.entries(perBoard)) {
    const prev = stats[board] ?? { submitted: 0, kept: 0, rejected: 0, lastSeen: now };
    stats[board] = {
      submitted: prev.submitted + delta.submitted,
      kept: prev.kept + delta.kept,
      rejected: prev.rejected,
      lastSeen: now,
    };
  }
  await writeBoardStats(stats);
}

/** Bump the rejected counter for a single board (called when user rejects a job). */
export async function recordRejection(board: string | undefined): Promise<void> {
  if (!board) return;
  const stats = await readBoardStats();
  const prev = stats[board] ?? { submitted: 0, kept: 0, rejected: 0, lastSeen: new Date().toISOString() };
  stats[board] = { ...prev, rejected: prev.rejected + 1 };
  await writeBoardStats(stats);
}

/**
 * Win rate = kept / submitted. Boards below `threshold` after at least
 * `minSubmissions` are considered low-yield and should be deprioritized.
 */
export function lowYieldBoards(stats: BoardStats, opts: { threshold?: number; minSubmissions?: number } = {}): string[] {
  const threshold = opts.threshold ?? 0.1;
  const minSubmissions = opts.minSubmissions ?? 20;
  return Object.entries(stats)
    .filter(([, s]) => s.submitted >= minSubmissions && s.kept / s.submitted < threshold)
    .map(([board]) => board);
}
