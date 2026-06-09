"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/providers/profile-provider";
import type { UserProfile } from "@/types/profile";
import { DEFAULT_PROFILE } from "@/types/profile";
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
    <div className="container max-w-[640px]">
      <div className="header pb-4">
        <h1 className="text-[2rem]">JobHunt</h1>
        <p className="text-[0.9rem]">Set up your profile</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className="flex-1 h-[3px] rounded-sm transition-colors duration-300"
            style={{ background: i <= step ? "var(--c-primary)" : "var(--border)" }}
          />
        ))}
      </div>

      {step === 0 && <StepWelcome onNext={next} />}
      {step === 1 && (
        <StepCVUpload draft={draft} updateDraft={updateDraft} onNext={next} onBack={back} />
      )}
      {step === 2 && (
        <StepPreferences draft={draft} updateDraft={updateDraft} onNext={next} onBack={back} />
      )}
      {step === 3 && <StepComplete draft={draft} onFinish={finish} onBack={back} />}

      <div className="text-center text-text-dim text-[0.75rem] mt-6 pb-8">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </div>
    </div>
  );
}
