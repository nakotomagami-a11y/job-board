/* ── Shared API response types ── */

import type { Job } from "./job";
import type { UserProfile } from "./profile";

export interface ApiError {
  error: string;
}

// /api/storage/jobs
export type JobsGetResponse = Job[];
export interface JobsPostResponse {
  added: number;
  total: number;
}
export interface JobsPutResponse {
  total: number;
}
export interface JobsPatchResponse {
  updated: string;
}
export interface JobsDeleteResponse {
  deleted: string;
  total: number;
}

// /api/storage/profile
export type ProfileGetResponse = UserProfile | null;
export type ProfilePutResponse = UserProfile;

// /api/claude/search
export interface ClaudeSearchResponse {
  jobs: Job[];
  count: number;
  error?: string;
  raw?: string;
}
