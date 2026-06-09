// Master list of job boards -- each tagged with a tier and the regions it
// primarily covers. The /api/run-command rotation sorts by the candidate's
// region priority first, then by tier, so an EU-priority candidate hits
// dedicated EU boards before pan-EU aggregators before global ones.
//
// Curation rules:
//  - Aggregator boards only (no single-company talent platforms)
//  - No paywalled-only boards
//  - EU-first: Tier 1 = native EU country boards, Tier 2 = EU-focused
//    aggregators, Tier 3 = pan-EU remote with EU endpoint/filter ONLY,
//    Tier 4 = EU-specific ATS platforms, Tier 5 = LinkedIn (EU geoId only)
//
// Explicitly excluded (US-heavy or not EU-focused):
//  - RemoteOK: US-skewed default feed, no seeker-side EU filter
//  - Himalayas: worldwide-remote but US companies dominate
//  - Greenhouse/Lever/Ashby: US startup ATS platforms — EU companies on
//    these are covered by /api/board-fetch + eu-ats-companies.json instead
//  - SmartRecruiters: global/US-heavy generic ATS
//  - Relocate.me: mostly a content/blog site now, low original listings volume
//  - Wellfound/AngelList: EU startup volume is thin (~264 Europe jobs per snapshot)
//
// Teamtailor note: THE dominant EU-native ATS (20K+ companies, 75%+ EU customers —
// Sweden, France, UK, Benelux core). No central public job board to scrape; EU
// companies on it must be queried individually via company.teamtailor.com/jobs.json.
// Add EU Teamtailor companies to data/user/eu-ats-companies.json for /api/board-fetch.

export type BoardRegion =
  | "Europe"
  | "Baltics"
  | "DACH"
  | "Nordic"
  | "UK"
  | "Remote"  // remote-first board (job inventory is mostly remote roles)
  | "Global"; // worldwide aggregator (no specific regional focus)

export type BoardTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface JobBoard {
  name: string;
  url: string;
  tier: BoardTier;
  regions: BoardRegion[];
  /** Hint string for the agent -- board-specific URL patterns or search caveats. */
  notes?: string;
}

