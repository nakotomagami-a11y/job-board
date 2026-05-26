"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@shared/types/profile";
import type { Region, Seniority } from "@shared/types/job";
import { REGIONS, SENIORITIES } from "@shared/config/filters";

interface CvAnalysis {
  suggestedRoles?: string[];
  suggestedCategories?: string[];
}

interface StepPreferencesProps {
  draft: UserProfile;
  updateDraft: (updates: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

const LABEL_STYLE = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
  marginBottom: 8,
};

const FALLBACK_ROLES = [
  "Frontend Developer",
  "React Developer",
  "Mobile Developer",
  "Full-Stack Developer",
  "Software Engineer",
  "Product Engineer",
];

const FALLBACK_CATEGORIES = [
  "Gaming",
  "Crypto / Web3",
  "AI / ML",
  "Fintech",
  "SaaS / Dev Tools",
  "E-Commerce",
];

// Broader suggestions for the suggestion panel
const SUGGESTED_ROLES = [
  "Frontend Developer",
  "Frontend Engineer",
  "React Developer",
  "React Native Developer",
  "Mobile Developer",
  "Mobile Engineer",
  "Full-Stack Developer",
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Forward Deployed Engineer",
  "UI Engineer",
  "Design Engineer",
  "Creative Developer",
  "Web Developer",
  "TypeScript Engineer",
  "GenAI Engineer",
];

const SUGGESTED_CATEGORIES = [
  "Gaming",
  "Crypto / Web3",
  "AI / ML",
  "Fintech",
  "SaaS / Dev Tools",
  "E-Commerce",
  "Social / Community",
  "Healthcare",
  "Education",
  "Media / Entertainment",
  "Cybersecurity",
  "Cloud / Infrastructure",
];

function EditableChipList({
  label,
  items,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  suggestions: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const toggle = (item: string) => {
    if (items.includes(item)) {
      onChange(items.filter((i) => i !== item));
    } else {
      onChange([...items, item]);
    }
  };

  const addCustom = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInputValue("");
    }
  };

  // Suggestions not yet selected
  const availableSuggestions = suggestions.filter((s) => !items.includes(s));

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={LABEL_STYLE}>{label}</div>

