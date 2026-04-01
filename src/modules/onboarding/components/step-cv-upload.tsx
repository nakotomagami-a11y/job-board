"use client";

import { useState, useCallback } from "react";
import type { UserProfile } from "@shared/types/profile";

interface StepCVUploadProps {
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

      // Step 1: Extract text from PDF
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

        // Apply basic extraction immediately so user sees something
        updateDraft({
          cvText: text,
          name: draft.name || fallbackExtractName(text),
          email: draft.email || fallbackExtractEmail(text),
          skills: fallbackExtractSkills(text),
        });

        // Step 2: Auto-trigger Claude analysis
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
          // Claude call succeeded but couldn't parse — fall through to basic
          setStatus("done");
          setStatusMsg("Basic extraction applied (Claude analysis unavailable)");
        } catch {
          // Claude analysis failed — basic extraction already applied
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
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
        Upload your CV
      </h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: "0.9rem" }}>
        Upload your CV and Claude will automatically analyze it.
      </p>

      {/* File upload */}
      <label
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 40,
          border: "2px dashed var(--border)", borderRadius: 16,
          cursor: "pointer", marginBottom: 16,
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>📄</div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {fileName || "Click to upload PDF"}
        </div>
        <input type="file" accept=".pdf" onChange={handleFile} style={{ display: "none" }} />
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
        <div style={{ marginBottom: 16 }}>
          <StatusBanner color="#f87171" icon="✗">{error}</StatusBanner>
          {draft.cvText && (
            <button className="filter-btn" onClick={retryAnalysis} style={{ marginTop: 8, fontSize: "0.8rem" }}>
              Retry Claude Analysis
            </button>
          )}
        </div>
      )}

      {/* Fields — only show after analysis is complete */}
      {draft.cvText && (status === "done" || status === "error") && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={LABEL_STYLE}>Your Name</div>
            <input type="text" className="search-input" style={{ paddingLeft: 14 }}
              placeholder="Enter your name" value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={LABEL_STYLE}>Email</div>
            <input type="email" className="search-input" style={{ paddingLeft: 14 }}
              placeholder="your@email.com" value={draft.email || ""}
              onChange={(e) => updateDraft({ email: e.target.value })} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={LABEL_STYLE}>Location</div>
            <input type="text" className="search-input" style={{ paddingLeft: 14 }}
              placeholder="e.g. Vilnius, Lithuania" value={draft.location || ""}
              onChange={(e) => updateDraft({ location: e.target.value })} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={LABEL_STYLE}>Skills ({draft.skills.length}) — click to remove</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {draft.skills.map((skill) => (
                <button key={skill} onClick={() => removeSkill(skill)} className="tag"
                  style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}>
                  {skill} ×
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" className="search-input" style={{ paddingLeft: 14, flex: 1 }}
                placeholder="Add a skill..." value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              <button className="filter-btn" onClick={addSkill} disabled={!newSkill.trim()}>Add</button>
            </div>
          </div>
        </>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12 }}>
        <button className="filter-btn" onClick={onBack}>← Back</button>
        <button className="apply-btn" onClick={onNext}
          disabled={status === "extracting" || status === "analyzing"}
          style={{ flex: 1, justifyContent: "center", opacity: status === "analyzing" ? 0.6 : 1 }}>
          {draft.cvText ? "Continue" : "Skip for now"} →
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ color, icon, children }: { color: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `color-mix(in srgb, ${color} 8%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      borderRadius: 12, padding: 12, marginBottom: 16,
      fontSize: "0.82rem", color, display: "flex", alignItems: "center", gap: 8,
    }}>
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
