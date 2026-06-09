"use client";

import { useState } from "react";
import { REGIONS, SENIORITIES } from "@/config/filters";
import type { Region, Seniority } from "@/types/job";
import { Field } from "@modules/settings/components/Field";
import { ChipEditor } from "@modules/settings/components/ChipEditor";
import { useSettings } from "@modules/settings/hooks/use-settings";
import { ROUTES } from "@lib/constants";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { profile, updateProfile, addToList, removeFromList, handleReset, handleRerunOnboarding } = useSettings();
  const router = useRouter();
  const [newSkill, setNewSkill] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newCategory, setNewCategory] = useState("");

  if (!profile) return null;

  return (
    <div className="container max-w-[640px]">
      <header className="header text-left">
        <div className="flex items-center gap-4 mb-2">
          <button className="filter-btn" onClick={() => router.push(ROUTES.dashboard)}>
            ← Dashboard
          </button>
          <h1 className="text-[1.8rem]">Settings</h1>
        </div>
      </header>

      {/* === PERSONAL INFO === */}
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">Personal Info</h2>
        <div className="section-box">
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
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">Work Preferences</h2>
        <div className="section-box">
          {/* Work style */}
          <div className="mb-4">
            <div className="section-label">Work Style</div>
            <div className="flex flex-wrap gap-1.5">
              {(["remote", "hybrid", "onsite", "any"] as const).map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.remotePreference === opt ? "active" : ""} text-[0.8rem] px-3 py-[5px]`}
                  onClick={() => updateProfile({ remotePreference: opt })}
                >
                  {opt === "any" ? "No preference" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div className="mb-4">
            <div className="section-label">Preferred Regions</div>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.filter((r) => r !== "All").map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.preferredRegions.includes(opt as Region) ? "active" : ""} text-[0.8rem] px-3 py-[5px]`}
                  onClick={() => {
                    const r = opt as Region;
                    const current = profile.preferredRegions;
                    updateProfile({
                      preferredRegions: current.includes(r)
                        ? current.filter((x) => x !== r)
                        : [...current, r],
                    });
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Seniority */}
          <div className="mb-4">
            <div className="section-label">Seniority Level</div>
            <div className="flex flex-wrap gap-1.5">
              {SENIORITIES.filter((s) => s !== "All").map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${profile.preferredSeniority.includes(opt as Seniority) ? "active" : ""} text-[0.8rem] px-3 py-[5px]`}
                  onClick={() => {
                    const s = opt as Seniority;
                    const current = profile.preferredSeniority;
                    updateProfile({
                      preferredSeniority: current.includes(s)
                        ? current.filter((x) => x !== s)
                        : [...current, s],
                    });
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Salary */}
          <div>
            <div className="section-label">Salary Range (USD/year)</div>
            <div className="flex gap-2.5">
              <input
                type="number"
                className="search-input pl-3.5 flex-1"
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
                className="search-input pl-3.5 flex-1"
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
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">Skills</h2>
        <div className="section-box">
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
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">
          Job Titles / Role Types
        </h2>
        <div className="section-box">
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
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">
          Industries / Categories
        </h2>
        <div className="section-box">
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
      <section className="mb-7">
        <h2 className="text-base font-bold mb-3.5">Adding New Jobs</h2>
        <div className="section-box text-text-muted text-[0.85rem] leading-[1.8]">
          <p>Ask Claude Code to run any of these commands:</p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              <code className="text-primary">CHECK_NEW_JOBS</code> — Search for new positions
            </li>
            <li>
              <code className="text-primary">UPDATE_EXISTING_JOBS</code> — Re-verify all links
            </li>
            <li>
              <code className="text-primary">CLEANUP_EXPIRED</code> — Remove old listings
            </li>
            <li>
              <code className="text-primary">STATUS_REPORT</code> — Summary of current data
            </li>
          </ul>
          <p className="mt-3 text-text-dim text-[0.78rem]">
            Jobs stored in <code>data/user/jobs.json</code>
          </p>
        </div>
      </section>

      {/* === DANGER ZONE === */}
      <section className="mb-12">
        <h2 className="text-base font-bold mb-3.5 text-danger">
          Danger Zone
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button className="clear-btn" onClick={handleReset}>
            Reset All Data
          </button>
          <button className="filter-btn" onClick={handleRerunOnboarding}>
            Re-run Onboarding
          </button>
        </div>
      </section>
    </div>
  );
}
