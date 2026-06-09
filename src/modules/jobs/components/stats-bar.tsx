"use client";

import type { Job } from "@/types/job";

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
    <div className="flex gap-8 justify-center py-5 mb-12 border-b border-border">
      <span className="badge bg-[rgba(167,139,250,0.15)] text-purple self-center">EU-only policy active</span>
      <div className="text-center">
        <div className="text-[1.8rem] font-extrabold text-text-base leading-none">{filteredCount}</div>
        <div className="text-[0.7rem] text-text-dim uppercase tracking-[0.06em] mt-1">
          {filteredCount === jobs.length ? "Positions" : "Matching"}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[1.8rem] font-extrabold text-text-base leading-none">{companies}</div>
        <div className="text-[0.7rem] text-text-dim uppercase tracking-[0.06em] mt-1">Companies</div>
      </div>
      <div className="text-center">
        <div className="text-[1.8rem] font-extrabold text-text-base leading-none">{remoteCount}</div>
        <div className="text-[0.7rem] text-text-dim uppercase tracking-[0.06em] mt-1">Remote</div>
      </div>
      <div className="text-center">
        <div className="text-[1.8rem] font-extrabold text-text-base leading-none">{europeCount}</div>
        <div className="text-[0.7rem] text-text-dim uppercase tracking-[0.06em] mt-1">Europe / UK</div>
      </div>
    </div>
  );
}
