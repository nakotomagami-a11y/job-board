"use client";

import { useState, useEffect } from "react";
import Select from "react-select";
import worldCountries from "world-countries";

interface SearchConfigProps {
  onSearch: (config: SearchParams) => void;
  onClose: () => void;
  isSearching: boolean;
}

export interface SearchParams {
  regions: string[];
  roleTypes: string[];
  seniority: string[];
  categories: string[];
  remoteOnly: boolean;
  localOnly: boolean;
  salaryMin: string;
  customQuery: string;
  countries: string[];
  maxBoards: number;
  searchScope: string;
  parallelMode: boolean;
}

const STORAGE_KEY = "jobhunt-search-params";

const DEFAULT_PARAMS: SearchParams = {
  regions: ["Worldwide"],
  roleTypes: [
    "Frontend", "React Native Developer", "React Developer",
    "JavaScript Developer", "TypeScript Developer", "Frontend Engineer",
    "React Native Engineer", "React Engineer", "JavaScript Engineer",
    "TypeScript Engineer",
  ],
  seniority: [],
  categories: [],
  remoteOnly: true,
  localOnly: false,
  salaryMin: "",
  customQuery: "",
  countries: [],
  maxBoards: 3,
  searchScope: "focused",
  parallelMode: false,
};

function loadSavedParams(): SearchParams | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveParams(DEFAULT_PARAMS);
      return null;
    }
    return JSON.parse(raw) as SearchParams;
  } catch { return null; }
}

function saveParams(params: SearchParams) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); }
  catch { /* ignore */ }
}

const REGION_SUGGESTIONS = ["Europe", "North America", "UK", "Asia", "Worldwide"];
const ROLE_SUGGESTIONS = ["Frontend", "Mobile", "Full-Stack", "Design Engineer", "UI Engineer", "Creative Developer", "Software Engineer"];
const SENIORITY_OPTIONS = ["Junior", "Mid", "Senior", "Staff", "Lead", "Principal"];
const CATEGORY_SUGGESTIONS = ["Gaming", "Crypto / Web3", "AI / ML", "Fintech", "SaaS / Dev Tools", "E-Commerce", "Startups", "Big Tech"];

const countryOptions = worldCountries
  .map((c) => ({ value: c.cca2, label: `${c.flag} ${c.name.common}`, name: c.name.common }))
  .sort((a, b) => a.name.localeCompare(b.name));

const LABEL: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 6,
};

