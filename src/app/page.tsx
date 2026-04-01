"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@shared/providers/profile-provider";
import { ROUTES } from "@lib/constants";

export default function Home() {
  const { profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (profile?.onboardingComplete) {
      router.replace(ROUTES.dashboard);
    } else {
      router.replace(ROUTES.onboarding);
    }
  }, [profile, loading, router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        color: "var(--text-dim)",
      }}
    >
      Loading...
    </div>
  );
}
