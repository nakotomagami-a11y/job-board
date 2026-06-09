"use client";

import { useState } from "react";
import type { Job } from "@/types/job";
import { useSources } from "../hooks/use-sources";

interface SourcesPanelProps {
  jobs: Job[];
}

export function SourcesPanel({ jobs }: SourcesPanelProps) {
  const { sources, error, refetch, save } = useSources();
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

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
        className="filter-btn flex items-center gap-1.5 text-[0.82rem]"
      >
        📡 {expanded ? "Hide" : "Sources"}
        <span className="bg-primary text-[#0a0a0f] rounded-full px-[7px] py-[1px] text-[0.72rem] font-bold">
          {sources.filter((s) => s.enabled).length}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 max-w-[560px] mx-auto">
          {error && (
            <div className="px-3 py-2 mb-3 rounded-lg bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-danger text-[0.78rem] flex items-center justify-between gap-2">
              <span>Couldn&apos;t load sources: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn text-[0.72rem] px-2 py-[2px]" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {/* Job sources from actual data */}
          <div className="mb-5">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-text-dim mb-2">
              Where your jobs came from
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sortedSourceCounts.map(([source, count]) => (
                <span key={source} className="tag inline-flex gap-1">
                  {source}
                  <span className="text-primary font-semibold">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Configured sources for search */}
          <div className="mb-4">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-text-dim mb-2">
              Search sources (Claude uses these when finding jobs)
            </div>
            <div className="flex flex-col gap-1">
              {sources.map((source, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[0.8rem] ${source.enabled ? "bg-surface" : "bg-transparent"} ${source.enabled ? "opacity-100" : "opacity-40"}`}>
                  <button
                    onClick={() => toggleSource(i)}
                    className="bg-transparent border-none cursor-pointer text-[0.9rem] p-0 leading-none"
                    title={source.enabled ? "Disable" : "Enable"}
                  >
                    {source.enabled ? "✓" : "○"}
                  </button>
                  <span className="text-text-base flex-1">{source.name}</span>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer"
                      className="text-text-dim text-[0.72rem] no-underline">
                      ↗
                    </a>
                  )}
                  <button
                    onClick={() => removeSource(i)}
                    className="bg-transparent border-none cursor-pointer text-text-dim text-[0.75rem] p-0"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add source */}
          <div className="flex gap-1.5">
            <input
              type="text" className="search-input pl-2.5 flex-1 text-[0.8rem]"
              placeholder="Source name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <input
              type="text" className="search-input pl-2.5 flex-1 text-[0.8rem]"
              placeholder="URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <button className="filter-btn text-[0.78rem] shrink-0" onClick={addSource} disabled={!newName.trim()}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
