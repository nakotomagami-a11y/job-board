"use client";

import { useState } from "react";
import { REGIONS, SENIORITIES, TIMEFRAMES } from "@shared/config/filters";
import type { Filters } from "../hooks/use-filters";
import type { Job } from "@shared/types/job";

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
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length <= 1) return null; // Don't show if only "All"
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

  const hasActiveFilters =
    filters.region !== "All" ||
    filters.roleType !== "All" ||
    filters.seniority !== "All" ||
    filters.companyType !== "All" ||
    filters.category !== "All" ||
    filters.timeframeDays !== 999;

  // Build dynamic options from actual job data
  const categories = ["All", ...Array.from(new Set(jobs.map((j) => j.category))).sort()];
  const companyTypes = ["All", ...Array.from(new Set(jobs.map((j) => j.companyType))).sort()];
  const roleTypes = ["All", ...Array.from(new Set(jobs.map((j) => j.roleType))).sort()];

  // Count active filters for badge
  const activeCount = [
    filters.region !== "All",
    filters.roleType !== "All",
    filters.seniority !== "All",
    filters.companyType !== "All",
    filters.category !== "All",
    filters.timeframeDays !== 999,
  ].filter(Boolean).length;

  // Primary filters always visible: Region + Timeframe
  // Secondary filters behind "More filters" toggle
  return (
    <div className="filters">
      {/* Always visible: Region + Posted Within */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FilterGroup
            label="Region"
            options={REGIONS as unknown as string[]}
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

      {/* Toggle for more filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none", border: "none", color: "var(--text-dim)",
            fontSize: "0.75rem", cursor: "pointer", padding: 0, fontFamily: "inherit",
          }}
        >
          {expanded ? "▾ Less filters" : "▸ More filters"}
          {activeCount > 0 && !expanded && (
            <span style={{
              background: "var(--c-primary)", color: "#0a0a0f",
              borderRadius: 99, padding: "1px 6px", fontSize: "0.68rem",
              fontWeight: 700, marginLeft: 6,
            }}>
              {activeCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button className="clear-btn" onClick={resetFilters} style={{ fontSize: "0.72rem", padding: "3px 10px" }}>
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
            options={SENIORITIES as unknown as string[]}
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
