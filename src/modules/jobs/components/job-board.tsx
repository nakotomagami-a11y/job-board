"use client";

import { useEffect, useRef, useState } from "react";
import type { Job } from "@/types/job";
import { useProfile } from "@/providers/profile-provider";
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
import { BlocklistPanel } from "./blocklist-panel";
import { ROUTES, API } from "@lib/constants";
import { salarySortValue } from "@lib/job-utils";

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
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

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

  const handleLinkedInFeed = async () => {
    setActiveAction("search");
    setActionStatus("running");
    setActionMsg("Generating LinkedIn Feed scan prompt...");
    try {
      const res = await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "linkedin-feed" }),
        signal: newSignal(),
      });
      const data = await res.json();
      if (res.ok && data.mode === "prompt") {
        setActionStatus("done");
        setActionMsg('✅ LinkedIn Feed prompt ready — tell Claude Code: "Run the LinkedIn feed scan"');
        setGeneratedPrompt(data.prompt);
      } else {
        setActionStatus("error");
        setActionMsg(data.error || "Failed to generate prompt");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setActionStatus("error");
      setActionMsg(e instanceof Error ? e.message : "Failed");
    }
    scheduleStatusClear(30000);
  };

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
    setActionMsg("Resetting batch for a fresh sweep...");

    try {
      await fetch(API.runCommand, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "reset-batch" }),
        signal: newSignal(),
      });

      setActionMsg("Generating search prompt...");
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

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
    }
    if (sortBy === "salary") {
      return salarySortValue(b.salary) - salarySortValue(a.salary);
    }
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
          <a href={ROUTES.settings} className="text-primary no-underline">
            Settings
          </a>
        </span>
      </header>

      <StatsBar jobs={jobs} filteredCount={filtered.length} />

      {showBlocklist && <BlocklistPanel onClose={() => setShowBlocklist(false)} />}

      {/* Actions row */}
      <div className="flex gap-2 justify-center mb-2.5 flex-wrap">
        <button className="apply-btn px-4.5 py-2 text-[0.82rem]" onClick={() => setShowSearchConfig(true)} disabled={isRunning}
          style={{ opacity: isRunning && activeAction !== "search" ? 0.4 : 1 }}>
          {activeAction === "search" && isRunning ? "⏳ Searching..." : "🔍 Find New Jobs"}
        </button>
        <button className="filter-btn px-3.5 py-2 text-[0.82rem] border-[rgba(10,102,194,0.4)] text-[#6ba3d6]" onClick={handleLinkedInFeed} disabled={isRunning}
          style={{ opacity: isRunning && activeAction !== "search" ? 0.4 : 1 }}>
          {activeAction === "search" && isRunning ? "⏳ Scanning..." : "🔗 LinkedIn Feed"}
        </button>
        <button className="filter-btn px-3.5 py-2 text-[0.82rem] border-[rgba(248,113,113,0.35)] text-danger"
          onClick={() => setShowBlocklist((s) => !s)}
          title="Manage permanently blocked companies">
          🚫 {showBlocklist ? "Hide" : "Blocklist"}
        </button>
        <button className="filter-btn px-3.5 py-2 text-[0.82rem]" onClick={() => runCommand("audit")} disabled={isRunning}
          style={{ opacity: isRunning && activeAction !== "audit" ? 0.4 : 1 }}>
          {activeAction === "audit" && isRunning ? "⏳ Auditing..." : "🧹 Audit"}
        </button>
        <button className="filter-btn px-3.5 py-2 text-[0.82rem] border-[rgba(248,113,113,0.3)] text-danger"
          onClick={() => { if (confirm("Remove all saved jobs?")) runCommand("clear-all"); }}
          disabled={isRunning} style={{ opacity: isRunning ? 0.4 : 1 }}>
          🗑 Clear
        </button>
        <button className="filter-btn px-3.5 py-2 text-[0.82rem]" onClick={async () => {
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
          disabled={isRunning} style={{ opacity: isRunning ? 0.4 : 1 }}>
          🔄 Reset Batch
        </button>
      </div>

      {/* Expandable search options */}
      <div className="flex gap-2 justify-center flex-wrap mb-6">
        <CountrySearch onSearch={handleCountrySearch} isSearching={isRunning} />
        <CompanyTracker onSearch={handleCompanySearch} isSearching={isRunning} />
        <SourcesPanel jobs={jobs} />
      </div>

      {/* Action status */}
      {actionMsg && (
        <div className={`text-center mb-3 px-3.5 py-2 rounded-[10px] text-[0.8rem] border ${
          actionStatus === "done"
            ? "bg-[rgba(52,211,153,0.08)] text-secondary border-[rgba(52,211,153,0.2)]"
            : actionStatus === "error"
              ? "bg-[rgba(248,113,113,0.08)] text-danger border-[rgba(248,113,113,0.2)]"
              : "bg-[rgba(56,189,248,0.08)] text-primary border-[rgba(56,189,248,0.2)]"
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Generated prompt display */}
      {generatedPrompt && (
        <div className="mb-4 p-4 rounded-xl bg-[rgba(56,189,248,0.05)] border border-[rgba(56,189,248,0.15)]">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[0.85rem] font-semibold text-primary">
              📋 Search prompt generated
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  setPromptCopied(true);
                  setTimeout(() => setPromptCopied(false), 2000);
                }}
                className="filter-btn active text-[0.72rem] px-2.5 py-1">
                {promptCopied ? "✓ Copied!" : "📋 Copy Prompt"}
              </button>
              <button
                onClick={() => setGeneratedPrompt(null)}
                className="filter-btn text-[0.72rem] px-2.5 py-1">
                ✕ Close
              </button>
            </div>
          </div>
          <div className="text-[0.75rem] text-text-dim mb-2">
            Tell Claude Code: <strong className="text-secondary">&quot;Run the job search&quot;</strong> — or copy and paste this prompt.
          </div>
          <pre className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3 text-[0.68rem] text-text-muted overflow-auto max-h-[200px] whitespace-pre-wrap break-words border border-[rgba(255,255,255,0.05)]">
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
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[0.72rem] text-text-dim uppercase tracking-[0.06em]">
          Sort by
        </span>
        {(["score", "date", "salary"] as const).map((opt) => (
          <button
            key={opt}
            className={`filter-btn ${sortBy === opt ? "active" : ""} text-[0.78rem] px-3 py-1`}
            onClick={() => setSortBy(opt)}
          >
            {opt === "score" ? "Best Match" : opt === "date" ? "Newest" : "Salary ↓"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 pb-20">
        {sorted.length === 0 ? (
          <div className="text-center py-20 px-6 text-text-dim">
            <p className="text-[1.1rem] mb-1">No positions match your filters</p>
            <p className="text-[0.85rem]">Try adjusting your search or filter criteria</p>
            <div className="mt-4 flex gap-3 justify-center">
              <button className="filter-btn" onClick={resetFilters}>Reset filters</button>
              <button className="apply-btn" onClick={() => setShowSearchConfig(true)} disabled={isRunning}>
                Find New Jobs
              </button>
            </div>
          </div>
        ) : (() => {
          const groupedBySource = sorted.reduce<Array<{ source: string; jobs: typeof sorted }>>((acc, job) => {
            const src = job.source || "Unknown";
            const existing = acc.find((g) => g.source === src);
            if (existing) { existing.jobs.push(job); }
            else { acc.push({ source: src, jobs: [job] }); }
            return acc;
          }, []);

          return groupedBySource.map(({ source, jobs: groupJobs }) => (
            <div key={source}>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-dim px-1 pt-4 pb-2 border-b border-border mb-2">
                {source} — {groupJobs.length} {groupJobs.length === 1 ? "position" : "positions"}
              </div>
              {groupJobs.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={i}
                  onMarkApplied={onUpdateJob ? (id) => onUpdateJob(id, { applied: true, appliedDate: new Date().toISOString().slice(0, 10) }) : undefined}
                  onReject={onUpdateJob ? (id) => onUpdateJob(id, { rejected: true }) : undefined}
                  onBlocked={onRefresh ? () => onRefresh() : undefined}
                />
              ))}
            </div>
          ));
        })()}
      </div>

      <footer className="text-center py-8 border-t border-border text-text-dim text-[0.8rem]">
        JobHunt — Powered by Claude
      </footer>

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
