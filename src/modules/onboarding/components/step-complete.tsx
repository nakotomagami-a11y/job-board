"use client";

import type { UserProfile } from "@shared/types/profile";

interface StepCompleteProps {
  draft: UserProfile;
  onFinish: () => void;
  onBack: () => void;
}

export function StepComplete({ draft, onFinish, onBack }: StepCompleteProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>
        You&apos;re all set{draft.name ? `, ${draft.name.split(" ")[0]}` : ""}!
      </h2>
      <p
        style={{
          color: "var(--text-muted)",
          marginBottom: 32,
          fontSize: "0.9rem",
        }}
      >
        Your profile is ready. Here&apos;s a summary:
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          textAlign: "left",
          marginBottom: 32,
        }}
      >
        <ProfileRow label="Name" value={draft.name || "Not set"} />
        <ProfileRow
          label="Work Style"
          value={draft.remotePreference === "any" ? "No preference" : draft.remotePreference}
        />
        <ProfileRow
          label="Regions"
          value={
            draft.preferredRegions.length > 0
              ? draft.preferredRegions.join(", ")
              : "All regions"
          }
        />
        <ProfileRow
          label="Roles"
          value={
            draft.preferredRoles.length > 0
              ? draft.preferredRoles.join(", ")
              : "All roles"
          }
        />
        <ProfileRow
          label="Skills"
          value={
            draft.skills.length > 0
              ? draft.skills.slice(0, 8).join(", ") +
                (draft.skills.length > 8 ? ` +${draft.skills.length - 8} more` : "")
              : "None detected"
          }
        />
        <ProfileRow
          label="CV"
          value={draft.cvText ? "✓ Uploaded" : "Not uploaded"}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="filter-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="apply-btn"
          onClick={onFinish}
          style={{ flex: 1, justifyContent: "center", padding: "12px 32px", fontSize: "0.95rem" }}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>
        {value}
      </span>
    </div>
  );
}
