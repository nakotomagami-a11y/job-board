import type { Job } from "@/types/job";
import type { UserProfile } from "@/types/profile";
import { SCORING_WEIGHTS, SENIORITY_ORDER } from "@/config/scoring";
import { roleMatchesPrefs } from "@/config/role-aliases";
import { parseSalary } from "@lib/job-utils";

/**
 * Hard-reject rubric — applied before scoring. A job that hits any of these
 * is invalid by definition and should not be persisted, regardless of score.
 *
 * Returns null if the job passes all gates; otherwise the reason string for
 * logging / display.
 *
 * Hard rules:
 *  - URL is missing, malformed, or a search-results / index page
 *  - postedDate is older than `maxAgeDays` (default 30)
 *  - Tech stack has zero overlap with the candidate's skills (only checked
 *    when both sides have data — empty profile or empty tags = skip the gate)
 */
export function rubricReject(
  job: Job,
  profile: UserProfile,
  now: number = Date.now(),
  maxAgeDays = 30,
): string | null {
  // 1. URL sanity
  if (!job.url) return "missing url";
  try {
    const u = new URL(job.url);
    const path = u.pathname.toLowerCase();
    // Common search-results / listing-index patterns. We want direct apply links.
    if (/\/search\b|\/jobs\/?$|\/listings\/?$|\/results\b/.test(path) && !/\/jobs\/[^/]+/.test(path)) {
      return "url is a search/index page, not a direct apply link";
    }
  } catch {
    return "malformed url";
  }

  // 2. Recency
  const posted = new Date(job.postedDate).getTime();
  if (Number.isFinite(posted)) {
    const ageDays = (now - posted) / (1000 * 60 * 60 * 24);
    if (ageDays > maxAgeDays) return `posted ${Math.round(ageDays)} days ago (>${maxAgeDays})`;
  }

  // 3. Skill overlap — enforced when profile has skills AND we have data to
  //    evaluate. Skip entirely when both tags and description are absent (e.g.
  //    ATS API cards) — the title-only check is too narrow and produces false
  //    rejects for generic titles like "Software Engineer".
  if (profile.skills.length > 0) {
    const hasData = job.tags.length > 0 || (job.description ?? "").trim().length > 0;
    if (hasData) {
      const profileSkills = profile.skills.map((s) => s.toLowerCase());
      if (job.tags.length > 0) {
        const jobTags = job.tags.map((t) => t.toLowerCase());
        const anyOverlap = profileSkills.some((s) =>
          jobTags.some((t) => t.includes(s) || s.includes(t)),
        );
        if (!anyOverlap) return "zero overlap with candidate skills";
      } else {
        const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
        const anyOverlap = profileSkills.some((s) => haystack.includes(s));
        if (!anyOverlap) return "zero overlap with candidate skills (no tags; scanned title+desc)";
      }
    }
  }

  return null;
}

/**
 * Score a job against a user profile out of 100. Pure function — extracted
 * from useJobScoring so it can be unit-tested without React.
 *
 * `now` is injected so recency tests are deterministic; defaults to Date.now().
 */
