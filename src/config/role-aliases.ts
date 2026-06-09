import type { RoleType } from "@/types/job";

export const ROLE_ALIASES: Record<RoleType, string[]> = {
  Mobile: [
    "react native", "mobile", "ios", "android", "flutter", "expo", "swift", "kotlin",
  ],
  Fullstack: [
    "full stack", "fullstack", "full-stack",
  ],
  Backend: [
    "backend", "back-end", "back end", "devops", "infrastructure", "data engineer",
    "ml engineer", "machine learning", "site reliability", "sre",
  ],
  Frontend: [
    "frontend", "front-end", "front end",
    "ui engineer", "ui developer", "ux engineer",
    "design engineer", "creative developer", "creative technologist",
    "web developer", "web engineer",
  ],
  Other: [],
};

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

export function canonicalizeRole(title: string): RoleType {
  const t = title.toLowerCase();
  for (const [role, patterns] of Object.entries(ROLE_ALIASES) as [RoleType, string[]][]) {
    if (patterns.some((p) => t.includes(p))) return role;
  }
  return "Frontend";
}

export function roleMatchesPrefs(
  roleType: string,
  title: string,
  preferredRoles: string[],
): boolean {
  if (preferredRoles.length === 0) return false;
  const jobCanon = canonicalizeRole(title);

  return preferredRoles.some((pref) => {
    const prefCanon = canonicalizeRole(pref);
    if (prefCanon === roleType || prefCanon === jobCanon) return true;
    const prefLower = pref.toLowerCase();
    const roleLower = roleType.toLowerCase();
    return roleLower.includes(prefLower) || prefLower.includes(roleLower);
  });
}
