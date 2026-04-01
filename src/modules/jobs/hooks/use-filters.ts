"use client";

import { useState, useMemo } from "react";
import type { Job } from "@shared/types/job";

export interface Filters {
  search: string;
  region: string;
  roleType: string;
  seniority: string;
  companyType: string;
  category: string;
  timeframeDays: number;
}

const initialFilters: Filters = {
  search: "",
  region: "All",
  roleType: "All",
  seniority: "All",
  companyType: "All",
  category: "All",
  timeframeDays: 999,
};

export function useFilters(jobs: Job[]) {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const filtered = useMemo(() => {
    const now = new Date();
    return jobs.filter((job) => {
      // Search
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

      // Region
      if (filters.region !== "All") {
        if (filters.region === "Remote" && !job.remote) return false;
        if (filters.region !== "Remote" && job.region !== filters.region)
          return false;
      }

      // Role type
      if (filters.roleType !== "All" && job.roleType !== filters.roleType)
        return false;

      // Seniority
      if (filters.seniority !== "All" && job.seniority !== filters.seniority)
        return false;

      // Company type
      if (
        filters.companyType !== "All" &&
        job.companyType !== filters.companyType
      )
        return false;

      // Category
      if (filters.category !== "All" && job.category !== filters.category)
        return false;

      // Timeframe
      if (filters.timeframeDays < 999) {
        const posted = new Date(job.postedDate);
        const diffDays =
          (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > filters.timeframeDays) return false;
      }

      return true;
    });
  }, [jobs, filters]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(initialFilters);

  return { filters, filtered, setFilter, resetFilters };
}