export function scoreJob(job: Job, profile: UserProfile, now: number = Date.now()): number {
  let total = 0;

  // Tech stack overlap (25 pts)
  if (profile.skills.length > 0) {
    const profileSkillsLower = profile.skills.map((s) => s.toLowerCase());
    const jobTagsLower = job.tags.map((t) => t.toLowerCase());
    const matches = profileSkillsLower.filter((s) =>
      jobTagsLower.some((t) => t.includes(s) || s.includes(t))
    ).length;
    total +=
      (matches / profileSkillsLower.length) * SCORING_WEIGHTS.techStackOverlap;
  } else {
    total += SCORING_WEIGHTS.techStackOverlap * 0.5;
  }

  // Region match (20 pts) — graduated by priority order in preferredRegions.
  // Index 0 (top priority) gets full credit; later entries get partial credit;
  // off-region remote-allowed jobs get a smaller bonus when the candidate is
  // remote-leaning. This is what makes "EU first, then remote anywhere" actually
  // bias the ranking instead of treating both regions equally.
  //
  // When a job is remote=true AND has a specific region (e.g. "Europe"),
  // check both labels and award the better score — a "Remote, EU-based" job
  // randomly gets tagged either "Remote" or "Europe" by the subagent, so we
  // shouldn't penalise it for which label won the coin flip.
  if (profile.preferredRegions.length > 0) {
    const regionCandidates: string[] = [job.region];
    if (job.remote && job.region !== "Remote") regionCandidates.push("Remote");

    let regionScore = 0;
    for (const candidate of regionCandidates) {
      const idx = profile.preferredRegions.indexOf(candidate as typeof profile.preferredRegions[number]);
      let s = 0;
      if (idx === 0) s = SCORING_WEIGHTS.regionMatch;
      else if (idx > 0) s = SCORING_WEIGHTS.regionMatch * 0.7;
      else if (profile.remotePreference === "remote" && job.remote) s = SCORING_WEIGHTS.regionMatch * 0.5;
      if (s > regionScore) regionScore = s;
    }
    total += regionScore;
  } else if (profile.remotePreference === "remote" && job.remote) {
    total += SCORING_WEIGHTS.regionMatch;
  } else {
    total += SCORING_WEIGHTS.regionMatch * 0.5;
  }

  // Role type match (20 pts) — alias-aware fuzzy match against preferredRoles.
  // roleMatchesPrefs checks direct substrings AND canonical-role equivalence,
  // so "React Developer" in prefs still matches a job tagged "Frontend" even
  // if neither string contains the other.
  if (profile.preferredRoles.length > 0) {
    const hasMatch = roleMatchesPrefs(job.roleType, job.title, profile.preferredRoles);
    total += hasMatch
      ? SCORING_WEIGHTS.roleTypeMatch
      : SCORING_WEIGHTS.roleTypeMatch * 0.2;
  } else {
    total += SCORING_WEIGHTS.roleTypeMatch * 0.5;
  }

  // Seniority match (15 pts)
  if (profile.preferredSeniority.length > 0) {
    if (profile.preferredSeniority.includes(job.seniority)) {
      total += SCORING_WEIGHTS.seniorityMatch;
    } else {
      const jobIdx = SENIORITY_ORDER.indexOf(
        job.seniority as (typeof SENIORITY_ORDER)[number]
      );
      const closestDist = Math.min(
        ...profile.preferredSeniority.map((s) => {
          const idx = SENIORITY_ORDER.indexOf(
            s as (typeof SENIORITY_ORDER)[number]
          );
          return Math.abs(jobIdx - idx);
        })
      );
      if (closestDist === 1) total += SCORING_WEIGHTS.seniorityMatch * 0.75;
      else if (closestDist === 2) total += SCORING_WEIGHTS.seniorityMatch * 0.25;
    }
  } else {
    total += SCORING_WEIGHTS.seniorityMatch * 0.5;
  }

  // Category match (10 pts) — fuzzy match against free-form categories
  if (profile.preferredCategories.length > 0) {
    const jobCatLower = job.category.toLowerCase();
    const jobDescLower = (job.description || "").toLowerCase();
    const hasMatch = profile.preferredCategories.some((pref) => {
      const prefLower = pref.toLowerCase();
      return (
        jobCatLower.includes(prefLower) ||
        prefLower.includes(jobCatLower) ||
        jobDescLower.includes(prefLower)
      );
    });
    total += hasMatch ? SCORING_WEIGHTS.categoryMatch : 0;
  } else {
    total += SCORING_WEIGHTS.categoryMatch * 0.5;
  }

  // Recency bonus (5 pts) — linear decay over 30 days
  const daysSincePosted = Math.floor(
    (now - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recency = Math.max(0, 1 - daysSincePosted / 30);
  total += recency * SCORING_WEIGHTS.recencyBonus;

  // Salary match (5 pts)
  if (profile.salaryRange && job.salary) {
    const range = parseSalary(job.salary);
    if (range) {
      const profileMin = profile.salaryRange.min;
      const profileMax = profile.salaryRange.max;
      if (range.max >= profileMin && range.min <= profileMax) {
        total += SCORING_WEIGHTS.salaryMatch;
      }
    }
  } else {
    total += SCORING_WEIGHTS.salaryMatch * 0.3;
  }

  return Math.round(total);
}

export type StatusFilter = "All" | "Active" | "Applied" | "Rejected";

export interface Filters {
  search: string;
  region: string;
  roleType: string;
  seniority: string;
  companyType: string;
  category: string;
  source: string;
  timeframeDays: number;
  status: StatusFilter;
}

export const initialFilters: Filters = {
  search: "",
  region: "All",
  roleType: "All",
  seniority: "All",
  companyType: "All",
  category: "All",
  source: "All",
  timeframeDays: 999,
  status: "All",
};

// Subagents and the browser flow have written `source` inconsistently over
// time ("LinkedIn Jobs" / "linkedin", "RemoteOK" / "remoteok", etc.). Collapse
// the variants to one canonical board label so the Platform filter shows one
// button per board, not three. NOTE: "LinkedIn Feed" stays a separate bucket
// from "LinkedIn" because the feed scanner pulls a different signal (network-
// shared posts) and we want it filterable as its own category.
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown";
  if (source === "LinkedIn Feed") return "LinkedIn Feed";
  const key = source.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "linkedinfeed") return "LinkedIn Feed";
  const map: Record<string, string> = {
    linkedin: "LinkedIn",
    linkedinjobs: "LinkedIn",
    remoteok: "RemoteOK",
    weworkremotely: "WeWorkRemotely",
    workingnomads: "Working Nomads",
    remoterocketship: "Remote Rocketship",
    dailyremote: "DailyRemote",
    dynamitejobs: "Dynamite Jobs",
    nodesk: "NoDesk",
    arcdev: "arc.dev",
    dicecom: "Dice",
    dice: "Dice",
    greenhouse: "Greenhouse",
    ashby: "Ashby",
    lever: "Lever",
    hiringcafe: "HiringCafe",
    wellfound: "Wellfound",
    indeed: "Indeed",
    glassdoor: "Glassdoor",
    himalayas: "Himalayas",
    remotive: "Remotive",
    jobicy: "Jobicy",
    arbeitnow: "Arbeitnow",
    jobspresso: "Jobspresso",
    justremote: "JustRemote",
    weekday: "Weekday",
    startupjobs: "startup.jobs",
  };
  return map[key] ?? source;
}

