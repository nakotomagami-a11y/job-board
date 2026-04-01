"use client";

import type { Job } from "@shared/types/job";

interface StatsBarProps {
  jobs: Job[];
  filteredCount: number;
}

export function StatsBar({ jobs, filteredCount }: StatsBarProps) {
  const remoteCount = jobs.filter((j) => j.remote).length;
  const europeCount = jobs.filter(
    (j) => j.region === "Europe" || j.region === "UK"
  ).length;
  const companies = new Set(jobs.map((j) => j.company)).size;

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-value">{filteredCount}</div>
        <div className="stat-label">
          {filteredCount === jobs.length ? "Positions" : "Matching"}
        </div>
      </div>
      <div className="stat">
        <div className="stat-value">{companies}</div>
        <div className="stat-label">Companies</div>
      </div>
      <div className="stat">
        <div className="stat-value">{remoteCount}</div>
        <div className="stat-label">Remote</div>
      </div>
      <div className="stat">
        <div className="stat-value">{europeCount}</div>
        <div className="stat-label">Europe / UK</div>
      </div>
    </div>
  );
}
