"use client";

import type { Job } from "@shared/types/job";
import { REGION_COLORS, ROLE_TYPE_COLORS } from "@shared/config/filters";
import { JobScoreBadge } from "./job-score-badge";

interface JobCardProps {
  job: Job;
  index: number;
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

export function JobCard({ job, index }: JobCardProps) {
  const companyColor = getCompanyColor(job.company);
  const regionColor = REGION_COLORS[job.region] ?? "#818cf8";
  const roleColor = ROLE_TYPE_COLORS[job.roleType] ?? "#38bdf8";

  return (
    <div
      className="job-card"
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
        className="company-avatar"
        style={{
          background: `color-mix(in srgb, ${companyColor} 15%, transparent)`,
          color: companyColor,
          border: `1px solid color-mix(in srgb, ${companyColor} 25%, transparent)`,
        }}
      >
        {getInitials(job.company)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="job-title">{job.title}</div>
            <div className="job-company">{job.company}</div>
          </div>
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
        </div>

        {/* Meta row */}
        <div className="job-meta">
          <span className="job-location">
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

          <span className="badge badge-seniority">{job.seniority}</span>

          <span className="job-date">{daysAgo(job.postedDate)}</span>
        </div>

        {/* Salary */}
        {job.salary && <div className="job-salary">💰 {job.salary}</div>}

        {/* Tags */}
        <div className="job-tags">
          {job.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {job.tags.length > 6 && (
            <span className="tag" style={{ opacity: 0.5 }}>+{job.tags.length - 6}</span>
          )}
        </div>
      </div>
    </div>
  );
}
