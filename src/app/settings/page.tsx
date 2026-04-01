"use client";

import { useState } from "react";
import { useProfile } from "@shared/providers/profile-provider";
import { useRouter } from "next/navigation";
import { REGIONS, SENIORITIES } from "@shared/config/filters";
import type { Region, Seniority } from "@shared/types/job";
import { ROUTES, API } from "@lib/constants";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
  marginBottom: 6,
};

const SECTION_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 20,
};

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile();
  const router = useRouter();
  const [newSkill, setNewSkill] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newCategory, setNewCategory] = useState("");

  if (!profile) return null;

  const addToList = (
    key: "skills" | "preferredRoles" | "preferredCategories",
    value: string,
    setter: (v: string) => void
  ) => {
    const trimmed = value.trim();
    if (trimmed && !(profile[key] as string[]).includes(trimmed)) {
      updateProfile({ [key]: [...(profile[key] as string[]), trimmed] });
      setter("");
    }
  };

  const removeFromList = (
    key: "skills" | "preferredRoles" | "preferredCategories",
    value: string
  ) => {
    updateProfile({
      [key]: (profile[key] as string[]).filter((v) => v !== value),
    });
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <header className="header" style={{ textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <button className="filter-btn" onClick={() => router.push(ROUTES.dashboard)}>
            ← Dashboard
          </button>
          <h1 style={{ fontSize: "1.8rem" }}>Settings</h1>
        </div>
      </header>

      {/* === PERSONAL INFO === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Personal Info</h2>
        <div style={SECTION_STYLE}>
          <Field
            label="Name"
            value={profile.name}
            onChange={(v) => updateProfile({ name: v })}
            placeholder="Your name"
          />
          <Field
            label="Email"
            value={profile.email || ""}
            onChange={(v) => updateProfile({ email: v })}
            placeholder="your@email.com"
          />
          <Field
            label="Location"
            value={profile.location || ""}
            onChange={(v) => updateProfile({ location: v })}
            placeholder="e.g. Vilnius, Lithuania"
          />
        </div>
      </section>

      {/* === WORK PREFERENCES === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Work Preferences</h2>
        <div style={SECTION_STYLE}>
          {/* Work style */}
          <div style={{ marginBottom: 16 }}>
            <div style={LABEL_STYLE}>Work Style</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(["remote", "hybrid", "onsite", "any"] as const).map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.remotePreference === opt ? "active" : ""}`}
                  onClick={() => updateProfile({ remotePreference: opt })}
                  style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                >
                  {opt === "any" ? "No preference" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div style={{ marginBottom: 16 }}>
            <div style={LABEL_STYLE}>Preferred Regions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {REGIONS.filter((r) => r !== "All").map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.preferredRegions.includes(opt as Region) ? "active" : ""}`}
                  onClick={() => {
                    const r = opt as Region;
                    const current = profile.preferredRegions;
                    updateProfile({
                      preferredRegions: current.includes(r)
                        ? current.filter((x) => x !== r)
                        : [...current, r],
                    });
                  }}
                  style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Seniority */}
          <div style={{ marginBottom: 16 }}>
            <div style={LABEL_STYLE}>Seniority Level</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SENIORITIES.filter((s) => s !== "All").map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.preferredSeniority.includes(opt as Seniority) ? "active" : ""}`}
                  onClick={() => {
                    const s = opt as Seniority;
                    const current = profile.preferredSeniority;
                    updateProfile({
                      preferredSeniority: current.includes(s)
                        ? current.filter((x) => x !== s)
                        : [...current, s],
                    });
                  }}
                  style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Salary */}
          <div>
            <div style={LABEL_STYLE}>Salary Range (USD/year)</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                className="search-input"
                style={{ paddingLeft: 14, flex: 1 }}
                placeholder="Min"
                value={profile.salaryRange?.min || ""}
                onChange={(e) =>
                  updateProfile({
                    salaryRange: {
                      min: Number(e.target.value) || 0,
                      max: profile.salaryRange?.max || 0,
                      currency: "USD",
                    },
                  })
                }
              />
              <input
                type="number"
                className="search-input"
                style={{ paddingLeft: 14, flex: 1 }}
                placeholder="Max"
                value={profile.salaryRange?.max || ""}
                onChange={(e) =>
                  updateProfile({
                    salaryRange: {
                      min: profile.salaryRange?.min || 0,
                      max: Number(e.target.value) || 0,
                      currency: "USD",
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* === SKILLS === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Skills</h2>
        <div style={SECTION_STYLE}>
          <ChipEditor
            items={profile.skills}
            onRemove={(v) => removeFromList("skills", v)}
            inputValue={newSkill}
            onInputChange={setNewSkill}
            onAdd={() => addToList("skills", newSkill, setNewSkill)}
            placeholder="Add a skill (e.g. React, TypeScript...)"
          />
        </div>
      </section>

      {/* === ROLES === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
          Job Titles / Role Types
        </h2>
        <div style={SECTION_STYLE}>
          <ChipEditor
            items={profile.preferredRoles}
            onRemove={(v) => removeFromList("preferredRoles", v)}
            inputValue={newRole}
            onInputChange={setNewRole}
            onAdd={() => addToList("preferredRoles", newRole, setNewRole)}
            placeholder="Add a role (e.g. Frontend Developer...)"
          />
        </div>
      </section>

      {/* === CATEGORIES === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>
          Industries / Categories
        </h2>
        <div style={SECTION_STYLE}>
          <ChipEditor
            items={profile.preferredCategories}
            onRemove={(v) => removeFromList("preferredCategories", v)}
            inputValue={newCategory}
            onInputChange={setNewCategory}
            onAdd={() => addToList("preferredCategories", newCategory, setNewCategory)}
            placeholder="Add a category (e.g. Gaming, AI...)"
          />
        </div>
      </section>

      {/* === COMMANDS === */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Adding New Jobs</h2>
        <div
          style={{
            ...SECTION_STYLE,
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            lineHeight: 1.8,
          }}
        >
          <p>Ask Claude Code to run any of these commands:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>
              <code style={{ color: "var(--c-primary)" }}>CHECK_NEW_JOBS</code> — Search for new positions
            </li>
            <li>
              <code style={{ color: "var(--c-primary)" }}>UPDATE_EXISTING_JOBS</code> — Re-verify all links
            </li>
            <li>
              <code style={{ color: "var(--c-primary)" }}>CLEANUP_EXPIRED</code> — Remove old listings
            </li>
            <li>
              <code style={{ color: "var(--c-primary)" }}>STATUS_REPORT</code> — Summary of current data
            </li>
          </ul>
          <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: "0.78rem" }}>
            Jobs stored in <code>data/user/jobs.json</code>
          </p>
        </div>
      </section>

      {/* === DANGER ZONE === */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14, color: "#f87171" }}>
          Danger Zone
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="clear-btn"
            onClick={async () => {
              if (confirm("Reset all data? This removes your profile and saved jobs.")) {
                await fetch(API.profile, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: "",
                    remotePreference: "any",
                    preferredRegions: [],
                    preferredRoles: [],
                    preferredSeniority: [],
                    preferredCategories: [],
                    skills: [],
                    onboardingComplete: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }),
                });
                router.push(ROUTES.onboarding);
              }
            }}
          >
            Reset All Data
          </button>
          <button
            className="filter-btn"
            onClick={() => {
              updateProfile({ onboardingComplete: false });
              router.push(ROUTES.onboarding);
            }}
          >
            Re-run Onboarding
          </button>
        </div>
      </section>
    </div>
  );
}

/* === Reusable components === */

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={LABEL_STYLE}>{label}</div>
      <input
        type="text"
        className="search-input"
        style={{ paddingLeft: 14 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ChipEditor({
  items,
  onRemove,
  inputValue,
  onInputChange,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (v: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <>
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onRemove(item)}
              className="filter-btn active"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              title="Click to remove"
            >
              {item} ×
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          className="search-input"
          style={{ paddingLeft: 14, flex: 1 }}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <button
          className="filter-btn"
          onClick={onAdd}
          disabled={!inputValue.trim()}
          style={{ flexShrink: 0 }}
        >
          Add
        </button>
      </div>
    </>
  );
}
