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
  stack: string[];
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
  stack: ["JavaScript", "TypeScript"],
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
const STACK_SUGGESTIONS = [
  "JavaScript", "TypeScript", "Python", "Go", "Rust",
  "Java", "C#", "Swift", "Kotlin", "PHP", "Ruby",
  "React", "Vue", "Angular", "React Native", "Node.js",
  "Next.js", "Flutter", "Django", "FastAPI", "Spring",
];
const SENIORITY_OPTIONS = ["Junior", "Mid", "Senior", "Staff", "Lead", "Principal"];
const CATEGORY_SUGGESTIONS = ["Gaming", "Crypto / Web3", "AI / ML", "Fintech", "SaaS / Dev Tools", "E-Commerce", "Startups", "Big Tech"];

const countryOptions = worldCountries
  .map((c) => ({ value: c.cca2, label: `${c.flag} ${c.name.common}`, name: c.name.common }))
  .sort((a, b) => a.name.localeCompare(b.name));

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
    <div className="mb-4">
      <div className="section-label">{label}</div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-[5px] mb-2">
          {items.map((item) => (
            <button key={item} onClick={() => toggle(item)}
              className="filter-btn active text-[0.76rem] px-2.5 py-1">
              {item} ×
            </button>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-[5px] mb-2">
          {available.map((opt) => (
            <button key={opt} onClick={() => toggle(opt)}
              className="filter-btn text-[0.76rem] px-2.5 py-1">
              + {opt}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input type="text" className="search-input pl-2.5 flex-1 text-[0.8rem]"
          placeholder={placeholder} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="filter-btn text-[0.76rem] shrink-0" onClick={add} disabled={!input.trim()}>Add</button>
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
    <div className="mb-4">
      <div className="section-label">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`filter-btn ${selected.includes(opt) ? "active" : ""} text-[0.78rem] px-3 py-[5px]`}>
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

  useEffect(() => {
    const saved = loadSavedParams();
    if (saved) setConfig(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveParams(config);
  }, [config, loaded]);

  const update = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const hasCountries = config.countries.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg border border-border rounded-[20px] p-7 max-w-[580px] w-[92%] max-h-[85vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[1.2rem] font-bold">🔍 What are you looking for?</h2>
          <button onClick={onClose} className="bg-transparent border-none text-text-dim text-[1.2rem] cursor-pointer">✕</button>
        </div>

        <p className="text-text-muted text-[0.82rem] mb-4">
          Leave empty for a broad search using your profile preferences.
        </p>

        {/* Toggles row */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button className={`filter-btn ${config.remoteOnly ? "active" : ""} text-[0.78rem] px-3 py-[5px]`}
            onClick={() => update("remoteOnly", !config.remoteOnly)}>
            🌍 Remote only
          </button>
          <button className={`filter-btn ${config.localOnly ? "active" : ""} text-[0.78rem] px-3 py-[5px]`}
            onClick={() => update("localOnly", !config.localOnly)}>
            📍 Local boards only {config.localOnly && !hasCountries && "(select countries below)"}
          </button>
        </div>

        <ChipSelect label="Regions" options={REGION_SUGGESTIONS} selected={config.regions}
          onChange={(v) => update("regions", v)} />

        <EditableChips label="Tech Stack" items={config.stack}
          suggestions={STACK_SUGGESTIONS} onChange={(v) => update("stack", v)}
          placeholder="Add tech (e.g. Go, Vue, Svelte)" />

        <ChipSelect label="Seniority" options={SENIORITY_OPTIONS} selected={config.seniority}
          onChange={(v) => update("seniority", v)} />

        <EditableChips label="Industry / Category" items={config.categories}
          suggestions={CATEGORY_SUGGESTIONS} onChange={(v) => update("categories", v)}
          placeholder="Add custom category (e.g. HealthTech, EdTech)" />

        {/* Countries */}
        <div className="mb-4">
          <div className="section-label">Specific Countries (searches local job boards)</div>
          <Select isMulti options={countryOptions}
            value={countryOptions.filter((o) => config.countries.includes(o.name))}
            onChange={(val) => update("countries", (val || []).map((v) => v.name))}
            placeholder="Search for a country..."
            filterOption={(option, input) => !input || option.data.name.toLowerCase().includes(input.toLowerCase())}
            styles={selectStyles} />
          {hasCountries && (
            <div className={`mt-1.5 text-[0.72rem] ${config.localOnly ? "text-accent" : "text-text-dim"}`}>
              {config.localOnly
                ? `🔒 Will ONLY search local boards in ${config.countries.join(", ")}`
                : `Will search local boards in ${config.countries.join(", ")} + global sources`
              }
            </div>
          )}
        </div>

        {/* Salary + Custom query side by side */}
        <div className="flex gap-3 mb-5">
          <div className="w-[180px] shrink-0">
            <div className="section-label">Min Salary (USD/yr)</div>
            <input type="number" className="search-input pl-2.5 text-[0.82rem]"
              placeholder="80000" value={config.salaryMin}
              onChange={(e) => update("salaryMin", e.target.value)} />
          </div>
          <div className="flex-1">
            <div className="section-label">Custom Focus</div>
            <input type="text" className="search-input pl-2.5 text-[0.82rem]"
              placeholder='"YC startups", "blockchain gaming"'
              value={config.customQuery}
              onChange={(e) => update("customQuery", e.target.value)} />
          </div>
        </div>

        {/* Batch size */}
        <div className="mb-5 px-4 py-3.5 bg-[rgba(255,255,255,0.03)] rounded-xl border border-[rgba(255,255,255,0.06)]">
          <div className="flex justify-between items-center mb-2">
            <div className="section-label">
              Boards per batch — {config.maxBoards === 55 ? "ALL (55)" : config.maxBoards}
            </div>
            <div className="text-[0.7rem] text-text-dim">
              {config.maxBoards <= 5 ? "🟢 Quick" : config.maxBoards <= 15 ? "🟡 Medium" : config.maxBoards <= 30 ? "🟠 Large" : "🔴 Full sweep"}
            </div>
          </div>
          <input type="range" min={1} max={55} value={config.maxBoards}
            onChange={(e) => {
              const v = Number(e.target.value);
              update("maxBoards", v);
              update("searchScope", v <= 15 ? "focused" : "broad");
            }}
            className="w-full"
            style={{ accentColor: "var(--c-accent)" }} />
          <div className="flex justify-between text-[0.65rem] text-text-dim mt-1">
            <span>Quick (1-5)</span>
            <span>Medium (6-15)</span>
            <span>Large (16-30)</span>
            <span>All 55</span>
          </div>
          <div className="mt-2 text-[0.7rem] text-text-dim">
            💡 Searches are batched — Claude checks {config.maxBoards} boards, then you can run again to continue with the next batch. Progress is tracked automatically.
          </div>
        </div>

        {/* Parallel mode toggle */}
        {config.maxBoards > 1 && (
          <div className={`mb-5 px-4 py-3 rounded-xl transition-colors duration-300 ${config.parallelMode ? "bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.25)]" : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]"}`}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.parallelMode}
                onChange={(e) => update("parallelMode", e.target.checked)}
                className="mt-[2px] w-4 h-4 shrink-0 cursor-pointer"
                style={{ accentColor: "var(--c-accent)" }}
              />
              <div>
                <div className="text-[0.82rem] font-semibold text-text-base">
                  ⚡ Parallel search (multi-agent)
                </div>
                <div className="text-[0.7rem] text-text-dim mt-[3px] leading-[1.4]">
                  Searches all {config.maxBoards} boards simultaneously using separate agents.
                  Much faster, but uses ~{config.maxBoards}× more tokens.
                </div>
                {config.parallelMode && (
                  <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-[rgba(251,146,60,0.1)] border border-[rgba(251,146,60,0.2)] text-[0.68rem] text-accent leading-[1.4]">
                    ⚠️ Each board runs in its own agent context. With {config.maxBoards} boards this will
                    use significantly more API quota. Recommended for Pro plan with sufficient remaining balance.
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {/* Search button */}
        <button className={`apply-btn w-full justify-center px-5 py-3 text-[0.9rem] ${isSearching ? "opacity-60" : ""}`}
          onClick={() => onSearch(config)} disabled={isSearching}>
          {isSearching ? "⏳ Generating prompt..." : "🔍 Generate Search Prompt"}
        </button>

        <div className="text-center mt-2 text-[0.7rem] text-text-dim">
          Generates a prompt for Claude Code — no API cost until you run it
        </div>
      </div>
    </div>
  );
}