const selectStyles = {
  control: (base: Record<string, unknown>) => ({ ...base, background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, minHeight: 40, boxShadow: "none", "&:hover": { borderColor: "rgba(255,255,255,0.18)" } }),
  menu: (base: Record<string, unknown>) => ({ ...base, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, zIndex: 50 }),
  menuList: (base: Record<string, unknown>) => ({ ...base, maxHeight: 160, padding: 4 }),
  option: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({ ...base, background: state.isFocused ? "rgba(255,255,255,0.08)" : "transparent", color: "#e4e4e7", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem", padding: "6px 10px" }),
  multiValue: (base: Record<string, unknown>) => ({ ...base, background: "rgba(56,189,248,0.15)", borderRadius: 6 }),
  multiValueLabel: (base: Record<string, unknown>) => ({ ...base, color: "#38bdf8", fontSize: "0.78rem" }),
  multiValueRemove: (base: Record<string, unknown>) => ({ ...base, color: "#38bdf8", "&:hover": { background: "rgba(56,189,248,0.3)", color: "#fff" } }),
  input: (base: Record<string, unknown>) => ({ ...base, color: "#e4e4e7" }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: "#71717a", fontSize: "0.82rem" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base: Record<string, unknown>) => ({ ...base, color: "#71717a", padding: 6 }),
  clearIndicator: (base: Record<string, unknown>) => ({ ...base, color: "#71717a", "&:hover": { color: "#f87171" } }),
};

// Editable chip list with suggestions + custom input
function EditableChips({ label, items, suggestions, onChange, placeholder }: {
  label: string; items: string[]; suggestions: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  const toggle = (opt: string) => {
    if (items.includes(opt)) onChange(items.filter((s) => s !== opt));
    else onChange([...items, opt]);
  };
  const add = () => {
    const t = input.trim();
    if (t && !items.includes(t)) { onChange([...items, t]); setInput(""); }
  };
  const available = suggestions.filter((s) => !items.includes(s));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={LABEL}>{label}</div>
      {/* Selected */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {items.map((item) => (
            <button key={item} onClick={() => toggle(item)}
              className="filter-btn active" style={{ fontSize: "0.76rem", padding: "4px 10px" }}>
              {item} ×
            </button>
          ))}
        </div>
      )}
      {/* Suggestions */}
      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {available.map((opt) => (
            <button key={opt} onClick={() => toggle(opt)}
              className="filter-btn" style={{ fontSize: "0.76rem", padding: "4px 10px" }}>
              + {opt}
            </button>
          ))}
        </div>
      )}
      {/* Custom input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input type="text" className="search-input"
          style={{ paddingLeft: 10, flex: 1, fontSize: "0.8rem" }}
          placeholder={placeholder} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="filter-btn" onClick={add} disabled={!input.trim()}
          style={{ fontSize: "0.76rem", flexShrink: 0 }}>Add</button>
      </div>
    </div>
  );
}

function ChipSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={LABEL}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`filter-btn ${selected.includes(opt) ? "active" : ""}`}
            style={{ fontSize: "0.78rem", padding: "5px 12px" }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchConfig({ onSearch, onClose, isSearching }: SearchConfigProps) {
  const [config, setConfig] = useState<SearchParams>(DEFAULT_PARAMS);
  const [loaded, setLoaded] = useState(false);

  // Load saved params from localStorage on mount (falls back to DEFAULT_PARAMS)
  useEffect(() => {
    const saved = loadSavedParams();
    if (saved) setConfig(saved);
    setLoaded(true);
  }, []);

  // Persist to localStorage on every change (skip initial mount)
  useEffect(() => {
    if (loaded) saveParams(config);
  }, [config, loaded]);

  const update = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const hasCountries = config.countries.length > 0;
  const hasAnyFilter = config.regions.length > 0 || config.roleTypes.length > 0 ||
    config.seniority.length > 0 || config.categories.length > 0 ||
    config.remoteOnly || config.salaryMin || config.customQuery || hasCountries;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20,
        padding: 28, maxWidth: 580, width: "92%", maxHeight: "85vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>🔍 What are you looking for?</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 16 }}>
          Leave empty for a broad search using your profile preferences.
        </p>

        {/* Toggles row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className={`filter-btn ${config.remoteOnly ? "active" : ""}`}
            onClick={() => update("remoteOnly", !config.remoteOnly)}
            style={{ fontSize: "0.78rem", padding: "5px 12px" }}>
            🌍 Remote only
          </button>
          <button className={`filter-btn ${config.localOnly ? "active" : ""}`}
            onClick={() => update("localOnly", !config.localOnly)}
            style={{ fontSize: "0.78rem", padding: "5px 12px" }}>
            📍 Local boards only {config.localOnly && !hasCountries && "(select countries below)"}
          </button>
        </div>

        {/* Regions */}
        <ChipSelect label="Regions" options={REGION_SUGGESTIONS} selected={config.regions}
          onChange={(v) => update("regions", v)} />

        {/* Role types — editable */}
        <EditableChips label="Role Types" items={config.roleTypes}
          suggestions={ROLE_SUGGESTIONS} onChange={(v) => update("roleTypes", v)}
          placeholder="Add custom role (e.g. WebGL Developer)" />

        {/* Seniority */}
        <ChipSelect label="Seniority" options={SENIORITY_OPTIONS} selected={config.seniority}
          onChange={(v) => update("seniority", v)} />

        {/* Categories — editable */}
        <EditableChips label="Industry / Category" items={config.categories}
          suggestions={CATEGORY_SUGGESTIONS} onChange={(v) => update("categories", v)}
          placeholder="Add custom category (e.g. HealthTech, EdTech)" />

        {/* Countries */}
        <div style={{ marginBottom: 16 }}>
          <div style={LABEL}>Specific Countries (searches local job boards)</div>
          <Select isMulti options={countryOptions}
            value={countryOptions.filter((o) => config.countries.includes(o.name))}
            onChange={(val) => update("countries", (val || []).map((v) => v.name))}
            placeholder="Search for a country..."
            filterOption={(option, input) => !input || option.data.name.toLowerCase().includes(input.toLowerCase())}
            styles={selectStyles} />
          {hasCountries && (
            <div style={{ marginTop: 6, fontSize: "0.72rem", color: config.localOnly ? "var(--c-accent)" : "var(--text-dim)" }}>
              {config.localOnly
                ? `🔒 Will ONLY search local boards in ${config.countries.join(", ")}`
                : `Will search local boards in ${config.countries.join(", ")} + global sources`
              }
            </div>
          )}
        </div>

        {/* Salary + Custom query side by side */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: "0 0 180px" }}>
            <div style={LABEL}>Min Salary (USD/yr)</div>
            <input type="number" className="search-input" style={{ paddingLeft: 10, fontSize: "0.82rem" }}
              placeholder="80000" value={config.salaryMin}
              onChange={(e) => update("salaryMin", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>Custom Focus</div>
            <input type="text" className="search-input" style={{ paddingLeft: 10, fontSize: "0.82rem" }}
              placeholder='"YC startups", "blockchain gaming"'
              value={config.customQuery}
              onChange={(e) => update("customQuery", e.target.value)} />
          </div>
        </div>

        {/* Batch size */}
        <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={LABEL}>
              Boards per batch — {config.maxBoards === 55 ? "ALL (55)" : config.maxBoards}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
              {config.maxBoards <= 5 ? "🟢 Quick" : config.maxBoards <= 15 ? "🟡 Medium" : config.maxBoards <= 30 ? "🟠 Large" : "🔴 Full sweep"}
            </div>
          </div>
          <input type="range" min={1} max={55} value={config.maxBoards}
            onChange={(e) => {
              const v = Number(e.target.value);
              update("maxBoards", v);
              update("searchScope", v <= 15 ? "focused" : "broad");
            }}
            style={{ width: "100%", accentColor: "var(--c-accent)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-dim)", marginTop: 4 }}>
            <span>Quick (1-5)</span>
            <span>Medium (6-15)</span>
            <span>Large (16-30)</span>
            <span>All 55</span>
          </div>
          <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text-dim)" }}>
            💡 Searches are batched — Claude checks {config.maxBoards} boards, then you can run again to continue with the next batch. Progress is tracked automatically.
          </div>
        </div>

        {/* Parallel mode toggle */}
        {config.maxBoards > 1 && (
          <div style={{
            marginBottom: 20, padding: "12px 16px",
            background: config.parallelMode ? "rgba(251,146,60,0.06)" : "rgba(255,255,255,0.03)",
            borderRadius: 12,
            border: `1px solid ${config.parallelMode ? "rgba(251,146,60,0.25)" : "rgba(255,255,255,0.06)"}`,
            transition: "all 0.2s ease",
          }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={config.parallelMode}
                onChange={(e) => update("parallelMode", e.target.checked)}
                style={{
                  marginTop: 2, accentColor: "var(--c-accent)",
                  width: 16, height: 16, flexShrink: 0, cursor: "pointer",
                }}
              />
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>
                  ⚡ Parallel search (multi-agent)
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 3, lineHeight: 1.4 }}>
                  Searches all {config.maxBoards} boards simultaneously using separate agents.
                  Much faster, but uses ~{config.maxBoards}× more tokens.
                </div>
                {config.parallelMode && (
                  <div style={{
                    marginTop: 8, padding: "6px 10px", borderRadius: 8,
                    background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)",
                    fontSize: "0.68rem", color: "#fb923c", lineHeight: 1.4,
                  }}>
                    ⚠️ Each board runs in its own agent context. With {config.maxBoards} boards this will
                    use significantly more API quota. Recommended for Pro plan with sufficient remaining balance.
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {/* Search button */}
        <button className="apply-btn" onClick={() => onSearch(config)} disabled={isSearching}
          style={{ width: "100%", justifyContent: "center", padding: "12px 20px", fontSize: "0.9rem", opacity: isSearching ? 0.6 : 1 }}>
          {isSearching ? "⏳ Generating prompt..." : "🔍 Generate Search Prompt"}
        </button>

        <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.7rem", color: "var(--text-dim)" }}>
          Generates a prompt for Claude Code — no API cost until you run it
        </div>
      </div>
    </div>
  );
}
