"use client";

import { useState } from "react";
import {
  useTrackedCompanies,
  type TrackedCompany,
} from "../hooks/use-tracked-companies";

interface CompanyTrackerProps {
  onSearch: (companies: TrackedCompany[]) => void;
  isSearching: boolean;
}

export function CompanyTracker({ onSearch, isSearching }: CompanyTrackerProps) {
  const { companies, error, refetch, save } = useTrackedCompanies();
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const addCompany = () => {
    const name = newName.trim();
    if (!name) return;
    const url = newUrl.trim();
    if (!companies.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      save([...companies, { name, careersUrl: url }]);
    }
    setNewName("");
    setNewUrl("");
  };

  const removeCompany = (idx: number) => {
    save(companies.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn flex items-center gap-1.5 text-[0.82rem]"
      >
        🏢 {expanded ? "Hide" : "Track Companies"}
        {companies.length > 0 && (
          <span className="bg-primary text-[#0a0a0f] rounded-full px-[7px] py-[1px] text-[0.72rem] font-bold">
            {companies.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-4 max-w-[620px] mx-auto flex flex-col gap-5">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-danger text-[0.78rem] flex items-center justify-between gap-2">
              <span>Couldn&apos;t load companies: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn text-[0.72rem] px-2 py-[2px]" onClick={() => refetch()}>Retry</button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Tracked companies
              </div>
              {companies.length > 0 && (
                <span className="text-[0.68rem] text-text-dim">{companies.length} watching</span>
              )}
            </div>

            {companies.length > 0 ? (
              <div className="flex flex-col gap-1">
                {companies.map((company, i) => {
                  const initials = company.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface"
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-lg bg-[rgba(167,139,250,0.15)] border border-[rgba(167,139,250,0.2)] flex items-center justify-center shrink-0">
                        <span className="text-[0.62rem] font-bold text-purple">{initials}</span>
                      </div>

                      {/* Name */}
                      <span className="flex-1 text-[0.82rem] font-medium text-text-base truncate">
                        {company.name}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {company.careersUrl && (
                          <a
                            href={company.careersUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-base hover:bg-surface-hover transition-all no-underline"
                            title="Open careers page"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M7 2H10V5M10 2L5 7M3 3H2C1.45 3 1 3.45 1 4V10C1 10.55 1.45 11 2 11H8C8.55 11 9 10.55 9 10V9" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </a>
                        )}
                        <button
                          onClick={() => removeCompany(i)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-danger hover:bg-[rgba(248,113,113,0.08)] transition-all cursor-pointer border-none bg-transparent"
                          title="Remove"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M2 3H10M4.5 3V2H7.5V3M5 5.5V8.5M7 5.5V8.5M3 3L3.5 10H8.5L9 3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-text-dim text-[0.8rem] border border-dashed border-border rounded-xl">
                No companies tracked yet — add ones you want Claude to monitor
              </div>
            )}
          </div>

          {/* Add company */}
          <div className="flex gap-2">
            <input
              type="text"
              className="search-input pl-3 flex-1 text-[0.82rem]"
              placeholder="Company name (e.g. Revolut)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <input
              type="text"
              className="search-input pl-3 flex-1 text-[0.82rem]"
              placeholder="Careers URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <button
              className="filter-btn text-[0.82rem] shrink-0 px-4"
              onClick={addCompany}
              disabled={!newName.trim()}
            >
              Add
            </button>
          </div>

          {companies.length > 0 && (
            <button
              className={`apply-btn w-full justify-center px-5 py-2.5 text-[0.85rem] ${isSearching ? "opacity-60" : ""}`}
              onClick={() => onSearch(companies)}
              disabled={isSearching}
            >
              {isSearching
                ? `⏳ Checking ${companies.length} ${companies.length === 1 ? "company" : "companies"}...`
                : `🔍 Check ${companies.length} ${companies.length === 1 ? "company" : "companies"}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
