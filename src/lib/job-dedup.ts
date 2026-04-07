import type { Job } from "@shared/types/job";

/**
 * Normalize a URL for dedup comparison: strip protocol, www, query, fragment,
 * trailing slash, lowercase. Two listings pointing at the same posting should
 * collapse to the same key even if one has utm params and the other doesn't.
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Normalize a string for comparison: lowercase, collapse whitespace, strip punctuation. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a set of dedup keys for an existing job. A new job is a duplicate if
 * any of its keys collide with an existing key.
 *
 * Keys checked:
 *  - explicit job id
 *  - normalized URL (catches the same posting under different ids)
 *  - normalized "company|title" (catches the same role re-listed at a new URL)
 */
export function jobKeys(job: Job): string[] {
  const keys = [`id:${job.id}`];
  if (job.url) keys.push(`url:${normalizeUrl(job.url)}`);
  if (job.company && job.title) {
    keys.push(`ct:${normalizeText(job.company)}|${normalizeText(job.title)}`);
  }
  return keys;
}

/**
 * Merge new jobs into existing, dropping any that collide on id, normalized
 * URL, or normalized company+title. Returns `{ merged, added }` so callers can
 * report how many actually landed.
 */
export function mergeJobs(existing: Job[], incoming: Job[]): { merged: Job[]; added: number } {
  const seen = new Set<string>();
  for (const job of existing) {
    for (const k of jobKeys(job)) seen.add(k);
  }

  const toAdd: Job[] = [];
  for (const job of incoming) {
    const keys = jobKeys(job);
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    toAdd.push(job);
  }

  return { merged: [...existing, ...toAdd], added: toAdd.length };
}
