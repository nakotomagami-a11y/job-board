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

const HISTORY_PATH = path.join(process.cwd(), "data", "user", "search-history.json");
const DEFAULT_TTL_HOURS = 24;
const MAX_ENTRIES = 500;

export interface SearchFingerprint {
  /** Board name as it appears in priority-boards.ts. */
  board: string;
  /** Stable hash of the query parameters (filters + custom keywords). */
  queryHash: string;
  /** ISO timestamp of when this search was issued. */
  ranAt: string;
}

export type SearchHistory = SearchFingerprint[];

/**
 * Stable hash of a JSON-serializable payload. Sorted-key serialization so
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce the same fingerprint.
 */
export function hashQuery(payload: unknown): string {
  const stable = JSON.stringify(payload, Object.keys(payload as object ?? {}).sort());
  let h = 5381;
  for (let i = 0; i < stable.length; i++) h = ((h << 5) + h + stable.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function readSearchHistorySync(): SearchHistory {
  try { return JSON.parse(readFileSync(HISTORY_PATH, "utf-8")); }
  catch { return []; }
}

async function readSearchHistory(): Promise<SearchHistory> {
  try { return JSON.parse(await fs.readFile(HISTORY_PATH, "utf-8")); }
  catch { return []; }
}

async function writeSearchHistory(history: SearchHistory): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  // Keep the file from growing unbounded — drop oldest entries past MAX_ENTRIES.
  const trimmed = history.slice(-MAX_ENTRIES);
  await fs.writeFile(HISTORY_PATH, JSON.stringify(trimmed, null, 2));
}

/** Record one fingerprint per board for this search batch. */
export async function recordSearches(boards: string[], queryHash: string): Promise<void> {
  const history = await readSearchHistory();
  const now = new Date().toISOString();
  for (const board of boards) history.push({ board, queryHash, ranAt: now });
  await writeSearchHistory(history);
}

/**
 * Filter `boards` down to those that have NOT been searched with `queryHash`
 * within `ttlHours`. The caller decides what to do with the skipped ones.
 */
export function pruneRecentlySearched(
  boards: string[],
  queryHash: string,
  history: SearchHistory,
  ttlHours = DEFAULT_TTL_HOURS,
): { fresh: string[]; skipped: string[] } {
  const cutoff = Date.now() - ttlHours * 60 * 60 * 1000;
  const recentSet = new Set(
    history
      .filter((h) => h.queryHash === queryHash && new Date(h.ranAt).getTime() >= cutoff)
      .map((h) => h.board),
  );
  const fresh: string[] = [];
  const skipped: string[] = [];
  for (const b of boards) (recentSet.has(b) ? skipped : fresh).push(b);
  return { fresh, skipped };
}

const BLOCKLIST_PATH = path.join(process.cwd(), "data", "user", "blocked-companies.json");

export interface Blocklist {
  version: number;
  updatedAt: string | null;
  companies: string[];
}

const DEFAULT_BLOCKLIST: Blocklist = {
  version: 1,
  updatedAt: null,
  companies: [],
};

export async function readBlocklist(): Promise<Blocklist> {
  try {
    const raw = await fs.readFile(BLOCKLIST_PATH, "utf-8");
    return JSON.parse(raw) as Blocklist;
  } catch {
    return { ...DEFAULT_BLOCKLIST };
  }
}

export async function writeBlocklist(list: Blocklist): Promise<void> {
  await fs.mkdir(path.dirname(BLOCKLIST_PATH), { recursive: true });
  // Tmp file MUST live in the same dir as the target so fs.rename() stays
  // on the same filesystem (rename across mounts fails with EXDEV on Linux).
  const tmp = `${BLOCKLIST_PATH}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2));
  await fs.rename(tmp, BLOCKLIST_PATH);
}

export async function addCompany(
  name: string
): Promise<{ added: boolean; alreadyPresent: boolean }> {
  const trimmed = name.trim();
  const list = await readBlocklist();
  const key = trimmed.toLowerCase();
  const exists = list.companies.some((c) => c.toLowerCase() === key);
  if (exists) return { added: false, alreadyPresent: true };
  list.companies.push(trimmed);
  list.updatedAt = new Date().toISOString();
  await writeBlocklist(list);
  return { added: true, alreadyPresent: false };
}

export async function removeCompany(
  name: string
): Promise<{ removed: boolean }> {
  const key = name.trim().toLowerCase();
  const list = await readBlocklist();
  const before = list.companies.length;
  list.companies = list.companies.filter((c) => c.toLowerCase() !== key);
  if (list.companies.length === before) return { removed: false };
  list.updatedAt = new Date().toISOString();
  await writeBlocklist(list);
  return { removed: true };
}

// Match rule: case-insensitive, whole-word on both sides using \b.
// "Revolut" blocks "Revolut", "Revolut Ltd", "Revolut Bank" (word boundary after token).
// "Revolut" does NOT block "Revolutionary Robotics" (no \b after t if followed by i).
// Edge case: adding a short common word like "Inc" would only match " Inc " / "Inc" as
// a complete token -- it would NOT match inside "Innovative Inc" because "Inc" appears at
// end, which IS a match. Users should avoid adding fragment tokens.
export function isBlocked(companyName: string, blocklist: Blocklist): boolean {
  const name = companyName.trim();
  if (!name) return false;
  for (const entry of blocklist.companies) {
    const escaped = entry.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(name)) return true;
  }
  return false;
}