export const BOARDS: JobBoard[] = [
  // -- Tier 1: EU-native boards (highest priority, native to candidate's market) --

  // Baltics
  { name: "CVbankas Lithuania", url: "cvbankas.lt", tier: 1, regions: ["Europe", "Baltics"],
    notes: "Lithuania's most visited board, 1.82M views/month" },
  { name: "CV Online Baltic", url: "cvonline.lv", tier: 1, regions: ["Europe", "Baltics"],
    notes: "Pan-Baltic network covering Lithuania, Latvia, Estonia; use country filter at query time" },
  { name: "CVKeskus Estonia", url: "cvkeskus.ee", tier: 1, regions: ["Europe", "Baltics"],
    notes: "Dominant in Estonia; 12,500+ active listings" },
  { name: "MeetFrank", url: "meetfrank.com", tier: 1, regions: ["Europe", "Baltics"],
    notes: "Transparency-focused (salary, equity); Baltic/Nordic/EU; bot-blocked, use /api/scrape" },
  { name: "Built in Baltics", url: "builtinbaltics.com", tier: 1, regions: ["Europe", "Baltics"],
    notes: "Community + jobs for Baltic tech scene" },

  // Poland
  { name: "Just Join IT", url: "justjoin.it", tier: 1, regions: ["Europe"],
    notes: "Poland's #1 tech board; salary transparency mandatory; +68% YoY postings in H1 2025 (24.5K listings)" },
  { name: "No Fluff Jobs", url: "nofluffjobs.com", tier: 1, regions: ["Europe"],
    notes: "Poland-led, covers EU broadly; salary transparency mandatory; high signal-to-noise" },
  { name: "Pracuj.pl", url: "pracuj.pl", tier: 1, regions: ["Europe"],
    notes: "Poland's largest generalist board; bot-blocked, use /api/scrape" },

  // DACH
  { name: "StepStone Germany", url: "stepstone.de", tier: 1, regions: ["Europe", "DACH"],
    notes: "Germany's largest job board; tech and engineering well-represented" },
  { name: "Xing Jobs", url: "xing.com/jobs", tier: 1, regions: ["Europe", "DACH"],
    notes: "DACH-dominant (DE/AT/CH); moved to paid-only posting in 2024 so volume is lower, but EU coverage is genuine" },
  { name: "Berlin Startup Jobs", url: "berlinstartupjobs.com", tier: 1, regions: ["Europe", "DACH"] },
  { name: "SwissDevJobs", url: "swissdevjobs.ch", tier: 1, regions: ["Europe", "DACH"] },

  // Nordic
  { name: "The Hub", url: "thehub.io", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Nordic startups specifically (DK/SE/NO/FI); 2,000+ jobs; not general EU" },
  { name: "FINN.no Jobs", url: "finn.no/job/fulltime", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Norway's dominant marketplace; largest Norwegian jobs feed; filter by category=IT" },
  { name: "Jobindex Denmark", url: "jobindex.dk", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Denmark's #1 tech job board; English-language IT jobs at jobindex.dk/jobsoegning/it" },
  { name: "Duunitori Finland", url: "duunitori.fi", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Finland's #1 developer community job board; English-language tech roles well-represented" },
  { name: "Platsbanken Sweden", url: "arbetsformedlingen.se/platsbanken", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Sweden's official national job board (Arbetsförmedlingen); search 'IT' or 'Software Developer' in English" },
  { name: "Karriere.no", url: "karriere.no", tier: 1, regions: ["Europe", "Nordic"],
    notes: "Norwegian careers portal; tech section at karriere.no/stillinger/it" },

  // France
  { name: "Welcome to the Jungle", url: "welcometothejungle.com", tier: 1, regions: ["Europe"],
    notes: "France + EU (absorbed Otta Jan 2024); 5.3M monthly visitors; also active in CZ, ES; JS-rendered, use /api/scrape" },
  { name: "LesJeudis", url: "lesjeudis.com", tier: 1, regions: ["Europe"],
    notes: "France IT board" },

  // Portugal / South EU
  { name: "Landing.jobs", url: "landing.jobs", tier: 1, regions: ["Europe"],
    notes: "Portugal + EU; tech focus; visa/relocation-friendly" },

  // EU dev community
  { name: "Honeypot", url: "honeypot.io", tier: 1, regions: ["Europe"],
    notes: "Berlin-based, dev-focused, English-friendly; acquired by New Work (XING parent) 2022 — verify still active" },
  { name: "WeAreDevelopers Jobs", url: "wearedevelopers.com/jobs", tier: 1, regions: ["Europe"],
    notes: "EU dev community board; strong in DACH + broader EU; has EU-remote filter" },

  // -- Tier 2: EU-focused aggregators --

  { name: "Arbeitnow", url: "arbeitnow.com", tier: 2, regions: ["Europe", "Remote"],
    notes: "EU-focused aggregator (Berlin-based); many listings REDIRECT to actual ATS — resolve destination URL" },
  { name: "EU-Startups Jobs", url: "eu-startups.com/jobs", tier: 2, regions: ["Europe"] },
  { name: "EU Remote Jobs", url: "euremotejobs.com", tier: 2, regions: ["Europe", "Remote"],
    notes: "EU/EMEA timezone remote only — no US-only remote" },
  { name: "EuroTechJobs", url: "eurotechjobs.com", tier: 2, regions: ["Europe"],
    notes: "Pan-EU tech-specific aggregator; country filters available; confirmed active 2025" },
  { name: "NextLevelJobs EU", url: "nextleveljobs.eu", tier: 2, regions: ["Europe"],
    notes: "€100K+ engineering roles across EU; niche but high-signal for senior roles" },

  // -- Tier 3: Remote boards — use EU-specific endpoints only --
  // NEVER hit the default feed; always use the EU/Europe filtered URL.

  { name: "Remotive (EU)", url: "remotive.com/remote-eu-jobs", tier: 3, regions: ["Remote", "Europe"],
    notes: "Use /remote-eu-jobs endpoint directly — the default feed is worldwide and US-heavy" },
  { name: "Jobicy (EU filter)", url: "jobicy.com", tier: 3, regions: ["Remote", "Europe"],
    notes: "Public JSON API; always add &geo=europe (or per-country) filter at query time" },
  { name: "Working Nomads (EU)", url: "workingnomads.com/remote-europe-jobs", tier: 3, regions: ["Remote", "Europe"],
    notes: "Use /remote-europe-jobs section directly — default feed is mixed US/global" },
  { name: "Remote in Europe", url: "remoteineurope.eu", tier: 3, regions: ["Remote", "Europe"],
    notes: "Curated EU-leaning remote board; lower posting velocity, but EU-company signal is genuine" },
  { name: "ReactJobs EU", url: "reactjobs.io/location/europe", tier: 3, regions: ["Remote", "Europe"],
    notes: "React-specific board with Europe location filter; directly relevant for React/RN roles" },

  // -- Tier 4: EU-specific ATS platforms --
  // Only EU-dominant platforms. US-heavy ATS (Greenhouse, Lever, Ashby) are excluded
  // from the rotation — EU companies on those are covered by /api/board-fetch.
  // Teamtailor (20K+ companies, 75%+ EU) has no central board; add EU companies
  // to eu-ats-companies.json for /api/board-fetch coverage.

  { name: "Workable", url: "apply.workable.com", tier: 4, regions: ["Europe"],
    notes: "Athens-originated; 27K+ global customers; heavily used by EU SMBs; search with EU location filter" },
  { name: "Recruitee", url: "recruitee.com", tier: 4, regions: ["Europe"],
    notes: "Amsterdam-originated; 5K+ customers; Benelux/DACH/UK core market" },
  { name: "Personio", url: "personio.de", tier: 4, regions: ["Europe", "DACH"],
    notes: "Munich-originated HR+ATS; 86% of customers in Germany; many DE SMBs" },

  // -- Tier 5: LinkedIn with strict EU geoId --

  { name: "LinkedIn EU", url: "linkedin.com/jobs", tier: 5, regions: ["Europe"],
    notes: "Use guest API with geoId=91000000 (EU) ONLY. Never global. Login wall handled separately." },
];

/** Display label as it appears in the agent prompt and as a stable batch-state key. */
export function boardLabel(b: JobBoard): string {
  return `${b.name} (${b.url})`;
}

/**
 * Filter to the boards relevant for a given search scope.
 *  - "focused" -> Tiers 1-3 only
 *  - anything else -> all boards
 */
export function getBoardsForScope(scope?: string): JobBoard[] {
  if (scope === "focused") return BOARDS.filter((b) => b.tier <= 3);
  return BOARDS;
}

/**
 * Sort boards so the candidate's top-priority region is hit first.
 *
 * Bucket assignment per board (lower bucket = higher priority):
 *  - For each entry in `regionPriority` (in order), boards covering that
 *    region land in that bucket.
 *  - Boards covering "Global" land just after all explicit-region matches.
 *  - Off-region boards land last.
 *
 * Within a bucket, ties broken by `tier` ascending (Tier 1 before Tier 5).
 */
export function sortBoardsByRegionPriority(
  boards: JobBoard[],
  regionPriority: string[],
): JobBoard[] {
  const bucket = (b: JobBoard): number => {
    for (let i = 0; i < regionPriority.length; i++) {
      if (b.regions.includes(regionPriority[i] as BoardRegion)) return i;
    }
    if (b.regions.includes("Global")) return regionPriority.length;
    return regionPriority.length + 1;
  };
  return [...boards].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    return a.tier - b.tier;
  });
}