      {/* Selected items */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {items.map((item) => (
            <button
              key={item}
              onClick={() => toggle(item)}
              className="filter-btn active"
              style={{ fontSize: "0.8rem", padding: "5px 12px" }}
              title={`Click to remove`}
            >
              {item} ×
            </button>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "0.72rem",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            {showSuggestions ? "▾ Hide suggestions" : "▸ Show suggestions"}{" "}
            ({availableSuggestions.length})
          </button>
          {showSuggestions && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {availableSuggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className="filter-btn"
                  style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                >
                  + {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add custom */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          className="search-input"
          style={{ paddingLeft: 14, flex: 1 }}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          className="filter-btn"
          onClick={addCustom}
          disabled={!inputValue.trim()}
          style={{ flexShrink: 0 }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (opt === "All") return;
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options
          .filter((o) => o !== "All")
          .map((opt) => (
            <button
              key={opt}
              className={`filter-btn ${selected.includes(opt) ? "active" : ""}`}
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          ))}
      </div>
    </div>
  );
}

/**
 * Ordered region picker — array index 0 is the candidate's top priority.
 *
 * The search rotation in /api/run-command sorts boards by this order, and
 * score-job.ts grades regionMatch graduated by index (top 20pts → listed
 * 14pts → off-region remote 10pts). A regular MultiSelect can't express
 * "Europe before Remote" — this component exposes per-row up/down/remove
 * controls so the order is always user-driven.
 */
function RegionPriorityList({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const available = options.filter((o) => o !== "All" && !selected.includes(o));

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const add = (region: string) => onChange([...selected, region]);
  const remove = (region: string) => onChange(selected.filter((r) => r !== region));

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "var(--surface, rgba(255,255,255,0.03))",
    border: "1px solid var(--border, rgba(255,255,255,0.08))",
    borderRadius: 6,
    marginBottom: 6,
  } as const;

  const iconBtnStyle = {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: "0.9rem",
    lineHeight: 1,
  } as const;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 10 }}>
        Top entry is your highest priority — searches and scoring weight it first.
      </div>

      {selected.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 10, fontStyle: "italic" }}>
          No regions selected. Pick one or more below — order matters.
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {selected.map((region, idx) => (
            <div key={region} style={rowStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", width: 24 }}>
                  {idx + 1}.
                </span>
                <span style={{ fontWeight: 500 }}>{region}</span>
                {idx === 0 && (
                  <span style={{ fontSize: "0.7rem", color: "var(--accent, #38bdf8)", marginLeft: 4 }}>
                    top priority
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  type="button"
                  style={{ ...iconBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  aria-label={`Move ${region} up`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  style={{ ...iconBtnStyle, opacity: idx === selected.length - 1 ? 0.3 : 1 }}
                  disabled={idx === selected.length - 1}
                  onClick={() => move(idx, 1)}
                  aria-label={`Move ${region} down`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  style={iconBtnStyle}
                  onClick={() => remove(region)}
                  aria-label={`Remove ${region}`}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {available.map((region) => (
            <button
              key={region}
              type="button"
              className="filter-btn"
              onClick={() => add(region)}
            >
              + {region}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepPreferences({
  draft,
  updateDraft,
  onNext,
  onBack,
}: StepPreferencesProps) {
  // Load Claude's suggestions from analysis file
  const [claudeAnalysis, setClaudeAnalysis] = useState<CvAnalysis>({});

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/cv-analysis", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data) setClaudeAnalysis(data);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Normalize category names from cv-analysis to the canonical list used
  // by the rest of the app so suggestions don't create orphan filter values.
  const normalizeCategory = (c: string): string => {
    const map: Record<string, string> = {
      "web3 / blockchain": "Crypto / Web3",
      "web3": "Crypto / Web3",
      "blockchain": "Crypto / Web3",
      "defi": "Crypto / Web3",
      "crypto": "Crypto / Web3",
      "e-commerce": "E-Commerce",
      "ecommerce": "E-Commerce",
      "fintech": "Fintech",
      "fin-tech": "Fintech",
      "saas": "SaaS / Dev Tools",
      "dev tools": "SaaS / Dev Tools",
      "developer tools": "SaaS / Dev Tools",
      "social": "Social / Community",
      "community": "Social / Community",
      "ai": "AI / ML",
      "ml": "AI / ML",
      "machine learning": "AI / ML",
    };
    return map[c.toLowerCase()] ?? c;
  };

  // Use Claude's suggestions first, then fall back to hardcoded
  const roleSuggestions = claudeAnalysis.suggestedRoles?.length
    ? [...new Set([...claudeAnalysis.suggestedRoles, ...FALLBACK_ROLES])]
    : buildRoleSuggestions(draft.skills);

  const categorySuggestions = claudeAnalysis.suggestedCategories?.length
    ? [...new Set([
        ...claudeAnalysis.suggestedCategories.map(normalizeCategory),
        ...FALLBACK_CATEGORIES,
      ])]
    : buildCategorySuggestions(draft.skills, draft.cvText);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
        Your Preferences
      </h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        Tell us what you&apos;re looking for. This helps score and rank jobs for you.
      </p>

      {/* Remote preference */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Work Style</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["remote", "hybrid", "onsite", "any"] as const).map((opt) => (
            <button
              key={opt}
              className={`filter-btn ${draft.remotePreference === opt ? "active" : ""}`}
              onClick={() => updateDraft({ remotePreference: opt })}
            >
              {opt === "any"
                ? "No preference"
                : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Regions — ordered priority list. Top entry drives the search rotation. */}
      <RegionPriorityList
        label="Preferred Regions (priority order)"
        options={REGIONS}
        selected={draft.preferredRegions}
        onChange={(val) => updateDraft({ preferredRegions: val as Region[] })}
      />

      {/* Seniority — keep as simple multi-select */}
      <MultiSelect
        label="Seniority Level"
        options={SENIORITIES}
        selected={draft.preferredSeniority}
        onChange={(val) => updateDraft({ preferredSeniority: val as Seniority[] })}
      />

      {/* Role Types — dynamic with suggestions from CV */}
      <EditableChipList
        label="Job Titles / Role Types you're looking for"
        items={draft.preferredRoles}
        suggestions={roleSuggestions}
        onChange={(val) => updateDraft({ preferredRoles: val })}
        placeholder="Add a role (e.g. React Developer, UI Engineer...)"
      />

      {/* Categories — dynamic with suggestions from CV */}
      <EditableChipList
        label="Industries / Categories"
        items={draft.preferredCategories}
        suggestions={categorySuggestions}
        onChange={(val) => updateDraft({ preferredCategories: val })}
        placeholder="Add a category (e.g. Gaming, Fintech, AI...)"
      />

      {/* Salary range */}
      <div style={{ marginBottom: 24 }}>
        <div style={LABEL_STYLE}>Salary Range (USD/year, optional)</div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="number"
            className="search-input"
            style={{ paddingLeft: 14, flex: 1 }}
            placeholder="Min (e.g. 80000)"
            value={draft.salaryRange?.min || ""}
            onChange={(e) =>
              updateDraft({
                salaryRange: {
                  min: Number(e.target.value) || 0,
                  max: draft.salaryRange?.max || 0,
                  currency: "USD",
                },
              })
            }
          />
          <input
            type="number"
            className="search-input"
            style={{ paddingLeft: 14, flex: 1 }}
            placeholder="Max (e.g. 200000)"
            value={draft.salaryRange?.max || ""}
            onChange={(e) =>
              updateDraft({
                salaryRange: {
                  min: draft.salaryRange?.min || 0,
                  max: Number(e.target.value) || 0,
                  currency: "USD",
                },
              })
            }
          />
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12 }}>
        <button className="filter-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="apply-btn"
          onClick={onNext}
          style={{ flex: 1, justifyContent: "center" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// --- Smart suggestion builders based on CV content ---

function buildRoleSuggestions(skills: string[]): string[] {
  const suggestions = new Set<string>();
  const skillsLower = skills.map((s) => s.toLowerCase());

  // Always include base suggestions
  SUGGESTED_ROLES.forEach((r) => suggestions.add(r));

  // Add specific roles based on detected skills
  if (skillsLower.some((s) => ["react native", "ios", "android", "flutter", "kotlin", "swift"].includes(s))) {
    suggestions.add("Mobile Developer");
    suggestions.add("React Native Developer");
    suggestions.add("Mobile Engineer");
  }
  if (skillsLower.some((s) => ["three.js", "webgl", "pixi.js", "canvas"].includes(s))) {
    suggestions.add("Creative Developer");
    suggestions.add("WebGL Engineer");
    suggestions.add("3D Web Developer");
  }
  if (skillsLower.some((s) => ["figma", "sketch", "adobe xd"].includes(s))) {
    suggestions.add("Design Engineer");
    suggestions.add("UI/UX Developer");
  }
  if (skillsLower.some((s) => ["solidity", "web3", "blockchain", "defi", "ethers.js"].includes(s))) {
    suggestions.add("Web3 Frontend Developer");
    suggestions.add("DApp Developer");
  }
  if (skillsLower.some((s) => ["next.js", "gatsby", "astro", "remix"].includes(s))) {
    suggestions.add("Jamstack Developer");
  }
  if (skillsLower.some((s) => ["node.js", "express", "postgresql", "mongodb"].includes(s))) {
    suggestions.add("Full-Stack Developer");
  }
  // AI-adjacent tooling → suggest GenAI roles
  if (skillsLower.some((s) => ["anthropic claude", "chatgpt", "openai", "langchain", "llm"].includes(s))) {
    suggestions.add("GenAI Engineer");
    suggestions.add("AI Frontend Engineer");
  }
  // Always show generalist roles for experienced engineers
  suggestions.add("Product Engineer");
  suggestions.add("Founding Engineer");
  suggestions.add("Software Engineer");

  return Array.from(suggestions);
}

function buildCategorySuggestions(skills: string[], cvText?: string): string[] {
  const suggestions = new Set<string>();
  const skillsLower = skills.map((s) => s.toLowerCase());
  const textLower = (cvText || "").toLowerCase();

  // Always include base suggestions
  SUGGESTED_CATEGORIES.forEach((c) => suggestions.add(c));

  // Add specific categories based on CV content
  if (skillsLower.some((s) => ["solidity", "web3", "blockchain", "defi"].includes(s)) || textLower.includes("web3") || textLower.includes("blockchain")) {
    suggestions.add("Crypto / Web3");
    suggestions.add("DeFi");
  }
  if (textLower.includes("game") || textLower.includes("gaming") || textLower.includes("unity") || textLower.includes("unreal")) {
    suggestions.add("Gaming");
    suggestions.add("Esports");
  }
  if (textLower.includes("fintech") || textLower.includes("banking") || textLower.includes("payment")) {
    suggestions.add("Fintech");
    suggestions.add("Banking");
    suggestions.add("Payments");
  }
  if (textLower.includes("ecommerce") || textLower.includes("e-commerce") || textLower.includes("shopify") || textLower.includes("prestashop")) {
    suggestions.add("E-Commerce");
    suggestions.add("Retail Tech");
  }
  if (textLower.includes("ai") || textLower.includes("machine learning") || textLower.includes("llm")) {
    suggestions.add("AI / ML");
    suggestions.add("AI Tooling");
  }
  if (textLower.includes("health") || textLower.includes("medical") || textLower.includes("biotech")) {
    suggestions.add("Healthcare");
    suggestions.add("Biotech");
  }
  if (textLower.includes("startup") || textLower.includes("founding") || textLower.includes("early stage")) {
    suggestions.add("Early-Stage Startups");
  }

  return Array.from(suggestions);
}
