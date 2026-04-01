"use client";

import { useMemo } from "react";
import type { Job } from "@shared/types/job";
import type { UserProfile } from "@shared/types/profile";
import { SCORING_WEIGHTS, SENIORITY_ORDER } from "@shared/config/scoring";

function scoreJob(job: Job, profile: UserProfile): number {
  let total = 0;

  // Tech stack overlap (25 pts)
  if (profile.skills.length > 0) {
    const profileSkillsLower = profile.skills.map((s) => s.toLowerCase());
    const jobTagsLower = job.tags.map((t) => t.toLowerCase());
    const matches = profileSkillsLower.filter((s) =>
      jobTagsLower.some((t) => t.includes(s) || s.includes(t))
    ).length;
    total +=
      (matches / profileSkillsLower.length) * SCORING_WEIGHTS.techStackOverlap;
  } else {
    total += SCORING_WEIGHTS.techStackOverlap * 0.5; // neutral if no skills set
  }

  // Region match (20 pts)
  if (profile.preferredRegions.length > 0) {
    if (profile.preferredRegions.includes(job.region)) {
      total += SCORING_WEIGHTS.regionMatch;
    } else if (
      profile.remotePreference === "remote" &&
      job.remote
    ) {
      total += SCORING_WEIGHTS.regionMatch * 0.8;
    }
  } else if (profile.remotePreference === "remote" && job.remote) {
    total += SCORING_WEIGHTS.regionMatch;
  } else {
    total += SCORING_WEIGHTS.regionMatch * 0.5;
  }

  // Role type match (20 pts) — fuzzy match against free-form preferred roles
  if (profile.preferredRoles.length > 0) {
    const jobRoleLower = job.roleType.toLowerCase();
    const jobTitleLower = job.title.toLowerCase();
    const hasMatch = profile.preferredRoles.some((pref) => {
      const prefLower = pref.toLowerCase();
      return (
        jobRoleLower.includes(prefLower) ||
        prefLower.includes(jobRoleLower) ||
        jobTitleLower.includes(prefLower) ||
        prefLower.includes(jobTitleLower.split(",")[0])
      );
    });
    total += hasMatch
      ? SCORING_WEIGHTS.roleTypeMatch
      : SCORING_WEIGHTS.roleTypeMatch * 0.2;
  } else {
    total += SCORING_WEIGHTS.roleTypeMatch * 0.5;
  }

  // Seniority match (15 pts)
  if (profile.preferredSeniority.length > 0) {
    if (profile.preferredSeniority.includes(job.seniority)) {
      total += SCORING_WEIGHTS.seniorityMatch;
    } else {
      const jobIdx = SENIORITY_ORDER.indexOf(
        job.seniority as (typeof SENIORITY_ORDER)[number]
      );
      const closestDist = Math.min(
        ...profile.preferredSeniority.map((s) => {
          const idx = SENIORITY_ORDER.indexOf(
            s as (typeof SENIORITY_ORDER)[number]
          );
          return Math.abs(jobIdx - idx);
        })
      );
      if (closestDist === 1) total += SCORING_WEIGHTS.seniorityMatch * 0.75;
      else if (closestDist === 2)
        total += SCORING_WEIGHTS.seniorityMatch * 0.25;
    }
  } else {
    total += SCORING_WEIGHTS.seniorityMatch * 0.5;
  }

  // Category match (10 pts) — fuzzy match against free-form categories
  if (profile.preferredCategories.length > 0) {
    const jobCatLower = job.category.toLowerCase();
    const jobDescLower = (job.description || "").toLowerCase();
    const hasMatch = profile.preferredCategories.some((pref) => {
      const prefLower = pref.toLowerCase();
      return (
        jobCatLower.includes(prefLower) ||
        prefLower.includes(jobCatLower) ||
        jobDescLower.includes(prefLower)
      );
    });
    total += hasMatch
      ? SCORING_WEIGHTS.categoryMatch
      : 0;
  } else {
    total += SCORING_WEIGHTS.categoryMatch * 0.5;
  }

  // Recency bonus (5 pts) — linear decay over 30 days
  const daysSincePosted = Math.floor(
    (Date.now() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recency = Math.max(0, 1 - daysSincePosted / 30);
  total += recency * SCORING_WEIGHTS.recencyBonus;

  // Salary match (5 pts)
  if (profile.salaryRange && job.salary) {
    const salaryNums = job.salary.match(/[\d,]+/g);
    if (salaryNums && salaryNums.length >= 1) {
      const jobMin = parseInt(salaryNums[0].replace(/,/g, ""));
      const jobMax = salaryNums[1]
        ? parseInt(salaryNums[1].replace(/,/g, ""))
        : jobMin;
      const profileMin = profile.salaryRange.min;
      const profileMax = profile.salaryRange.max;

      if (jobMax >= profileMin && jobMin <= profileMax) {
        total += SCORING_WEIGHTS.salaryMatch;
      }
    }
  } else {
    total += SCORING_WEIGHTS.salaryMatch * 0.3;
  }

  return Math.round(total);
}

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
