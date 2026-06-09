"use client";

import { useMemo, useState } from "react";
import { TIMEFRAMES } from "@/config/filters";
import { sourceLabel } from "@lib/job-scoring";
import type { Filters, StatusFilter } from "../hooks/use-filters";
import type { Job } from "@/types/job";

const STATUS_OPTIONS: StatusFilter[] = ["All", "Active", "Applied", "Rejected"];

interface FilterBarProps {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  jobs: Job[];
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div>
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            className={`filter-btn ${value === opt ? "active" : ""}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ filters, setFilter, resetFilters, jobs }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const { statusCounts, categories, companyTypes, roleTypes, sources } = useMemo(() => {
    let applied = 0;
    let rejected = 0;
    let active = 0;
    const categorySet = new Set<string>();
    const companyTypeSet = new Set<string>();
    const roleTypeSet = new Set<string>();
    const sourceSet = new Set<string>();

    for (const j of jobs) {
      if (j.applied) applied++;
      else if (j.rejected) rejected++;
      else active++;
      categorySet.add(j.category);
      companyTypeSet.add(j.companyType);
      roleTypeSet.add(j.roleType);
      if (j.source) sourceSet.add(sourceLabel(j.source));
    }

    return {
      statusCounts: { Applied: applied, Rejected: rejected, Active: active },
      categories: ["All", ...Array.from(categorySet).sort()],
      companyTypes: ["All", ...Array.from(companyTypeSet).sort()],
      roleTypes: ["All", ...Array.from(roleTypeSet).sort()],
      sources: ["All", ...Array.from(sourceSet).sort()],
    };
  }, [jobs]);

  const { hasActiveFilters, activeCount } = useMemo(() => {
    const flags = [
      filters.roleType !== "All",
      filters.companyType !== "All",
      filters.category !== "All",
      filters.source !== "All",
      filters.timeframeDays !== 999,
      filters.status !== "All",
    ];
    const count = flags.filter(Boolean).length;
    return { hasActiveFilters: count > 0, activeCount: count };
  }, [filters]);

  return (
    <div className="flex flex-col gap-[14px] mb-8">
      {/* Posted Within */}
      <div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim mb-1.5">Posted Within</div>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              className={`filter-btn ${filters.timeframeDays === tf.days ? "active" : ""}`}
              onClick={() => setFilter("timeframeDays", tf.days)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform filter */}
      {sources.length > 2 && (
        <FilterGroup
          label="Platform"
          options={sources}
          value={filters.source}
          onChange={(v) => setFilter("source", v)}
        />
      )}

      {/* Status filter */}
      <div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim mb-1.5">Status</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`filter-btn ${filters.status === opt ? "active" : ""}`}
              onClick={() => setFilter("status", opt)}
              style={
                opt === "Applied" && filters.status === opt
                  ? { background: "rgba(52,211,153,0.15)", borderColor: "rgba(52,211,153,0.4)", color: "#34d399" }
                  : opt === "Rejected" && filters.status === opt
                    ? { background: "rgba(248,113,113,0.15)", borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }
                    : undefined
              }
            >
              {opt}
              {opt !== "All" && (
                <span className="text-[0.68rem] opacity-60">
                  {statusCounts[opt]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle for more filters */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="bg-transparent border-none text-text-dim text-[0.75rem] cursor-pointer p-0 font-[inherit]"
        >
          {expanded ? "▾ Less filters" : "▸ More filters"}
          {activeCount > 0 && !expanded && (
            <span className="bg-primary text-[#0a0a0f] rounded-full px-[6px] py-[1px] text-[0.68rem] font-bold ml-1.5">
              {activeCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button className="clear-btn text-[0.72rem] px-2.5 py-[3px]" onClick={resetFilters}>
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {expanded && (
        <>
          <FilterGroup
            label="Role Type"
            options={roleTypes}
            value={filters.roleType}
            onChange={(v) => setFilter("roleType", v)}
          />
          <FilterGroup
            label="Category"
            options={categories}
            value={filters.category}
            onChange={(v) => setFilter("category", v)}
          />
          <FilterGroup
            label="Company Type"
            options={companyTypes}
            value={filters.companyType}
            onChange={(v) => setFilter("companyType", v)}
          />
        </>
      )}
    </div>
  );
}
