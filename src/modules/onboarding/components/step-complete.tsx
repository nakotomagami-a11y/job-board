"use client";

import type { UserProfile } from "@/types/profile";

interface StepCompleteProps {
  draft: UserProfile;
  onFinish: () => void;
  onBack: () => void;
}

export function StepComplete({ draft, onFinish, onBack }: StepCompleteProps) {
  return (
    <div className="text-center">
      <div className="text-[3rem] mb-4">🚀</div>
      <h2 className="text-[1.5rem] font-bold mb-3">
        You&apos;re all set{draft.name ? `, ${draft.name.split(" ")[0]}` : ""}!
      </h2>
      <p className="text-text-muted mb-8 text-[0.9rem]">
        Your profile is ready. Here&apos;s a summary:
      </p>

      <div className="bg-surface border border-border rounded-2xl p-6 text-left mb-8">
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

      <div className="flex gap-3">
        <button className="filter-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="apply-btn flex-1 justify-center px-8 py-3 text-[0.95rem]"
          onClick={onFinish}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border text-[0.85rem]">
      <span className="text-text-dim">{label}</span>
      <span className="text-text-base font-medium text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
