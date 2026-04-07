"use client";

import { useMemo } from "react";
import type { Job } from "@shared/types/job";
import type { UserProfile } from "@shared/types/profile";
import { scoreJob } from "@lib/score-job";

export function useJobScoring(
  jobs: Job[],
  profile: UserProfile | null
): Job[] {
  return useMemo(() => {
    if (!profile || !profile.onboardingComplete) {
      return jobs;
    }

    return jobs
      .map((job) => ({
        ...job,
        matchScore: scoreJob(job, profile),
      }))
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }, [jobs, profile]);
}
