export const REGIONS = [
  "All",
  "Remote",
  "Europe",
  "UK",
  "North America",
  "Asia",
  "Hybrid",
] as const;

export const ROLE_TYPES = [
  "All",
  "Frontend",
  "Mobile",
  "Full-Stack (Frontend-leaning)",
  "Design Engineer",
  "Creative Developer",
] as const;

export const SENIORITIES = [
  "All",
  "Junior",
  "Mid",
  "Senior",
  "Staff",
  "Principal",
  "Lead",
  "Manager",
] as const;

export const COMPANY_TYPES = [
  "All",
  "AAA Game Studio",
  "Indie Game Studio",
  "Gaming Platform",
  "Tech Giant",
  "Gaming Hardware",
  "Dev Tools",
  "Startup",
  "Other",
] as const;

export const TIMEFRAMES = [
  { label: "All", days: 999 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
] as const;

export const CATEGORIES = [
  "All",
  "Gaming",
  "Crypto / Web3",
  "AI / ML",
  "Fintech",
  "SaaS / Dev Tools",
  "E-Commerce",
  "Social / Community",
  "Other",
] as const;

export const REGION_COLORS: Record<string, string> = {
  Remote: "#34d399",
  Europe: "#38bdf8",
  UK: "#a78bfa",
  "North America": "#fb923c",
  Asia: "#f472b6",
  Hybrid: "#818cf8",
};

export const ROLE_TYPE_COLORS: Record<string, string> = {
  Frontend: "#38bdf8",
  Mobile: "#34d399",
  "Full-Stack (Frontend-leaning)": "#fb923c",
  "Design Engineer": "#f472b6",
  "Creative Developer": "#a78bfa",
};
