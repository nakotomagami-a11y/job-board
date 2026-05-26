import type { RoleType } from "@shared/types/job";

// Maps each canonical RoleType to title-substring patterns (all lowercase).
// Checked in declaration order — more-specific roles first so "react native"
// doesn't fall into the generic "react developer" → Frontend bucket.
export const ROLE_ALIASES: Record<RoleType, string[]> = {
  Mobile: [
    "react native", "mobile", "ios", "android", "flutter",
  ],
  "Design Engineer": [
    "design engineer",
  ],
  "Creative Developer": [
    "creative developer", "creative technologist", "creative engineer",
    "webgl developer", "three.js developer", "motion developer",
  ],
  "AI Engineer": [
    "ai engineer", "ml engineer", "llm engineer", "genai engineer",
    "applied ai", "machine learning engineer", "ai/ml",
  ],
  "Generalist / Product Engineer": [
    "founding engineer", "product engineer", "forward deployed",
    "solutions engineer", "software engineer", "platform engineer",
  ],
  "Full-Stack (Frontend-leaning)": [
    "full stack", "fullstack", "full-stack",
    "middle full", // CEE naming: "Middle Full-Stack Developer"
  ],
  Frontend: [
    "frontend", "front-end", "front end",
    "react developer", "react engineer",
    "ui engineer", "ui developer",
    "javascript engineer", "typescript engineer",
    "html developer", "markup developer",
    "web developer", "web engineer",
    "next.js developer", "nextjs developer",
    "vue developer", "angular developer",
  ],
};

// Seniority variant → canonical Seniority value.
export const SENIORITY_ALIASES: Record<string, string> = {
  sr: "Senior",
  "sr.": "Senior",
  iii: "Senior",
  ii: "Mid",
  middle: "Mid",
  "mid-level": "Mid",
  "mid level": "Mid",
  entry: "Junior",
  "jr.": "Junior",
  graduate: "Junior",
};

/**
 * Map a raw job title to its best-matching canonical RoleType.
 * Checks ROLE_ALIASES patterns in declaration order (more-specific first).
 */
export function canonicalizeRole(title: string): RoleType {
  const t = title.toLowerCase();
  for (const [role, patterns] of Object.entries(ROLE_ALIASES) as [RoleType, string[]][]) {
    if (patterns.some((p) => t.includes(p))) return role;
  }
  return "Frontend";
}

/**
 * True when a job's roleType or title matches any of the candidate's
 * preferredRoles — checked both by direct substring and via alias expansion.
 * Used by score-job.ts so that "React Developer" in the profile still matches
 * a job with roleType "Generalist / Product Engineer" whose title is
 * "Senior React Developer".
 */
export function roleMatchesPrefs(
  roleType: string,
  title: string,
  preferredRoles: string[],
): boolean {
  const roleLower = roleType.toLowerCase();
  const titleLower = title.toLowerCase();
  const jobCanon = canonicalizeRole(title);

  return preferredRoles.some((pref) => {
    const prefLower = pref.toLowerCase();

    // Direct substring match (preserves existing behaviour)
    if (roleLower.includes(prefLower) || prefLower.includes(roleLower)) return true;
    if (titleLower.includes(prefLower) || prefLower.includes(titleLower.split(",")[0])) return true;

    // Alias expansion: do the canonical roles of the pref and the job agree?
    const prefCanon = canonicalizeRole(pref);
    if (prefCanon === jobCanon) return true;

    // Does any alias of the job's canonical role appear in the pref string?
    const jobAliases = ROLE_ALIASES[jobCanon] ?? [];
    if (jobAliases.some((a) => prefLower.includes(a) || a.includes(prefLower))) return true;

    return false;
  });
}
