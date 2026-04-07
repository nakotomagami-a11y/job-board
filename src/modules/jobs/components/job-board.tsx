"use client";

import { useEffect, useRef, useState } from "react";
import type { Job } from "@shared/types/job";
import { useProfile } from "@shared/providers/profile-provider";
import { useFilters } from "../hooks/use-filters";
import { useJobScoring } from "../hooks/use-job-scoring";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { JobCard } from "./job-card";
import { StatsBar } from "./stats-bar";
import { SourcesPanel } from "./sources-panel";
import { CountrySearch } from "./country-search";
import { CompanyTracker } from "./company-tracker";
import { SearchConfig, type SearchParams } from "./search-config";
import { ROUTES, API } from "@lib/constants";
import { salarySortValue } from "@lib/salary";

interface JobBoardProps {
  jobs: Job[];
  onRefresh?: () => Promise<void>;
  onUpdateJob?: (id: string, updates: Partial<Job>) => Promise<void>;
}

type ActionStatus = "idle" | "running" | "done" | "error";

export function JobBoard({ jobs, onRefresh, onUpdateJob }: JobBoardProps) {
  const { profile } = useProfile();
  const scoredJobs = useJobScoring(jobs, profile);
  const { filters, filtered, setFilter, resetFilters } = useFilters(scoredJobs);

  const [actionStatus, setActionStatus] = useState<ActionStatus>("idle");
  const [actionMsg, setActionMsg] = useState("");
  const [activeAction, setActiveAction] = useState<"audit" | "search" | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "date" | "salary">("score");
  const [showSearchConfig, setShowSearchConfig] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // Abort in-flight fetches on unmount so we don't write to state after teardown.
  const abortRef = useRef<AbortController | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newSignal = () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl.signal;
  };

  const scheduleStatusClear = (ms: number) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setActionStatus("idle");
      setActionMsg("");
      setActiveAction(null);
    }, ms);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const strongMatches = filtered.filter(
    (j) => j.matchScore !== undefined && j.matchScore >= 70
  ).length;

  const runCommand = async (command: "audit" | "search" | "clear-all") => {
    setActiveAction(command === "clear-all" ? "audit" : command);
    setActionStatus("running");
    setActionMsg(
      command === "audit"
        ? "Auditing jobs — removing expired & old listings..."
        : command === "clear-all"
          ? "Clearing all jobs..."
          : "Claude is searching for new positions..."
    );

    try {
      const res = await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        signal: newSignal(),
      });

      const data = await res.json();

      if (res.ok) {
        setActionStatus("done");
        setActionMsg(data.message);
        // Refresh the job list
        if (onRefresh) await onRefresh();
      } else {
        setActionStatus("error");
        setActionMsg(data.error || "Command failed");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setActionStatus("error");
      setActionMsg(e instanceof Error ? e.message : "Command failed");
    }

    scheduleStatusClear(30000);
  };

  const handleCountrySearch = async (countries: { value: string; label: string; name: string }[]) => {
    setActiveAction("search");
    setActionStatus("running");
    const names = countries.map((c) => c.label).join(", ");
    setActionMsg(`Generating local search prompt for ${names}...`);

    try {
      const countryNames = countries.map((c) => c.name);
      const res = await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "local-search", countries: countryNames }),
        signal: newSignal(),
      });
      const data = await res.json();
      if (res.ok && data.mode === "prompt") {
        setActionStatus("done");
        setActionMsg(`✅ Local search prompt ready — tell Claude Code: "Search local boards in ${names}"`);
        setGeneratedPrompt(data.prompt);
      } else if (res.ok) {
        setActionStatus("done");
        setActionMsg(data.message);
        if (onRefresh) await onRefresh();
      } else {
        setActionStatus("error");
        setActionMsg(data.error || "Local search failed");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setActionStatus("error");
      setActionMsg(e instanceof Error ? e.message : "Local search failed");
    }

    scheduleStatusClear(30000);
  };

  const handleCompanySearch = async (companies: { name: string; careersUrl: string }[]) => {
    setActiveAction("search");
    setActionStatus("running");
    setActionMsg(`Generating company search prompt...`);

    try {
      const res = await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "company-search", companies }),
        signal: newSignal(),
      });
      const data = await res.json();
      if (res.ok && data.mode === "prompt") {
        setActionStatus("done");
        setActionMsg(`✅ Company search prompt ready — tell Claude Code: "Search tracked companies"`);
        setGeneratedPrompt(data.prompt);
      } else if (res.ok) {
        setActionStatus("done");
        setActionMsg(data.message);
        if (onRefresh) await onRefresh();
      } else {
        setActionStatus("error");
        setActionMsg(data.error || "Company search failed");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setActionStatus("error");
      setActionMsg(e instanceof Error ? e.message : "Company search failed");
    }

    scheduleStatusClear(30000);
  };

  const handleConfiguredSearch = async (config: SearchParams) => {
    setShowSearchConfig(false);
    setActiveAction("search");
    setActionStatus("running");
    setActionMsg("Generating search prompt...");

    try {
      const res = await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "search", searchConfig: config }),
        signal: newSignal(),
      });
      const data = await res.json();
      if (res.ok && data.mode === "prompt") {
        setActionStatus("done");
        const batch = data.batchState;
        const batchMsg = batch
          ? ` (batch: ${batch.searchedBoards.length}/${batch.totalBoards} boards, ${batch.remainingBoards.length} remaining)`
          : "";
        setActionMsg(`✅ Search prompt ready${batchMsg} — tell Claude Code: "Run the job search"`);
        setGeneratedPrompt(data.prompt);
      } else if (res.ok) {
        setActionStatus("done");
        setActionMsg(data.message);
        if (onRefresh) await onRefresh();
      } else {
        setActionStatus("error");
        setActionMsg(data.error || "Search failed");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setActionStatus("error");
      setActionMsg(e instanceof Error ? e.message : "Search failed");
    }

    scheduleStatusClear(30000);
  };

  const isRunning = actionStatus === "running";

  // Sort filtered results
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
    }
    if (sortBy === "salary") {
      return salarySortValue(b.salary) - salarySortValue(a.salary);
    }
    // Default: score
    return (b.matchScore ?? 0) - (a.matchScore ?? 0);
  });

  return (
    <div className="container">
      <header className="header">
        <h1>JobHunt</h1>
        <p>
          {profile?.name
            ? `Hey ${profile.name.split(" ")[0]} — ${filtered.length} positions matched`
            : "Frontend & Mobile roles at gaming studios and tech companies"}
        </p>
        <span className="meta">
          {strongMatches > 0 ? `${strongMatches} strong matches · ` : ""}
          {jobs.length} total positions ·{" "}
          <a href={ROUTES.settings} style={{ color: "var(--c-primary)", textDecoration: "none" }}>
            Settings
          </a>
        </span>
      </header>

      <StatsBar jobs={jobs} filteredCount={filtered.length} />

      {/* Actions row */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <button className="apply-btn" onClick={() => setShowSearchConfig(true)} disabled={isRunning}
          style={{ padding: "8px 18px", fontSize: "0.82rem", opacity: isRunning && activeAction !== "search" ? 0.4 : 1 }}>
          {activeAction === "search" && isRunning ? "⏳ Searching..." : "🔍 Find New Jobs"}
        </button>
        <button className="filter-btn" onClick={() => runCommand("audit")} disabled={isRunning}
          style={{ padding: "8px 14px", fontSize: "0.82rem", opacity: isRunning && activeAction !== "audit" ? 0.4 : 1 }}>
          {activeAction === "audit" && isRunning ? "⏳ Auditing..." : "🧹 Audit"}
        </button>
        <button className="filter-btn" onClick={() => { if (confirm("Remove all saved jobs?")) runCommand("clear-all"); }}
          disabled={isRunning} style={{ padding: "8px 14px", fontSize: "0.82rem", opacity: isRunning ? 0.4 : 1, borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>
          🗑 Clear
        </button>
        <button className="filter-btn" onClick={async () => {
          try {
            await fetch(API.runCommand, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ command: "reset-batch" }),
              signal: newSignal(),
            });
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            throw e;
          }
          setActionMsg("Batch state reset — next search starts from board #1");
          setActionStatus("done");
          scheduleStatusClear(8000);
        }}
          disabled={isRunning} style={{ padding: "8px 14px", fontSize: "0.82rem", opacity: isRunning ? 0.4 : 1 }}>
          🔄 Reset Batch
        </button>
      </div>

      {/* Expandable search options */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <CountrySearch onSearch={handleCountrySearch} isSearching={isRunning} />
        <CompanyTracker onSearch={handleCompanySearch} isSearching={isRunning} />
        <SourcesPanel jobs={jobs} />
      </div>

      {/* Action status */}
      {actionMsg && (
        <div style={{
          textAlign: "center", marginBottom: 12, padding: "8px 14px", borderRadius: 10, fontSize: "0.8rem",
          background: actionStatus === "done" ? "rgba(52,211,153,0.08)" : actionStatus === "error" ? "rgba(248,113,113,0.08)" : "rgba(56,189,248,0.08)",
          color: actionStatus === "done" ? "var(--c-secondary)" : actionStatus === "error" ? "#f87171" : "var(--c-primary)",
          border: `1px solid ${actionStatus === "done" ? "rgba(52,211,153,0.2)" : actionStatus === "error" ? "rgba(248,113,113,0.2)" : "rgba(56,189,248,0.2)"}`,
        }}>
          {actionMsg}
        </div>
      )}

      {/* Generated prompt display */}
      {generatedPrompt && (
        <div style={{
          marginBottom: 16, padding: "16px", borderRadius: 12,
          background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--c-primary)" }}>
              📋 Search prompt generated
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  setPromptCopied(true);
                  setTimeout(() => setPromptCopied(false), 2000);
                }}
                className="filter-btn active"
                style={{ fontSize: "0.72rem", padding: "4px 10px" }}>
                {promptCopied ? "✓ Copied!" : "📋 Copy Prompt"}
              </button>
              <button
                onClick={() => setGeneratedPrompt(null)}
                className="filter-btn"
                style={{ fontSize: "0.72rem", padding: "4px 10px" }}>
                ✕ Close
              </button>
            </div>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 8 }}>
            Tell Claude Code: <strong style={{ color: "var(--c-secondary)" }}>&quot;Run the job search&quot;</strong> — or copy and paste this prompt.
          </div>
          <pre style={{
            background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 12,
            fontSize: "0.68rem", color: "var(--text-muted)", overflow: "auto",
            maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-word",
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            {generatedPrompt}
          </pre>
        </div>
      )}

      <SearchBar
        value={filters.search}
        onChange={(v) => setFilter("search", v)}
        resultCount={filtered.length}
        totalCount={jobs.length}
      />

      <FilterBar
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        jobs={jobs}
      />

      {/* Sort controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Sort by
        </span>
        {(["score", "date", "salary"] as const).map((opt) => (
          <button
            key={opt}
            className={`filter-btn ${sortBy === opt ? "active" : ""}`}
            onClick={() => setSortBy(opt)}
            style={{ fontSize: "0.78rem", padding: "4px 12px" }}
          >
            {opt === "score" ? "Best Match" : opt === "date" ? "Newest" : "Salary ↓"}
          </button>
        ))}
      </div>

      <div className="job-list">
        {sorted.length === 0 ? (
          <div className="empty-state">
            <p>No positions match your filters</p>
            <small>Try adjusting your search or filter criteria</small>
            <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="filter-btn" onClick={resetFilters}>Reset filters</button>
              <button className="apply-btn" onClick={() => setShowSearchConfig(true)} disabled={isRunning}>
                Find New Jobs
              </button>
            </div>
          </div>
        ) : (
          sorted.map((job, i) => (
            <JobCard
              key={job.id}
              job={job}
              index={i}
              onMarkApplied={onUpdateJob ? (id) => onUpdateJob(id, { applied: true, appliedDate: new Date().toISOString().slice(0, 10) }) : undefined}
              onReject={onUpdateJob ? (id) => onUpdateJob(id, { rejected: true }) : undefined}
            />
          ))
        )}
      </div>

      <footer className="site-footer">
        JobHunt — Powered by Claude
      </footer>

      {/* Search config popup */}
      {showSearchConfig && (
        <SearchConfig
          onSearch={handleConfiguredSearch}
          onClose={() => setShowSearchConfig(false)}
          isSearching={isRunning}
        />
      )}
    </div>
  );
}
