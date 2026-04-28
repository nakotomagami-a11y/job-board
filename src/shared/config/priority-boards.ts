// Master list of job boards — each tagged with a tier (volume/category) and
// the regions it primarily covers. The /api/run-command rotation sorts by the
// candidate's region priority first, then by tier, so an EU-priority candidate
// hits dedicated EU boards before global aggregators before off-region boards.
//
// Curation rules:
//  - Aggregator boards only (no single-company talent platforms)
//  - No paywalled-only boards
//  - Verified live as of 2026-04-28

export type BoardRegion =
  | "Europe"
  | "Baltics"
  | "North America"
  | "UK"
  | "Asia"
  | "Remote"  // remote-first board (job inventory is mostly remote roles)
  | "Global"; // worldwide aggregator (no specific regional focus)

export type BoardTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface JobBoard {
  name: string;
  url: string;
  tier: BoardTier;
  regions: BoardRegion[];
  /** Hint string for the agent — board-specific URL patterns or search caveats. */
  notes?: string;
}

export const BOARDS: JobBoard[] = [
  // ── Tier 1: Mega aggregators ──────────────────────────────────────────
  // LinkedIn is the highest-yield single source — see COMMANDS.md for the
  // guest-API URL patterns. Always pass the candidate's top region as a filter.
  { name: "LinkedIn Jobs", url: "linkedin.com/jobs", tier: 1, regions: ["Global"],
    notes: "Use guest API: linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=...&location=...&f_TPR=r604800&f_WT=2" },
  { name: "Indeed", url: "indeed.com", tier: 1, regions: ["Global"] },
  { name: "Glassdoor", url: "glassdoor.com", tier: 1, regions: ["Global"] },
  { name: "Google Jobs", url: "google.com/jobs", tier: 1, regions: ["Global"] },
  { name: "ZipRecruiter", url: "ziprecruiter.com", tier: 1, regions: ["North America", "Global"] },

  // ── Tier 2: Remote-first boards ───────────────────────────────────────
  { name: "WeWorkRemotely", url: "weworkremotely.com", tier: 2, regions: ["Remote", "Global"] },
  { name: "RemoteOK", url: "remoteok.com", tier: 2, regions: ["Remote", "Global"],
    notes: "Public JSON API at remoteok.com/api" },
  { name: "arc.dev", url: "arc.dev/remote-jobs", tier: 2, regions: ["Remote", "Global"] },
  { name: "Working Nomads", url: "workingnomads.com", tier: 2, regions: ["Remote", "Global"],
    notes: "JS-rendered; use /api/scrape" },
  { name: "Himalayas", url: "himalayas.app", tier: 2, regions: ["Remote", "Global"],
    notes: "JS-rendered; use /api/scrape" },
  { name: "Remote.co", url: "remote.co", tier: 2, regions: ["Remote", "Global"] },
  { name: "Remotive", url: "remotive.com", tier: 2, regions: ["Remote", "Global"],
    notes: "Public JSON API at remotive.com/api/remote-jobs" },
  { name: "JustRemote", url: "justremote.co", tier: 2, regions: ["Remote", "Global"] },
  { name: "Remote Rocketship", url: "remoterocketship.com", tier: 2, regions: ["Remote", "Global"] },
  { name: "DailyRemote", url: "dailyremote.com", tier: 2, regions: ["Remote", "Global"] },
  { name: "Jobspresso", url: "jobspresso.co", tier: 2, regions: ["Remote", "Global"] },
  { name: "NoDesk", url: "nodesk.co", tier: 2, regions: ["Remote", "Global"] },
  { name: "Jobicy", url: "jobicy.com", tier: 2, regions: ["Remote", "Global"],
    notes: "Public JSON API at jobicy.com/api/v2/remote-jobs" },
  { name: "Dynamite Jobs", url: "dynamitejobs.com", tier: 2, regions: ["Remote", "Global"] },
  { name: "Arbeitnow", url: "arbeitnow.com", tier: 2, regions: ["Europe", "Remote"],
    notes: "Public JSON API at arbeitnow.com/api/job-board-api" },

  // ── Tier 3: Startup & tech focused ────────────────────────────────────
  { name: "Wellfound / AngelList", url: "wellfound.com", tier: 3, regions: ["Global"],
    notes: "JS-rendered; use /api/scrape" },
  { name: "Y Combinator Work at a Startup", url: "workatastartup.com", tier: 3, regions: ["North America", "Global"],
    notes: "JS-rendered; use /api/scrape" },
  { name: "startup.jobs", url: "startup.jobs", tier: 3, regions: ["Global"],
    notes: "403 to headless; use /api/scrape" },
  { name: "Built In", url: "builtin.com", tier: 3, regions: ["North America"] },
  { name: "Dice", url: "dice.com", tier: 3, regions: ["North America"] },
  { name: "The Muse", url: "themuse.com", tier: 3, regions: ["North America", "Global"] },
  { name: "HiringCafe", url: "hiring.cafe", tier: 3, regions: ["Global"] },
  { name: "Weekday", url: "jobs.weekday.works", tier: 3, regions: ["Asia", "Global"] },
  { name: "Levels.fyi Jobs", url: "levels.fyi/jobs", tier: 3, regions: ["Global"],
    notes: "26K+ jobs, salary data baked in" },

  // ── Tier 4: ATS platforms ─────────────────────────────────────────────
  { name: "Greenhouse boards", url: "boards.greenhouse.io", tier: 4, regions: ["Global"],
    notes: "Public JSON API; covered by /api/board-fetch for known companies" },
  { name: "Lever boards", url: "jobs.lever.co", tier: 4, regions: ["Global"],
    notes: "Public JSON API; covered by /api/board-fetch for known companies" },
  { name: "Ashby boards", url: "jobs.ashbyhq.com", tier: 4, regions: ["Global"],
    notes: "Public JSON API; covered by /api/board-fetch for known companies" },
  { name: "Workable", url: "apply.workable.com", tier: 4, regions: ["Global"] },
  { name: "SmartRecruiters", url: "careers.smartrecruiters.com", tier: 4, regions: ["Global"] },
  { name: "BambooHR", url: "bamboohr.com/jobs", tier: 4, regions: ["North America"] },

  // ── Tier 5: React/Frontend specific ───────────────────────────────────
  { name: "reactjobs.io", url: "reactjobs.io", tier: 5, regions: ["Global"] },
  { name: "Hacker News Who is Hiring", url: "hnhiring.com/technologies/react", tier: 5, regions: ["Global"] },
  { name: "Frontend Focus Jobs", url: "frontendfoc.us/jobs", tier: 5, regions: ["Global"] },

  // ── Tier 6: Industry niche ────────────────────────────────────────────
  { name: "web3.career", url: "web3.career", tier: 6, regions: ["Remote", "Global"] },
  { name: "CryptoJobsList", url: "cryptojobslist.com", tier: 6, regions: ["Remote", "Global"] },
  { name: "crypto.jobs", url: "crypto.jobs", tier: 6, regions: ["Remote", "Global"] },
  { name: "CryptocurrencyJobs", url: "cryptocurrencyjobs.co", tier: 6, regions: ["Remote", "Global"] },
  { name: "Remote3", url: "remote3.co", tier: 6, regions: ["Remote", "Global"] },
  { name: "Hitmarker Gaming", url: "hitmarker.net", tier: 6, regions: ["Global"] },
  { name: "Work With Indies", url: "workwithindies.com", tier: 6, regions: ["Global"] },
  { name: "RemoteGameJobs", url: "remotegamejobs.com", tier: 6, regions: ["Remote", "Global"] },
  { name: "AI Jobs", url: "aijobs.net", tier: 6, regions: ["Remote", "Global"] },
  { name: "Climatebase", url: "climatebase.org/jobs", tier: 6, regions: ["Global"],
    notes: "JS-rendered; use /api/scrape" },

  // ── Tier 7: European focused ──────────────────────────────────────────
  { name: "EU Remote Jobs", url: "euremotejobs.com", tier: 7, regions: ["Europe", "Remote"] },
  { name: "Remote Rocketship Europe", url: "remoterocketship.com/country/europe", tier: 7, regions: ["Europe", "Remote"] },
  { name: "The Hub", url: "thehub.io", tier: 7, regions: ["Europe"], notes: "Nordic startups" },
  { name: "Landing.jobs", url: "landing.jobs", tier: 7, regions: ["Europe"], notes: "Portugal + EU" },
  { name: "SwissDevJobs", url: "swissdevjobs.ch", tier: 7, regions: ["Europe"] },
  { name: "Berlin Startup Jobs", url: "berlinstartupjobs.com", tier: 7, regions: ["Europe"] },
  { name: "No Fluff Jobs Poland", url: "nofluffjobs.com", tier: 7, regions: ["Europe"] },
  { name: "Just Join IT Poland", url: "justjoin.it", tier: 7, regions: ["Europe"] },
  { name: "Pracuj.pl", url: "pracuj.pl", tier: 7, regions: ["Europe"], notes: "Poland; bot-blocked, use /api/scrape" },
  { name: "Welcome to the Jungle", url: "welcometothejungle.com", tier: 7, regions: ["Europe"],
    notes: "JS-rendered; also hosts ex-Otta listings" },
  { name: "MeetFrank", url: "meetfrank.com", tier: 7, regions: ["Europe", "Baltics"],
    notes: "Bot-blocked, use /api/scrape" },
  { name: "CVbankas Lithuania", url: "cvbankas.lt", tier: 7, regions: ["Europe", "Baltics"] },
  { name: "Relocate.me", url: "relocate.me/search", tier: 7, regions: ["Europe", "Global"],
    notes: "Relocation-friendly tech roles" },
];

/** Display label as it appears in the agent prompt and as a stable batch-state key. */
export function boardLabel(b: JobBoard): string {
  return `${b.name} (${b.url})`;
}

/**
 * Filter to the boards relevant for a given search scope.
 *  - "focused" → Tiers 1-3 only (mega + remote-first + startup, ~30 boards)
 *  - anything else → all boards
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
 * Within a bucket, ties broken by `tier` ascending (Tier 1 before Tier 7).
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

