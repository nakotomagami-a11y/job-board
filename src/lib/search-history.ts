import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";

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
