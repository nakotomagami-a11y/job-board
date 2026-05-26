/**
 * One-shot script: marks non-EU jobs in jobs.json as rejected so they stop
 * appearing in the dashboard. Does NOT delete records - history is preserved.
 *
 * Usage: node scripts/prune-non-eu.mjs
 *
 * Safe to re-run (idempotent): already-rejected entries are not touched.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOBS_PATH = path.resolve(__dirname, '..', 'data', 'user', 'jobs.json');

// ---------------------------------------------------------------------------
// Region classification logic (mirrors src/lib/region-filter.ts)
// ---------------------------------------------------------------------------

const EU_REGION_VALUES = new Set(['Europe', 'UK']);
const NON_EU_REGION_VALUES = new Set(['North America', 'Asia', 'LATAM']);

const EU_COUNTRY_NAMES = [
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus',
  'czech republic', 'czechia', 'denmark', 'estonia', 'finland',
  'france', 'germany', 'greece', 'hungary', 'ireland', 'italy',
  'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands',
  'poland', 'portugal', 'romania', 'slovakia', 'slovenia',
  'spain', 'sweden',
  'iceland', 'norway', 'switzerland', 'liechtenstein',
  'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
];

const EU_CITY_NAMES = [
  'berlin', 'munich', 'hamburg', 'london', 'manchester', 'edinburgh',
  'dublin', 'cork', 'paris', 'amsterdam', 'rotterdam', 'madrid',
  'barcelona', 'lisbon', 'porto', 'rome', 'milan', 'stockholm',
  'copenhagen', 'oslo', 'helsinki', 'warsaw', 'krakow', 'prague',
  'budapest', 'vienna', 'zurich', 'zürich', 'geneva', 'brussels',
  'vilnius', 'kaunas', 'riga', 'tallinn',
];

const NON_EU_COUNTRY_NAMES = [
  'united states', 'united arab emirates',
  'canada', 'mexico', 'brazil', 'argentina', 'chile', 'colombia',
  'india', 'china', 'japan', 'singapore', 'south korea', 'taiwan',
  'hong kong', 'thailand', 'vietnam', 'indonesia', 'philippines',
  'malaysia', 'australia', 'new zealand', 'south africa', 'israel',
  'uae', 'saudi arabia', 'turkey', 'russia', 'ukraine', 'belarus',
  'egypt', 'nigeria', 'kenya', 'pakistan', 'bangladesh',
];

const NON_EU_PHRASES = [
  'remote within us', 'remote (us)', 'remote (us/canada)',
  'us remote', 'canada remote', 'argentina remote', 'latam remote',
];

const EU_ABBR_RE = /\bEU\b/;
const UK_ABBR_RE = /\bUK\b/;
const US_STATE_RE = /,\s*(?:CA|NY|TX|WA|MA|IL|NJ|FL|GA|CO|OR|VA|NC|PA|MI|MN|AZ|NV|OH)\b/i;
const USA_WORD_RE = /\bUSA\b/i;
const US_WORD_RE = /\bUS\b/;

function classifyRegion(location, region) {
  const loc = (location ?? '').toLowerCase();

  if (EU_REGION_VALUES.has(region)) return 'eu';
  if (EU_ABBR_RE.test(location)) return 'eu';
  if (UK_ABBR_RE.test(location)) return 'eu';

  if (NON_EU_REGION_VALUES.has(region)) return 'non_eu';
  if (NON_EU_PHRASES.some((p) => loc.includes(p))) return 'non_eu';
  if (NON_EU_COUNTRY_NAMES.some((c) => loc.includes(c))) return 'non_eu';
  if (US_STATE_RE.test(location)) return 'non_eu';
  if (USA_WORD_RE.test(location)) return 'non_eu';
  if (US_WORD_RE.test(location)) return 'non_eu';

  if (EU_COUNTRY_NAMES.some((c) => loc.includes(c))) return 'eu';
  if (EU_CITY_NAMES.some((c) => loc.includes(c))) return 'eu';

  return 'unknown';
}

// ---------------------------------------------------------------------------

const jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf-8'));
const rejectedAt = new Date().toISOString();

let countEu = 0;
let countUnknown = 0;
let countMarked = 0;
let countSkipped = 0;

const updated = jobs.map((job) => {
  // Only evaluate jobs not already processed.
  if (job.applied === true || job.rejected === true) {
    countSkipped++;
    return job;
  }

  const verdict = classifyRegion(job.location ?? '', job.region ?? '');

  if (verdict === 'non_eu') {
    countMarked++;
    return { ...job, rejected: true, rejectedReason: 'Non-EU per region policy', rejectedAt };
  }
  if (verdict === 'eu') {
    countEu++;
  } else {
    countUnknown++;
  }
  return job;
});

// Atomic write: write to a temp file then rename so a crash mid-write doesn't
// corrupt jobs.json.
const tmp = JOBS_PATH + '.tmp';
await fs.writeFile(tmp, JSON.stringify(updated, null, 2));
await fs.rename(tmp, JOBS_PATH);

const total = countEu + countUnknown + countMarked;
console.log(`Kept eu: ${countEu}, kept unknown: ${countUnknown}, marked rejected: ${countMarked}, total processed: ${total}`);
console.log(`(${countSkipped} already-applied/rejected entries left untouched)`);
