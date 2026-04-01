"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@shared/providers/profile-provider";
import type { UserProfile } from "@shared/types/profile";
import { DEFAULT_PROFILE } from "@shared/types/profile";
import { ROUTES } from "@lib/constants";
import { StepWelcome } from "./step-welcome";
import { StepCVUpload } from "./step-cv-upload";
import { StepPreferences } from "./step-preferences";
import { StepComplete } from "./step-complete";

const STEPS = ["Welcome", "CV", "Preferences", "Complete"] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<UserProfile>({
    ...DEFAULT_PROFILE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const { updateProfile } = useProfile();
  const router = useRouter();

  const updateDraft = (updates: Partial<UserProfile>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    await updateProfile({ ...draft, onboardingComplete: true });
    router.push(ROUTES.dashboard);
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="header" style={{ paddingBottom: 16 }}>
        <h1 style={{ fontSize: "2rem" }}>JobHunt</h1>
        <p style={{ fontSize: "0.9rem" }}>Set up your profile</p>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
        {STEPS.map((label, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= step ? "var(--c-primary)" : "var(--border)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Step content */}
      {step === 0 && <StepWelcome onNext={next} />}
      {step === 1 && (
        <StepCVUpload draft={draft} updateDraft={updateDraft} onNext={next} onBack={back} />
      )}
      {step === 2 && (
        <StepPreferences draft={draft} updateDraft={updateDraft} onNext={next} onBack={back} />
      )}
      {step === 3 && <StepComplete draft={draft} onFinish={finish} onBack={back} />}

      {/* Step indicator */}
      <div
        style={{
          textAlign: "center",
          color: "var(--text-dim)",
          fontSize: "0.75rem",
          marginTop: 24,
          paddingBottom: 32,
        }}
      >
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </div>
    </div>
  );
}
