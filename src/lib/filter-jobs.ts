import type { Job } from "@shared/types/job";

export type StatusFilter = "All" | "Active" | "Applied" | "Rejected";

export interface Filters {
  search: string;
  region: string;
  roleType: string;
  seniority: string;
  companyType: string;
  category: string;
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
  timeframeDays: 999,
  status: "All",
};

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
