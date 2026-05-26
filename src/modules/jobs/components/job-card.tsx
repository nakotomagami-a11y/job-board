"use client";

import { useState } from "react";
import type { Job } from "@shared/types/job";
import { REGION_COLORS, ROLE_TYPE_COLORS } from "@shared/config/filters";
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
  const [aiState, setAiState] = useState<"idle" | "loading" | "queued" | "err">("idle");
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [blockState, setBlockState] = useState<"idle" | "loading" | "done" | "err">("idle");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const handleAutoApply = async () => {
    setAiState("loading");
    setAiMsg(null);
    try {
      const res = await fetch(API.applyDraft, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (res.ok) {
        setAiState("queued");
        setAiMsg("✓ Browser opening — scroll up to review");
        setTimeout(() => { setAiState("idle"); setAiMsg(null); }, 6000);
      } else {
        setAiState("err");
        setAiMsg(res.status === 409 ? "Another draft already pending — finish that first" : (data.error ?? "Failed"));
        setTimeout(() => { setAiState("idle"); setAiMsg(null); }, 6000);
      }
    } catch (e) {
      setAiState("err");
      setAiMsg(e instanceof Error ? e.message : "Failed");
      setTimeout(() => { setAiState("idle"); setAiMsg(null); }, 6000);
    }
  };
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
          <div className="card-actions">
            {job.applied && (
              <span className="badge badge-applied">Applied</span>
            )}
            {job.rejected && (
              <span className="badge badge-rejected">Rejected</span>
            )}
            {!job.rejected && !job.applied && (
              <button
                onClick={handleAutoApply}
                disabled={aiState === "loading"}
                className="apply-btn"
                title="AI fills the form in a real browser. You review and submit."
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#a78bfa",
                  fontSize: "0.78rem",
                  padding: "5px 10px",
                  cursor: aiState === "loading" ? "wait" : "pointer",
                  opacity: aiState === "loading" ? 0.6 : 1,
                }}
              >
                {aiState === "loading" ? "⏳" : "🤖"} AI Apply
              </button>
            )}
            {!job.rejected && (
              <button
                onClick={handleBlock}
                disabled={blockState === "loading"}
                className="apply-btn"
                title="Block all jobs from this company forever"
                style={{
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "#f87171",
                  fontSize: "0.78rem",
                  padding: "5px 8px",
                  cursor: blockState === "loading" ? "wait" : "pointer",
                  opacity: blockState === "loading" ? 0.6 : 1,
                }}
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
                className="card-action-btn card-action-applied"
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
                className="card-action-btn card-action-reject"
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

        {aiMsg && (
          <div style={{
            marginTop: 6,
            fontSize: "0.72rem",
            padding: "4px 8px",
            borderRadius: 6,
            display: "inline-block",
            background: aiState === "err" ? "rgba(248,113,113,0.08)" : "rgba(139,92,246,0.08)",
            color: aiState === "err" ? "#f87171" : "#a78bfa",
            border: `1px solid ${aiState === "err" ? "rgba(248,113,113,0.2)" : "rgba(139,92,246,0.2)"}`,
          }}>
            {aiMsg}
          </div>
        )}
        {blockMsg && (
          <div style={{
            marginTop: 6,
            fontSize: "0.72rem",
            padding: "4px 8px",
            borderRadius: 6,
            display: "inline-block",
            background: blockState === "err" ? "rgba(248,113,113,0.08)" : "rgba(248,113,113,0.06)",
            color: blockState === "err" ? "#f87171" : "#f87171",
            border: `1px solid rgba(248,113,113,0.2)`,
          }}>
            {blockMsg}
          </div>
        )}

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

          <span
            className="job-date"
            style={isStale(job.postedDate) ? { color: "var(--text-dim)" } : undefined}
          >
            {daysAgo(job.postedDate)}
            {isStale(job.postedDate) && (
              <span
                style={{
                  marginLeft: 4, fontSize: "0.65rem", fontWeight: 600,
                  color: "#ca8a04", background: "rgba(202,138,4,0.1)",
                  borderRadius: 4, padding: "1px 5px",
                }}
              >
                stale
              </span>
            )}
          </span>
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
