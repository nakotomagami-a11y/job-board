import type { Region, Seniority } from "./job";

export interface UserProfile {
  name: string;
  email?: string;
  location?: string;
  remotePreference: "remote" | "hybrid" | "onsite" | "any";
  preferredRegions: Region[];
  primaryStack: string[];
  preferredRoles: string[];
  preferredSeniority: Seniority[];
  preferredCategories: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: string[];
  cvText?: string;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  remotePreference: "any",
  preferredRegions: [],
  primaryStack: [],
  preferredRoles: [],
  preferredSeniority: [],
  preferredCategories: [],
  skills: [],
  onboardingComplete: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
