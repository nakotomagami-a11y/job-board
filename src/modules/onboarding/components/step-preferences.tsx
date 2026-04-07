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
  "Mobile Developer",
  "Full-Stack Developer",
  "Software Engineer",
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
  "Mobile Developer",
  "Full-Stack Developer",
  "React Developer",
  "React Native Developer",
  "UI Engineer",
  "Design Engineer",
  "Creative Developer",
  "Web Developer",
  "Software Engineer",
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

  // Use Claude's suggestions first, then fall back to hardcoded
  const roleSuggestions = claudeAnalysis.suggestedRoles?.length
    ? [...new Set([...claudeAnalysis.suggestedRoles, ...FALLBACK_ROLES])]
    : buildRoleSuggestions(draft.skills);

  const categorySuggestions = claudeAnalysis.suggestedCategories?.length
    ? [...new Set([...claudeAnalysis.suggestedCategories, ...FALLBACK_CATEGORIES])]
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

      {/* Regions — keep as simple multi-select */}
      <MultiSelect
        label="Preferred Regions"
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
