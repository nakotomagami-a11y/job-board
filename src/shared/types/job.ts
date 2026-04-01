export type Region =
  | "Remote"
  | "Europe"
  | "North America"
  | "Asia"
  | "UK"
  | "Hybrid";

export type RoleType =
  | "Frontend"
  | "Mobile"
  | "Full-Stack (Frontend-leaning)"
  | "Design Engineer"
  | "Creative Developer";

export type Seniority =
  | "Junior"
  | "Mid"
  | "Senior"
  | "Staff"
  | "Principal"
  | "Lead"
  | "Manager";

export type CompanyType =
  | "AAA Game Studio"
  | "Indie Game Studio"
  | "Gaming Platform"
  | "Tech Giant"
  | "Gaming Hardware"
  | "Dev Tools"
  | "Startup"
  | "Other";

export type Category =
  | "Gaming"
  | "Crypto / Web3"
  | "AI / ML"
  | "Fintech"
  | "SaaS / Dev Tools"
  | "E-Commerce"
  | "Social / Community"
  | "Other";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  companyType: CompanyType;
  location: string;
  region: Region;
  roleType: RoleType;
  seniority: Seniority;
  url: string;
  tags: string[];
  salary?: string;
  postedDate: string; // ISO date string YYYY-MM-DD
  verifiedDate: string; // ISO date when we last verified the link works
  source: string; // where we found it (careers page, linkedin, etc)
  remote: boolean;
  category: Category;
  description?: string;
  matchScore?: number;
  sourceType?: "seed" | "claude-search" | "manual";
  applied?: boolean;
  appliedDate?: string; // ISO date string YYYY-MM-DD
  rejected?: boolean;
}
