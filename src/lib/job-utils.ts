import type { Job } from "@/types/job";

/**
 * Parse a free-form salary string into a numeric range.
 *
 * Handles:
 *  - "$120,000 - $150,000" → { min: 120000, max: 150000 }
 *  - "$120k - $150k"        → { min: 120000, max: 150000 }
 *  - "120K"                 → { min: 120000, max: 120000 }
 *  - "1.2M"                 → { min: 1200000, max: 1200000 }
 *  - "€80k–€100k"           → { min: 80000, max: 100000 }   (en dash)
 *  - "USD 100,000+"         → { min: 100000, max: 100000 }
 *  - missing / unparseable  → null
 *
 * Currency symbols are ignored — the result is currency-agnostic.
 */
export interface SalaryRange {
  min: number;
  max: number;
}

const NUMBER_PATTERN = /(\d+(?:[,.\d]*)?)\s*([kKmM])?/g;

export function parseSalary(input?: string | null): SalaryRange | null {
  if (!input) return null;

  // Normalize unicode dashes/spaces so the regex sees a clean string.
  const text = input.replace(/[–—]/g, "-").replace(/\u00a0/g, " ");

  const matches: number[] = [];
  for (const m of text.matchAll(NUMBER_PATTERN)) {
    const raw = m[1].replace(/,/g, "");
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    const suffix = m[2]?.toLowerCase();
    const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
    // Heuristic: a bare number ≤ 999 with no suffix in a salary context is
    // almost certainly thousands (e.g. "120 - 150"), not literal dollars.
    const value =
      multiplier === 1 && n > 0 && n < 1000 ? n * 1_000 : n * multiplier;
    matches.push(value);
  }

  if (matches.length === 0) return null;
  const min = Math.min(...matches);
  const max = Math.max(...matches);
  return { min, max };
}

/** Convenience: returns the lower bound for sorting, or 0 if unparseable. */
export function salarySortValue(input?: string | null): number {
  const range = parseSalary(input);
  return range?.min ?? 0;
}

export type RegionVerdict = 'eu' | 'non_eu' | 'unknown';

// ---------------------------------------------------------------------------
// EU tells
// ---------------------------------------------------------------------------

const EU_REGION_VALUES = new Set(['Europe', 'UK']);

const EU_COUNTRY_NAMES = [
  // EU member states
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus',
  'Czech Republic', 'Czechia', 'Denmark', 'Estonia', 'Finland',
  'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
  'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden',
  // EEA + Switzerland
  'Iceland', 'Norway', 'Switzerland', 'Liechtenstein',
  // UK (full names; "UK" as abbreviation handled via word-boundary regex below)
  'United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland',
];

const EU_CITY_NAMES = [
  'Berlin', 'Munich', 'Hamburg', 'London', 'Manchester', 'Edinburgh',
  'Dublin', 'Cork', 'Paris', 'Amsterdam', 'Rotterdam', 'Madrid',
  'Barcelona', 'Lisbon', 'Porto', 'Rome', 'Milan', 'Stockholm',
  'Copenhagen', 'Oslo', 'Helsinki', 'Warsaw', 'Krakow', 'Prague',
  'Budapest', 'Vienna', 'Zurich', 'Zürich', 'Geneva', 'Brussels',
  'Vilnius', 'Kaunas', 'Riga', 'Tallinn',
];

// "EU" (e.g. "Remote (EU)") or "UK" as standalone words; word boundary prevents
// matching "Europe" for EU or "Ukraine" for UK.
const EU_ABBR_RE = /\bEU\b/;
const UK_ABBR_RE = /\bUK\b/;

// ---------------------------------------------------------------------------
// Non-EU tells
// ---------------------------------------------------------------------------

const NON_EU_REGION_VALUES = new Set(['North America', 'Asia', 'LATAM']);

const NON_EU_COUNTRY_NAMES = [
  'United States', 'United Arab Emirates',
  'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia',
  'India', 'China', 'Japan', 'Singapore', 'South Korea', 'Taiwan',
  'Hong Kong', 'Thailand', 'Vietnam', 'Indonesia', 'Philippines',
  'Malaysia', 'Australia', 'New Zealand', 'South Africa', 'Israel',
  'UAE', 'Saudi Arabia', 'Turkey', 'Russia', 'Ukraine', 'Belarus',
  'Egypt', 'Nigeria', 'Kenya', 'Pakistan', 'Bangladesh',
];

// Explicit phrases that indicate a US/LATAM-restricted remote role.
const NON_EU_PHRASES = [
  'Remote within US', 'Remote (US)', 'Remote (US/Canada)',
  'US Remote', 'Canada Remote', 'Argentina Remote', 'LATAM Remote',
];

// US state abbreviations when preceded by a comma (e.g. "San Francisco, CA").
// Word boundary after the code prevents matching the start of longer words
// (e.g. "Illinois" would be caught by ", IL\b" if not for \b failing at 'l').
const US_STATE_RE = /,\s*(?:CA|NY|TX|WA|MA|IL|NJ|FL|GA|CO|OR|VA|NC|PA|MI|MN|AZ|NV|OH)\b/i;

// "USA" or standalone "US" (case-sensitive: real location data uses uppercase).
const USA_WORD_RE = /\bUSA\b/i;
const US_WORD_RE = /\bUS\b/;

// ---------------------------------------------------------------------------

export function classifyRegion(location: string, region: string, remote: boolean): RegionVerdict {
  void remote; // accepted for API symmetry; not needed by current rules

  const loc = location.toLowerCase();

  // 1. EU region field and abbreviations — checked first as the strongest signal.
  if (EU_REGION_VALUES.has(region)) return 'eu';
  if (EU_ABBR_RE.test(location)) return 'eu';
  if (UK_ABBR_RE.test(location)) return 'eu';

  // 2. Non-EU explicit country names and region field — checked BEFORE EU
  //    country/city substrings so that locations like "Sydney, New South Wales,
  //    Australia" are caught by "Australia" before the "Wales" substring fires.
  if (NON_EU_REGION_VALUES.has(region)) return 'non_eu';
  if (NON_EU_PHRASES.some((p) => loc.includes(p.toLowerCase()))) return 'non_eu';
  if (NON_EU_COUNTRY_NAMES.some((c) => loc.includes(c.toLowerCase()))) return 'non_eu';
  if (US_STATE_RE.test(location)) return 'non_eu';
  if (USA_WORD_RE.test(location)) return 'non_eu';
  if (US_WORD_RE.test(location)) return 'non_eu';

  // 3. EU country and city substrings — after non-EU explicit check so false
  //    positives from ambiguous names (e.g. "Wales" inside foreign state names
  //    that are blocked by step 2) don't override a clear non-EU location.
  if (EU_COUNTRY_NAMES.some((c) => loc.includes(c.toLowerCase()))) return 'eu';
  if (EU_CITY_NAMES.some((c) => loc.includes(c.toLowerCase()))) return 'eu';

  // 4. Conservative fallback - let ambiguous entries through for manual review.
  return 'unknown';
}

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
    boardSource: input.boardSource,
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
