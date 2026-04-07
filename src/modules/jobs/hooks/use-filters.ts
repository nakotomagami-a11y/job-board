"use client";

import { useState, useMemo } from "react";
import type { Job } from "@shared/types/job";
import { applyFilters, initialFilters, type Filters } from "@lib/filter-jobs";

export type { Filters, StatusFilter } from "@lib/filter-jobs";

export function useFilters(jobs: Job[]) {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const filtered = useMemo(() => applyFilters(jobs, filters), [jobs, filters]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(initialFilters);

  return { filters, filtered, setFilter, resetFilters };
}