/**
 * Pure filter predicate — extracted from useFilters so it can be unit-tested
 * without React. `now` is injected for deterministic timeframe tests.
 */
export function applyFilters(jobs: Job[], filters: Filters, now: number = Date.now()): Job[] {
  return jobs.filter((job) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchable = [
        job.title,
        job.company,
        job.location,
        job.description ?? "",
        ...job.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    if (filters.region !== "All") {
      if (filters.region === "Remote" && !job.remote) return false;
      if (filters.region !== "Remote" && job.region !== filters.region) return false;
    }

    if (filters.roleType !== "All" && job.roleType !== filters.roleType) return false;
    if (filters.seniority !== "All" && job.seniority !== filters.seniority) return false;
    if (filters.companyType !== "All" && job.companyType !== filters.companyType) return false;
    if (filters.category !== "All" && job.category !== filters.category) return false;
    if (filters.source !== "All" && sourceLabel(job.source) !== filters.source) return false;

    if (filters.timeframeDays < 999) {
      const posted = new Date(job.postedDate).getTime();
      const diffDays = (now - posted) / (1000 * 60 * 60 * 24);
      if (diffDays > filters.timeframeDays) return false;
    }

    if (filters.status === "Applied" && !job.applied) return false;
    if (filters.status === "Rejected" && !job.rejected) return false;
    if (filters.status === "Active" && (job.applied || job.rejected)) return false;

    return true;
  });
}
