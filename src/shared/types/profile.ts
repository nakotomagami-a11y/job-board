import type { Region, Seniority } from "./job";

export interface UserProfile {
  name: string;
  email?: string;
  location?: string;
  remotePreference: "remote" | "hybrid" | "onsite" | "any";
  preferredRegions: Region[];
  preferredRoles: string[]; // free-form: "Frontend Developer", "React Native Dev", etc.
  preferredSeniority: Seniority[];
  preferredCategories: string[]; // free-form: "Gaming", "Fintech", "DeFi", etc.
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: string[];
  cvText?: string;
  claudeApiKey?: string;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROFILE: UserProfile = {
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
};
