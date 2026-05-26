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
