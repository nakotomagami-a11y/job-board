export type BoardSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'recruitee'
  | 'personio'
  | 'arbeitnow'
  | 'linkedin'
  | 'linkedin-feed'
  | 'remotive'
  | 'remoteok'
  | 'himalayas'
  | 'jobicy'
  | 'workingnomads'
  | 'stepstone'
  | 'honeypot'
  | 'nofluff'
  | 'justjoinit'
  | 'pracuj'
  | 'cvbankas'
  | 'meetfrank'
  | 'thehub'
  | 'landingjobs'
  | 'wttj'
  | 'swissdevjobs'
  | 'wearedevelopers'
  | 'berlinstartupjobs'
  | 'eustartups'
  | 'relocateme'
  | 'euremotejobs'
  | 'lesjeudis'
  | 'other';

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
  | "Creative Developer"
  | "Generalist / Product Engineer"
  | "AI Engineer";

export type Seniority =
  | "Junior"
  | "Mid"
  | "Senior"
  | "Staff"
  | "Lead"
  | "Principal"
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
  sourceType?: "agent" | "manual";
  boardSource?: BoardSource;
  applied?: boolean;
  appliedDate?: string; // ISO date string YYYY-MM-DD
  rejected?: boolean;
}
