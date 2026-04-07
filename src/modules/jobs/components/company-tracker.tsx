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
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="filter-btn"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          margin: "0 auto", fontSize: "0.82rem",
        }}
      >
        🏢 {expanded ? "Hide" : "Track Companies"}
        {companies.length > 0 && (
          <span style={{
            background: "var(--c-primary)", color: "#0a0a0f",
            borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700,
          }}>
            {companies.length}
          </span>
        )}
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
              <span>Couldn&apos;t load companies: {error instanceof Error ? error.message : "Unknown error"}</span>
              <button className="filter-btn" style={{ fontSize: "0.72rem", padding: "2px 8px" }} onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          <div style={{
            fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 8,
          }}>
            Add companies to track — Claude checks their career pages + external boards
          </div>

          {/* Company list */}
          {companies.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              {companies.map((company, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8,
                  background: "var(--surface)", fontSize: "0.82rem",
                }}>
                  <span style={{ color: "var(--text)", flex: 1, fontWeight: 500 }}>
                    {company.name}
                  </span>
                  {company.careersUrl && (
                    <a href={company.careersUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--text-dim)", fontSize: "0.72rem", textDecoration: "none" }}
                      title={company.careersUrl}>
                      careers ↗
                    </a>
                  )}
                  <button
                    onClick={() => removeCompany(i)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", fontSize: "0.8rem", padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add company */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              type="text" className="search-input"
              style={{ paddingLeft: 10, flex: 1, fontSize: "0.82rem" }}
              placeholder="Company name (e.g. Rockstar Games)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <input
              type="text" className="search-input"
              style={{ paddingLeft: 10, flex: 1, fontSize: "0.82rem" }}
              placeholder="Careers URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
            />
            <button className="filter-btn" onClick={addCompany} disabled={!newName.trim()}
              style={{ fontSize: "0.78rem", flexShrink: 0 }}>
              Add
            </button>
          </div>

          {/* Search button */}
          {companies.length > 0 && (
            <button
              className="apply-btn"
              onClick={() => onSearch(companies)}
              disabled={isSearching}
              style={{
                width: "100%", justifyContent: "center",
                padding: "10px 20px", fontSize: "0.85rem",
                opacity: isSearching ? 0.6 : 1,
              }}
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
