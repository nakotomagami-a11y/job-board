"use client";

import { useMemo, useState } from "react";
import { REGIONS, SENIORITIES, TIMEFRAMES } from "@/config/filters";
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
      <div className="filter-group-label">{label}</div>
      <div className="filter-row">
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
      filters.region !== "All",
      filters.roleType !== "All",
      filters.seniority !== "All",
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
    <div className="filters">
      {/* Always visible: Region + Posted Within */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <FilterGroup
            label="Region"
            options={REGIONS}
            value={filters.region}
            onChange={(v) => setFilter("region", v)}
          />
        </div>
        <div>
          <div className="filter-group-label">Posted Within</div>
          <div className="filter-row">
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
        <div className="filter-group-label">Status</div>
        <div className="filter-row">
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
                <span className="ml-1 text-[0.68rem] opacity-60">
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
            label="Seniority"
            options={SENIORITIES}
            value={filters.seniority}
            onChange={(v) => setFilter("seniority", v)}
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
