export const SCORING_WEIGHTS = {
  techStackOverlap: 25,
  regionMatch: 20,
  roleTypeMatch: 20,
  seniorityMatch: 15,
  categoryMatch: 10,
  recencyBonus: 5,
  salaryMatch: 5,
} as const;

export const SENIORITY_ORDER = [
  "Junior",
  "Mid",
  "Senior",
  "Staff",
  "Principal",
  "Lead",
  "Manager",
] as const;
