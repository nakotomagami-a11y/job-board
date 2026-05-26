export const SCORING_WEIGHTS = {
  techStackOverlap: 25,
  regionMatch: 20,
  roleTypeMatch: 20,
  seniorityMatch: 15,
  categoryMatch: 10,
  recencyBonus: 5,
  salaryMatch: 5,
} as const;

// Industry convention: Lead ≈ Staff in most orgs, both below Principal.
export const SENIORITY_ORDER = [
  "Junior",
  "Mid",
  "Senior",
  "Staff",
  "Lead",
  "Principal",
  "Manager",
] as const;
