import type { Job } from "@shared/types/job";

/**
 * Sanitize untrusted job data before it lands in storage.
 *
 * Job records arrive from `/api/storage/jobs` POST, which is reachable from
 * the browser and (more relevantly) from prompts Claude generates after
 * web-searching arbitrary careers pages. Anything that flows from "the
 * internet" through the prompt and back into our JSON should be treated as
 * untrusted.
 *
 * The biggest concrete risk is the Apply button: it renders as
 *   <a href={job.url} target="_blank">
 * If `job.url` is `javascript:alert(1)`, React will not block it and the
 * attacker has script execution on click. We refuse anything that isn't an
 * absolute http(s) URL.
 *
 * Text fields are stripped of HTML tags and control characters so that *if*
 * a future view renders them via `dangerouslySetInnerHTML` they won't carry
 * a payload.
 */

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);
const TAG_RE = /<\/?[a-z][^>]*>/gi;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const MAX_TEXT = 4000;
const MAX_SHORT = 300;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(TAG_RE, "")
    .replace(CONTROL_RE, "")
    .trim()
    .slice(0, max);
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value.trim());
    if (!SAFE_URL_PROTOCOLS.has(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize a single job. Returns null if it doesn't have the minimum
 * required safe fields (id, title, company, valid url).
 */
export function sanitizeJob(input: Job): Job | null {
  const url = cleanUrl(input.url);
  if (!url) return null;

  const title = cleanText(input.title, MAX_SHORT);
  const company = cleanText(input.company, MAX_SHORT);
  const id = cleanText(input.id, MAX_SHORT);
  if (!title || !company || !id) return null;

  return {
    ...input,
    id,
    title,
    company,
    url,
    location: cleanText(input.location, MAX_SHORT),
    source: cleanText(input.source, MAX_SHORT),
    salary: input.salary ? cleanText(input.salary, MAX_SHORT) : input.salary,
    description: input.description ? cleanText(input.description, MAX_TEXT) : input.description,
    tags: Array.isArray(input.tags)
      ? input.tags.map((t) => cleanText(t, MAX_SHORT)).filter(Boolean)
      : [],
  };
}

/** Sanitize many jobs, dropping any that fail validation. */
export function sanitizeJobs(jobs: Job[]): Job[] {
  const out: Job[] = [];
  for (const j of jobs) {
    const safe = sanitizeJob(j);
    if (safe) out.push(safe);
  }
  return out;
}
