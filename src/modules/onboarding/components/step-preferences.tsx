"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/types/profile";
import type { Region, Seniority } from "@/types/job";
import { REGIONS, SENIORITIES } from "@/config/filters";

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

  const availableSuggestions = suggestions.filter((s) => !items.includes(s));

  return (
    <div className="mb-5">
      <div className="section-label">{label}</div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => toggle(item)}
              className="filter-btn active text-[0.8rem] px-3 py-[5px]"
              title="Click to remove"
            >
              {item} ×
            </button>
          ))}
        </div>
      )}

      {availableSuggestions.length > 0 && (
        <div className="mb-2.5">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="bg-transparent border-none text-text-dim text-[0.72rem] cursor-pointer p-0 font-[inherit]"
          >
            {showSuggestions ? "▾ Hide suggestions" : "▸ Show suggestions"}{" "}
            ({availableSuggestions.length})
          </button>
          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {availableSuggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className="filter-btn text-[0.78rem] px-2.5 py-1"
                >
                  + {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          className="search-input pl-3.5 flex-1"
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
          className="filter-btn shrink-0"
          onClick={addCustom}
          disabled={!inputValue.trim()}
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
    <div className="mb-5">
      <div className="section-label">{label}</div>
      <div className="flex flex-wrap gap-2">
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

  return (
    <div className="mb-5">
      <div className="section-label">{label}</div>
      <div className="text-[0.75rem] text-text-muted mb-2.5">
        Top entry is your highest priority — searches and scoring weight it first.
      </div>

      {selected.length === 0 ? (
        <div className="text-[0.85rem] text-text-dim mb-2.5 italic">
          No regions selected. Pick one or more below — order matters.
        </div>
      ) : (
        <div className="mb-3">
          {selected.map((region, idx) => (
            <div
              key={region}
              className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-md mb-1.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[0.75rem] text-text-dim w-6">
                  {idx + 1}.
                </span>
                <span className="font-medium">{region}</span>
                {idx === 0 && (
                  <span className="text-[0.7rem] text-[var(--accent,#38bdf8)] ml-1">
                    top priority
                  </span>
                )}
              </div>
              <div className="flex gap-[2px]">
                <button
                  type="button"
                  className="bg-transparent border-none text-text-muted cursor-pointer px-2 py-1 text-[0.9rem] leading-none"
                  style={{ opacity: idx === 0 ? 0.3 : 1 }}
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  aria-label={`Move ${region} up`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="bg-transparent border-none text-text-muted cursor-pointer px-2 py-1 text-[0.9rem] leading-none"
                  style={{ opacity: idx === selected.length - 1 ? 0.3 : 1 }}
                  disabled={idx === selected.length - 1}
                  onClick={() => move(idx, 1)}
                  aria-label={`Move ${region} down`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="bg-transparent border-none text-text-muted cursor-pointer px-2 py-1 text-[0.9rem] leading-none"
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
        <div className="flex flex-wrap gap-2">
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
      <h2 className="text-[1.3rem] font-bold mb-2">
        Your Preferences
      </h2>
      <p className="text-text-muted mb-6 text-[0.9rem]">
        Tell us what you&apos;re looking for. This helps score and rank jobs for you.
      </p>

      {/* Remote preference */}
      <div className="mb-5">
        <div className="section-label">Work Style</div>
        <div className="flex flex-wrap gap-2">
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

      <RegionPriorityList
        label="Preferred Regions (priority order)"
        options={REGIONS}
        selected={draft.preferredRegions}
        onChange={(val) => updateDraft({ preferredRegions: val as Region[] })}
      />

      <MultiSelect
        label="Seniority Level"
        options={SENIORITIES}
        selected={draft.preferredSeniority}
        onChange={(val) => updateDraft({ preferredSeniority: val as Seniority[] })}
      />

      <EditableChipList
        label="Primary Tech Stack (drives job search)"
        items={draft.primaryStack ?? []}
        suggestions={["JavaScript", "TypeScript", "Python", "Go", "Rust", "React", "Vue", "React Native", "Node.js", "Next.js", "Flutter", "Django", "Spring", "C#"]}
        onChange={(val) => updateDraft({ primaryStack: val })}
        placeholder="Add language or framework (e.g. TypeScript, React)"
      />

      <EditableChipList
        label="Job Titles / Role Types you're looking for"
        items={draft.preferredRoles}
        suggestions={roleSuggestions}
        onChange={(val) => updateDraft({ preferredRoles: val })}
        placeholder="Add a role (e.g. React Developer, UI Engineer...)"
      />

      <EditableChipList
        label="Industries / Categories"
        items={draft.preferredCategories}
        suggestions={categorySuggestions}
        onChange={(val) => updateDraft({ preferredCategories: val })}
        placeholder="Add a category (e.g. Gaming, Fintech, AI...)"
      />

      {/* Salary range */}
      <div className="mb-6">
        <div className="section-label">Salary Range (USD/year, optional)</div>
        <div className="flex gap-3">
          <input
            type="number"
            className="search-input pl-3.5 flex-1"
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
            className="search-input pl-3.5 flex-1"
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
      <div className="flex gap-3">
        <button className="filter-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="apply-btn flex-1 justify-center"
          onClick={onNext}
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

  SUGGESTED_ROLES.forEach((r) => suggestions.add(r));

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
  if (skillsLower.some((s) => ["anthropic claude", "chatgpt", "openai", "langchain", "llm"].includes(s))) {
    suggestions.add("GenAI Engineer");
    suggestions.add("AI Frontend Engineer");
  }
  suggestions.add("Product Engineer");
  suggestions.add("Founding Engineer");
  suggestions.add("Software Engineer");

  return Array.from(suggestions);
}

function buildCategorySuggestions(skills: string[], cvText?: string): string[] {
  const suggestions = new Set<string>();
  const skillsLower = skills.map((s) => s.toLowerCase());
  const textLower = (cvText || "").toLowerCase();

  SUGGESTED_CATEGORIES.forEach((c) => suggestions.add(c));

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
