---
name: project-cleanup-plan
description: Active refactoring queue for job-board — Tailwind migration then settings page code quality pass
metadata:
  type: project
---

Two-phase cleanup in progress:

**Phase 1 — Tailwind migration (next):**
- Wire up Tailwind v4: add `@tailwindcss/postcss` to postcss.config.mjs, add `@import "tailwindcss"` to globals.css
- Define `@theme inline` block mapping existing `:root` CSS vars to Tailwind color tokens
- Convert all 284 `style={{}}` inline style occurrences across 18 files to Tailwind utilities
- Keep in globals.css: `body::before` radial gradient, `@keyframes`, `.job-card::before` mask trick, scrollbar styles — these can't be expressed in Tailwind
- After migration, verify zero remaining hardcoded inline styles (CSS variable assignments like `--card-accent` and dynamic `animationDelay` are acceptable exceptions)

**Phase 2 — Settings page code quality (after Tailwind):**
- Split `Field` and `ChipEditor` components out of page.tsx into own files (one component = one file)
- Move logic (`addToList`, `removeFromList`, `handleReset`, `handleRerunOnboarding`) to `use-settings.ts` hook or utils
- Settings page itself should be thin — just layout wiring
- No inline onclick handlers with async logic directly in JSX

**Why:** User wants clean, readable code with logic separated from components, reusable components, and no inline styles anywhere.
</content>
</invoke>