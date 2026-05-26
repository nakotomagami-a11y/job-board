"use client";

import { useState } from "react";
import type { Job } from "@shared/types/job";
import { API } from "@lib/constants";

interface BatchModalProps {
  jobs: Job[];
  onClose: () => void;
  onStarted: (batchId: string) => void;
}

export function BatchModal({ jobs, onClose, onStarted }: BatchModalProps) {
  const candidates = jobs.filter((j) => !j.applied && !j.rejected);
  const top5 = candidates.slice(0, 5);
  const rest = candidates.slice(5);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(top5.map((j) => j.id)),
  );
  const [showMore, setShowMore] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleJob = (jobId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else if (next.size < 10) {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleStart = async () => {
    const jobIds = [...selected];
    if (jobIds.length === 0) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch(API.applyBatchStart, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds }),
      });
      const data = await res.json();
      if (res.ok) {
        onStarted(data.batchId as string);
        onClose();
      } else {
        setError((data as { error?: string }).error ?? "Failed to start batch");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start batch");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 24,
        maxWidth: 560,
        width: "92%",
        maxHeight: "80vh",
        overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
            🚀 Queue Batch Apply
          </span>
          <button className="filter-btn" onClick={onClose} style={{ padding: "4px 10px", fontSize: "0.78rem" }}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: 14 }}>
          Select up to 10 jobs. AI fills each form in sequence — browsers stay open side-by-side for your review.
        </p>

        {error && (
          <div style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.82rem",
            background: "rgba(248,113,113,0.08)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.2)",
          }}>
            {error}
          </div>
        )}

        {candidates.length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", margin: "20px 0" }}>
            No un-applied jobs in the current filtered view.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
              {top5.map((job) => (
                <JobRow key={job.id} job={job} checked={selected.has(job.id)} onToggle={toggleJob} />
              ))}
            </div>

            {rest.length > 0 && (
              <>
                <button
                  className="filter-btn"
                  onClick={() => setShowMore((s) => !s)}
                  style={{ fontSize: "0.72rem", padding: "4px 12px", marginBottom: 6 }}
                >
                  {showMore ? "▲ Hide" : `▼ + ${rest.length} more`}
                </button>
                {showMore && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                    {rest.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        checked={selected.has(job.id)}
                        onToggle={toggleJob}
                        dimmed={selected.size >= 10 && !selected.has(job.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {selected.size >= 10 && (
          <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 4, marginBottom: 4 }}>
            Maximum 10 jobs per batch.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            className="apply-btn"
            disabled={isStarting || selected.size === 0}
            onClick={handleStart}
            style={{
              padding: "10px 20px",
              fontSize: "0.85rem",
              opacity: isStarting || selected.size === 0 ? 0.5 : 1,
              background: "rgba(139,92,246,0.12)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#a78bfa",
            }}
          >
            {isStarting ? "⏳ Starting..." : `🚀 Start Batch (${selected.size})`}
          </button>
          <button
            className="filter-btn"
            onClick={onClose}
            style={{ padding: "10px 16px", fontSize: "0.85rem" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function JobRow({
  job,
  checked,
  onToggle,
  dimmed,
}: {
  job: Job;
  checked: boolean;
  onToggle: (id: string) => void;
  dimmed?: boolean;
}) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      background: checked ? "rgba(139,92,246,0.08)" : "transparent",
      border: `1px solid ${checked ? "rgba(139,92,246,0.2)" : "var(--border)"}`,
      borderRadius: "var(--radius-sm)",
      cursor: dimmed ? "not-allowed" : "pointer",
      opacity: dimmed ? 0.4 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => !dimmed && onToggle(job.id)}
        style={{ cursor: dimmed ? "not-allowed" : "pointer" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "var(--text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {job.title}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
          {job.company} · {job.roleType} · {job.region}
        </div>
      </div>
      {job.matchScore !== undefined && (
        <span style={{ fontSize: "0.7rem", color: "var(--c-secondary)", fontWeight: 600, flexShrink: 0 }}>
          {job.matchScore}%
        </span>
      )}
    </label>
  );
}
