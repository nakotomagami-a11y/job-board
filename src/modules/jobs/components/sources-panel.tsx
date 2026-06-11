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

  const sorted = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 1;

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

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn flex items-center gap-1.5 text-[0.82rem]"
      >
        📡 {expanded ? "Hide" : "Sources"}
        <span className="bg-primary text-[#0a0a0f] rounded-full px-[7px] py-[1px] text-[0.72rem] font-bold">
          {enabledCount}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 max-w-[620px] mx-auto flex flex-col gap-6">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-danger text-[0.78rem] flex items-center justify-between gap-2">
              <span>Couldn&apos;t load sources: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn text-[0.72rem] px-2 py-[2px]" onClick={() => refetch()}>Retry</button>
            </div>
          )}

          {/* ── Where jobs came from ─────────────────────────── */}
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim mb-3">
              Where your jobs came from
            </div>
            <div className="flex flex-col gap-1.5">
              {sorted.map(([source, count]) => {
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={source} className="flex items-center gap-3 group">
                    <span className="text-[0.78rem] text-text-muted w-[160px] shrink-0 truncate">{source}</span>
                    <div className="flex-1 h-[5px] rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%`, opacity: 0.55 + pct * 0.0045 }}
                      />
                    </div>
                    <span className="text-[0.78rem] font-semibold text-primary w-7 text-right shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Search sources ───────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Search sources
              </div>
              <span className="text-[0.68rem] text-text-dim">{enabledCount} / {sources.length} active</span>
            </div>
            <div className="flex flex-col gap-1">
              {sources.map((source, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                    source.enabled
                      ? "bg-surface border-border"
                      : "bg-transparent border-transparent opacity-40"
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleSource(i)}
                    title={source.enabled ? "Disable" : "Enable"}
                    className={`w-8 h-4.5 rounded-full shrink-0 transition-colors duration-200 relative cursor-pointer border-none p-0 ${
                      source.enabled ? "bg-primary" : "bg-[rgba(255,255,255,0.1)]"
                    }`}
                    style={{ width: 32, height: 18 }}
                  >
                    <span
                      className="absolute top-[3px] rounded-full bg-white transition-all duration-200"
                      style={{
                        width: 12,
                        height: 12,
                        left: source.enabled ? 17 : 3,
                      }}
                    />
                  </button>

                  {/* Name */}
                  <span className={`flex-1 text-[0.82rem] font-medium truncate ${source.enabled ? "text-text-base" : "text-text-dim"}`}>
                    {source.name}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-base hover:bg-surface-hover transition-all no-underline text-[0.75rem]"
                        title="Open board"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 2H10V5M10 2L5 7M3 3H2C1.45 3 1 3.45 1 4V10C1 10.55 1.45 11 2 11H8C8.55 11 9 10.55 9 10V9" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => removeSource(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-danger hover:bg-[rgba(248,113,113,0.08)] transition-all cursor-pointer border-none bg-transparent"
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 3H10M4.5 3V2H7.5V3M5 5.5V8.5M7 5.5V8.5M3 3L3.5 10H8.5L9 3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Add source ───────────────────────────────────── */}
          <div className="flex gap-2">
            <input
              type="text"
              className="search-input pl-3 flex-1 text-[0.82rem]"
              placeholder="Board name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <input
              type="text"
              className="search-input pl-3 flex-1 text-[0.82rem]"
              placeholder="URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
            />
            <button
              className="filter-btn text-[0.82rem] shrink-0 px-4"
              onClick={addSource}
              disabled={!newName.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
