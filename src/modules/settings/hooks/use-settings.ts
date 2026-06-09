import { useRouter } from "next/navigation";
import { useProfile } from "@/providers/profile-provider";
import { API, ROUTES } from "@lib/constants";

export function useSettings() {
  const { profile, updateProfile } = useProfile();
  const router = useRouter();

  function addToList(
    key: "skills" | "preferredRoles" | "preferredCategories",
    value: string,
    setter: (v: string) => void
  ) {
    const trimmed = value.trim();
    if (trimmed && !(profile![key] as string[]).includes(trimmed)) {
      updateProfile({ [key]: [...(profile![key] as string[]), trimmed] });
      setter("");
    }
  }

  function removeFromList(
    key: "skills" | "preferredRoles" | "preferredCategories",
    value: string
  ) {
    updateProfile({ [key]: (profile![key] as string[]).filter((v) => v !== value) });
  }

  async function handleReset() {
    if (!confirm("Reset all data? This removes your profile and saved jobs.")) return;
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

  function handleRerunOnboarding() {
    updateProfile({ onboardingComplete: false });
    router.push(ROUTES.onboarding);
  }

  return { profile, updateProfile, addToList, removeFromList, handleReset, handleRerunOnboarding };
}
