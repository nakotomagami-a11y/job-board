/* ── Single source of truth for routes, API paths, and storage keys ── */

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  onboarding: "/onboarding",
  settings: "/settings",
} as const;

export const API = {
  jobs: "/api/storage/jobs",
  profile: "/api/storage/profile",
  sources: "/api/sources",
  companies: "/api/companies",
  runCommand: "/api/run-command",
  parseCv: "/api/parse-cv",
  cvAnalysis: "/api/cv-analysis",
  searchHistory: "/api/search-history",
  applyDraft: "/api/apply/draft",
  applyConfirm: "/api/apply/confirm",
  applyAnswer: "/api/apply/answer",
  applyBank: "/api/apply/bank",
  applyQueue: "/api/apply/queue",
  applyBatch: "/api/apply/batch",
  applyBatchStart: "/api/apply/batch/start",
  applyBatchCancel: "/api/apply/batch/cancel",
  blocklist: "/api/blocklist/companies",
} as const;

export const STORAGE_KEYS = {
  searchParams: "jobhunt-search-params",
} as const;
