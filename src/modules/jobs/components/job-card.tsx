"use client";

import { useState } from "react";
import type { Job } from "@/types/job";
import { REGION_COLORS, ROLE_TYPE_COLORS } from "@/config/filters";
import { JobScoreBadge } from "./job-score-badge";
import { API } from "@lib/constants";

interface JobCardProps {
  job: Job;
  index: number;
  onMarkApplied?: (id: string) => void;
  onReject?: (id: string) => void;
  onBlocked?: (company: string) => void;
}

const COMPANY_COLORS = [
  "#38bdf8", "#34d399", "#a78bfa", "#fb923c",
  "#f472b6", "#f87171", "#06b6d4", "#84cc16",
];

function getCompanyColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COMPANY_COLORS[Math.abs(hash) % COMPANY_COLORS.length];
}

function getInitials(company: string): string {
  return company
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function daysAgo(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "1d ago";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function isStale(dateStr: string): boolean {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff >= 8;
}

export function JobCard({ job, index, onMarkApplied, onReject, onBlocked }: JobCardProps) {
  const companyColor = getCompanyColor(job.company);
  const [blockState, setBlockState] = useState<"idle" | "loading" | "done" | "err">("idle");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const handleBlock = async () => {
    const company = job.company ?? "this company";
    if (!confirm(`Block all current and future jobs from ${company}?`)) return;
    setBlockState("loading");
    setBlockMsg(null);
    try {
      const res = await fetch(API.blocklist, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, retroactive: true }),
      });
      const data = (await res.json()) as { added?: boolean; alreadyPresent?: boolean; retroactiveCount?: number; error?: string };
      if (res.ok) {
        setBlockState("done");
        const n = data.retroactiveCount ?? 0;
        setBlockMsg(`Blocked ${company} - ${n} job${n !== 1 ? "s" : ""} hidden`);
        onBlocked?.(company);
        setTimeout(() => { setBlockState("idle"); setBlockMsg(null); }, 6000);
      } else {
        setBlockState("err");
        setBlockMsg(data.error ?? "Failed to block");
        setTimeout(() => { setBlockState("idle"); setBlockMsg(null); }, 6000);
      }
    } catch (e) {
      setBlockState("err");
      setBlockMsg(e instanceof Error ? e.message : "Failed");
      setTimeout(() => { setBlockState("idle"); setBlockMsg(null); }, 6000);
    }
  };

  const regionColor = REGION_COLORS[job.region] ?? "#818cf8";
  const roleColor = ROLE_TYPE_COLORS[job.roleType] ?? "#38bdf8";

  return (
    <div
      className={`job-card${job.rejected ? " is-rejected" : ""}`}
      style={
        {
          "--card-accent": companyColor,
          animationDelay: `${Math.min(index * 0.04, 0.5)}s`,
        } as React.CSSProperties
      }
    >
      {/* Score badge */}
      {job.matchScore !== undefined && job.matchScore > 0 && (
        <JobScoreBadge score={job.matchScore} />
      )}

      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 tracking-tight"
        style={{
          background: `color-mix(in srgb, ${companyColor} 15%, transparent)`,
          color: companyColor,
          border: `1px solid color-mix(in srgb, ${companyColor} 25%, transparent)`,
        }}
      >
        {getInitials(job.company)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-text-base leading-[1.3] mb-0.5">{job.title}</div>
            <div className="text-text-muted text-[0.88rem]">{job.company}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-start">
            {job.applied && (
              <span className="badge bg-[rgba(52,211,153,0.15)] text-secondary">Applied</span>
            )}
            {job.rejected && (
              <span className="badge bg-[rgba(248,113,113,0.15)] text-danger">Rejected</span>
            )}
            {!job.rejected && (
              <button
                onClick={handleBlock}
                disabled={blockState === "loading"}
                className={`apply-btn bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.3)] text-danger text-[0.78rem] px-2 py-[5px] ${blockState === "loading" ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                title="Block all jobs from this company forever"
              >
                🚫
              </button>
            )}
            {!job.rejected && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="apply-btn"
              >
                Apply
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </a>
            )}
            {!job.applied && !job.rejected && onMarkApplied && (
              <button
                className="card-action-btn hover:bg-[rgba(52,211,153,0.15)] hover:border-[rgba(52,211,153,0.4)] hover:text-secondary"
                onClick={() => onMarkApplied(job.id)}
                title="Mark as applied"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            )}
            {!job.rejected && onReject && (
              <button
                className="card-action-btn hover:bg-[rgba(248,113,113,0.15)] hover:border-[rgba(248,113,113,0.4)] hover:text-danger"
                onClick={() => onReject(job.id)}
                title="Reject"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {blockMsg && (
          <div className={`mt-1.5 text-[0.72rem] px-2 py-1 rounded-md inline-block text-danger border border-[rgba(248,113,113,0.2)] ${blockState === "err" ? "bg-[rgba(248,113,113,0.08)]" : "bg-[rgba(248,113,113,0.06)]"}`}>
            {blockMsg}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="inline-flex items-center gap-1 text-text-muted text-[0.78rem]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {job.location}
          </span>

          <span
            className="badge badge-region"
            style={{ "--badge-color": regionColor } as React.CSSProperties}
          >
            {job.remote ? "🌍 " : ""}{job.region}
          </span>

          <span
            className="badge badge-role"
            style={{ "--badge-color": roleColor } as React.CSSProperties}
          >
            {job.roleType}
          </span>

          <span className="badge bg-white/5 text-text-dim text-[0.72rem]">{job.seniority}</span>

          <span className={`text-text-dim text-[0.75rem] ml-auto${isStale(job.postedDate) ? "" : ""}`}>
            {daysAgo(job.postedDate)}
            {isStale(job.postedDate) && (
              <span className="ml-1 text-[0.65rem] font-semibold text-[#ca8a04] bg-[rgba(202,138,4,0.1)] rounded px-[5px] py-[1px]">
                stale
              </span>
            )}
          </span>
        </div>

        {/* Salary */}
        {job.salary && <div className="text-secondary text-[0.82rem] font-semibold mt-1.5">💰 {job.salary}</div>}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {job.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {job.tags.length > 6 && (
            <span className="tag opacity-50">+{job.tags.length - 6}</span>
          )}
        </div>
      </div>
    </div>
  );
}
