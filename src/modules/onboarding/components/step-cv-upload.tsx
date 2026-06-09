"use client";

import { useState, useCallback } from "react";
import type { UserProfile } from "@/types/profile";

interface StepCVUploadProps {
  draft: UserProfile;
  updateDraft: (updates: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

type Status = "idle" | "extracting" | "analyzing" | "done" | "error";

export function StepCVUpload({ draft, updateDraft, onNext, onBack }: StepCVUploadProps) {
  const [fileName, setFileName] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [newSkill, setNewSkill] = useState("");

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setError("");

      setStatus("extracting");
      setStatusMsg("Extracting text from PDF...");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-cv", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to parse PDF");
        }

        const { text } = await res.json();
        if (!text || text.trim().length === 0) throw new Error("No text found in PDF");

        updateDraft({
          cvText: text,
          name: draft.name || fallbackExtractName(text),
          email: draft.email || fallbackExtractEmail(text),
          skills: fallbackExtractSkills(text),
        });

        setStatus("analyzing");
        setStatusMsg("Claude is analyzing your CV...");

        try {
          const analyzeRes = await fetch("/api/cv-analysis", { method: "POST" });
          if (analyzeRes.ok) {
            const analysis = await analyzeRes.json();
            if (analysis && analysis.name) {
              updateDraft({
                name: analysis.name,
                email: analysis.email || draft.email,
                location: analysis.location || draft.location,
                skills: analysis.skills?.length > 0 ? analysis.skills : draft.skills,
              });
              setStatus("done");
              setStatusMsg(`Claude analyzed your CV — ${analysis.skills?.length || 0} skills, ${analysis.yearsExperience || "?"} years experience`);
              return;
            }
          }
          setStatus("done");
          setStatusMsg("Basic extraction applied (Claude analysis unavailable)");
        } catch {
          setStatus("done");
          setStatusMsg("Basic extraction applied (Claude analysis unavailable)");
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not read PDF.");
      }
    },
    [draft.name, draft.email, draft.location, draft.skills, updateDraft]
  );

  const removeSkill = (skill: string) => {
    updateDraft({ skills: draft.skills.filter((s) => s !== skill) });
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !draft.skills.includes(trimmed)) {
      updateDraft({ skills: [...draft.skills, trimmed] });
      setNewSkill("");
    }
  };

  const retryAnalysis = async () => {
    setStatus("analyzing");
    setStatusMsg("Retrying Claude analysis...");
    setError("");
    try {
      const res = await fetch("/api/cv-analysis", { method: "POST" });
      if (res.ok) {
        const analysis = await res.json();
        if (analysis && analysis.name) {
          updateDraft({
            name: analysis.name,
            email: analysis.email || draft.email,
            location: analysis.location || draft.location,
            skills: analysis.skills?.length > 0 ? analysis.skills : draft.skills,
          });
          setStatus("done");
          setStatusMsg(`Claude analyzed your CV — ${analysis.skills?.length || 0} skills detected`);
          return;
        }
      }
      setStatus("done");
      setStatusMsg("Could not parse Claude's response. Edit fields manually.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  };

  return (
    <div>
      <h2 className="text-[1.3rem] font-bold mb-2">
        Upload your CV
      </h2>
      <p className="text-text-muted mb-6 text-[0.9rem]">
        Upload your CV and Claude will automatically analyze it.
      </p>

      {/* File upload */}
      <label className="flex flex-col items-center justify-center p-[40px] border-2 border-dashed border-border rounded-2xl cursor-pointer mb-4">
        <div className="text-[2rem] mb-2">📄</div>
        <div className="text-text-muted text-[0.9rem]">
          {fileName || "Click to upload PDF"}
        </div>
        <input type="file" accept=".pdf" onChange={handleFile} className="hidden" />
      </label>

      {/* Status banner */}
      {status === "extracting" && (
        <StatusBanner color="var(--c-primary)" icon="📝">{statusMsg}</StatusBanner>
      )}
      {status === "analyzing" && (
        <StatusBanner color="var(--c-purple)" icon="🤖">{statusMsg}</StatusBanner>
      )}
      {status === "done" && (
        <StatusBanner color="var(--c-secondary)" icon="✓">{statusMsg}</StatusBanner>
      )}
      {status === "error" && (
        <div className="mb-4">
          <StatusBanner color="#f87171" icon="✗">{error}</StatusBanner>
          {draft.cvText && (
            <button className="filter-btn mt-2 text-[0.8rem]" onClick={retryAnalysis}>
              Retry Claude Analysis
            </button>
          )}
        </div>
      )}

      {/* Fields — only show after analysis is complete */}
      {draft.cvText && (status === "done" || status === "error") && (
        <>
          <div className="mb-5">
            <div className="section-label">Your Name</div>
            <input type="text" className="search-input pl-3.5"
              placeholder="Enter your name" value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })} />
          </div>

          <div className="mb-5">
            <div className="section-label">Email</div>
            <input type="email" className="search-input pl-3.5"
              placeholder="your@email.com" value={draft.email || ""}
              onChange={(e) => updateDraft({ email: e.target.value })} />
          </div>

          <div className="mb-5">
            <div className="section-label">Location</div>
            <input type="text" className="search-input pl-3.5"
              placeholder="e.g. Vilnius, Lithuania" value={draft.location || ""}
              onChange={(e) => updateDraft({ location: e.target.value })} />
          </div>

          <div className="mb-6">
            <div className="section-label">Skills ({draft.skills.length}) — click to remove</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {draft.skills.map((skill) => (
                <button key={skill} onClick={() => removeSkill(skill)} className="tag cursor-pointer border-none font-[inherit]">
                  {skill} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" className="search-input pl-3.5 flex-1"
                placeholder="Add a skill..." value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              <button className="filter-btn" onClick={addSkill} disabled={!newSkill.trim()}>Add</button>
            </div>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button className="filter-btn" onClick={onBack}>← Back</button>
        <button className={`apply-btn flex-1 justify-center ${status === "analyzing" ? "opacity-60" : ""}`}
          onClick={onNext}
          disabled={status === "extracting" || status === "analyzing"}>
          {draft.cvText ? "Continue" : "Skip for now"} →
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ color, icon, children }: { color: string; icon: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 mb-4 text-[0.82rem] flex items-center gap-2"
      style={{
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        color,
      }}
    >
      <span>{icon}</span> {children}
    </div>
  );
}

// --- Basic fallback extractors ---

function fallbackExtractName(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "";
  return lines[0].trim().split(/\s+/).slice(0, 2).join(" ");
}

function fallbackExtractEmail(text: string): string {
  const candidates = text.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  for (const raw of candidates) {
    const atIdx = raw.indexOf("@");
    const domain = raw.substring(atIdx + 1);
    const lastDot = domain.lastIndexOf(".");
    const tldPart = domain.substring(lastDot + 1);
    const tldMatch = tldPart.match(/^[a-z]+/);
    if (tldMatch) {
      return raw.substring(0, atIdx + 1) + domain.substring(0, lastDot + 1) + tldMatch[0];
    }
  }
  return "";
}

function fallbackExtractSkills(text: string): string[] {
  const knownSkills = [
    "React", "React Native", "Next.js", "TypeScript", "JavaScript",
    "HTML5", "CSS", "Tailwind CSS", "SASS", "SCSS",
    "Redux", "MobX", "Zustand", "GraphQL", "REST API",
    "Node.js", "Express", "Firebase", "MongoDB", "PostgreSQL",
    "Git", "Docker", "AWS", "Vercel", "Figma",
    "Three.js", "WebGL", "Electron", "Vite", "Webpack",
    "Jest", "Cypress", "Playwright", "Storybook",
    "Python", "Go", "Rust", "Swift", "Kotlin",
    "iOS", "Android", "Flutter", "Vue.js", "Angular",
    "Svelte", "Astro", "Remix", "Gatsby",
    "Solidity", "Web3", "Blockchain", "DeFi",
    "jQuery", "Bootstrap", "Material UI", "Chakra UI",
    "CI/CD", "Agile", "Scrum", "TDD", "SOLID",
    "Photoshop", "PrestaShop", "GitHub",
  ];
  const textLower = text.toLowerCase();
  return knownSkills.filter((s) => textLower.includes(s.toLowerCase()));
}
