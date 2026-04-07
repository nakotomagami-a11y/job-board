"use client";

import { useState } from "react";
import type { Job } from "@shared/types/job";
import { useSources } from "../hooks/use-sources";

interface SourcesPanelProps {
  jobs: Job[];
}

export function SourcesPanel({ jobs }: SourcesPanelProps) {
  const { sources, error, refetch, save } = useSources();
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // Count jobs per source from actual data
  const sourceCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const key = j.source || "Unknown";
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  });

  const sortedSourceCounts = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1]);

  const toggleSource = (idx: number) => {
    const updated = [...sources];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    save(updated);
  };

  const removeSource = (idx: number) => {
    save(sources.filter((_, i) => i !== idx));
  };

  const addSource = () => {
    if (!newName.trim()) return;
    save([...sources, { name: newName.trim(), url: newUrl.trim(), enabled: true }]);
    setNewName("");
    setNewUrl("");
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn"
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}
      >
        📡 {expanded ? "Hide" : "Sources"}
        <span style={{
          background: "var(--c-primary)", color: "#0a0a0f",
          borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700,
        }}>
          {sources.filter((s) => s.enabled).length}
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
          {error && (
            <div style={{
              padding: "8px 12px", marginBottom: 12, borderRadius: 8,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              color: "#f87171", fontSize: "0.78rem",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span>Couldn&apos;t load sources: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn" style={{ fontSize: "0.72rem", padding: "2px 8px" }} onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {/* Job sources from actual data */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 8,
            }}>
              Where your jobs came from
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sortedSourceCounts.map(([source, count]) => (
                <span key={source} className="tag" style={{ display: "inline-flex", gap: 4 }}>
                  {source}
                  <span style={{ color: "var(--c-primary)", fontWeight: 600 }}>{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Configured sources for search */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 8,
            }}>
              Search sources (Claude uses these when finding jobs)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sources.map((source, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 8,
                  background: source.enabled ? "var(--surface)" : "transparent",
                  opacity: source.enabled ? 1 : 0.4,
                  fontSize: "0.8rem",
                }}>
                  <button
                    onClick={() => toggleSource(i)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.9rem", padding: 0, lineHeight: 1,
                    }}
                    title={source.enabled ? "Disable" : "Enable"}
                  >
                    {source.enabled ? "✓" : "○"}
                  </button>
                  <span style={{ color: "var(--text)", flex: 1 }}>{source.name}</span>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-dim)", fontSize: "0.72rem", textDecoration: "none" }}>
                      ↗
                    </a>
                  )}
                  <button
                    onClick={() => removeSource(i)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", fontSize: "0.75rem", padding: 0,
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add source */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text" className="search-input"
              style={{ paddingLeft: 10, flex: 1, fontSize: "0.8rem" }}
              placeholder="Source name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <input
              type="text" className="search-input"
              style={{ paddingLeft: 10, flex: 1, fontSize: "0.8rem" }}
              placeholder="URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <button className="filter-btn" onClick={addSource} disabled={!newName.trim()}
              style={{ fontSize: "0.78rem", flexShrink: 0 }}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
