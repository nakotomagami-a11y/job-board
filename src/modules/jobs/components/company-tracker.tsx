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
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn flex items-center gap-1.5 mx-auto text-[0.82rem]"
      >
        🏢 {expanded ? "Hide" : "Track Companies"}
        {companies.length > 0 && (
          <span className="bg-primary text-[#0a0a0f] rounded-full px-[7px] py-[1px] text-[0.72rem] font-bold">
            {companies.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 max-w-[560px] mx-auto">
          {error && (
            <div className="px-3 py-2 mb-3 rounded-lg bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-danger text-[0.78rem] flex items-center justify-between gap-2">
              <span>Couldn&apos;t load companies: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn text-[0.72rem] px-2 py-[2px]" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-text-dim mb-2">
            Add companies to track — Claude checks their career pages + external boards
          </div>

          {companies.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {companies.map((company, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface text-[0.82rem]">
                  <span className="text-text-base flex-1 font-medium">
                    {company.name}
                  </span>
                  {company.careersUrl && (
                    <a href={company.careersUrl} target="_blank" rel="noopener noreferrer"
                      className="text-text-dim text-[0.72rem] no-underline"
                      title={company.careersUrl}>
                      careers ↗
                    </a>
                  )}
                  <button
                    onClick={() => removeCompany(i)}
                    className="bg-transparent border-none cursor-pointer text-text-dim text-[0.8rem] p-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add company */}
          <div className="flex gap-1.5 mb-3">
            <input
              type="text" className="search-input pl-2.5 flex-1 text-[0.82rem]"
              placeholder="Company name (e.g. Rockstar Games)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <input
              type="text" className="search-input pl-2.5 flex-1 text-[0.82rem]"
              placeholder="Careers URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <button className="filter-btn text-[0.78rem] shrink-0" onClick={addCompany} disabled={!newName.trim()}>
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
                ? `⏳ Checking ${companies.length} companies...`
                : `🔍 Check ${companies.length} ${companies.length === 1 ? "company" : "companies"}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
