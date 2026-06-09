# Implementation Plan — EU-focused auto-apply rebuild

**Goal:** Reset the source list to EU-native boards. Refactor the apply pipeline to be board-aware so each source's quirks live in a dedicated handler with its own QA fixtures. Land enough foundation that real-life testing against EU boards is meaningful.

**Status:** 🟢 Ready for real-life QA
**Started:** 2026-05-26
**Autonomous mode:** Strategist dispatches each phase to developer agent, then QAs (tsc/tests/lint/spec-trace) before dispatching next. User pinged when foundation complete and ready for real-life QA.

---

## Phase 5.0 — EU-first source rebuild
**Status:** ✅ done

Replace US-skewed source list with EU-native boards. Wipe stale jobs.json (no backup per user; pre-prod). Add foundation fields for the upcoming board-aware refactor.

**Acceptance:**
- [x] `src/shared/config/priority-boards.ts` rewritten with EU tier structure
- [x] Tier 1: StepStone, Honeypot, NoFluff, Just Join IT, Pracuj, CVbankas, MeetFrank, The Hub, Landing.jobs, WTTJ, SwissDevJobs, WeAreDevelopers, Berlin Startup Jobs
- [x] Tier 2: Arbeitnow, EU-Startups, Relocate.me, EU Remote Jobs
- [x] Tier 3: Remotive/RemoteOK/Jobicy/Himalayas/Working Nomads with EU-only query notes
- [x] Tier 4: Greenhouse/Lever/Ashby/Workable/Recruitee/Personio with curated EU companies
- [x] Removed: Indeed, Glassdoor, ZipRecruiter, Built In, Dice, Wellfound, YC Work at a Startup, The Muse, WeWorkRemotely, arc.dev
- [x] `BoardSource` enum added to `src/shared/types/job.ts`; `Job` interface uses it on a new `boardSource` field
- [x] `data/user.example/eu-ats-companies.json` seed with ~30 EU-HQ'd companies on Greenhouse/Lever/Ashby
- [x] Storage POST response includes `letThroughAsUnknown` count from `classifyRegion`
- [x] `data/user/jobs.json` wiped to `[]`
- [x] `src/app/api/run-command/route.ts` prompt updated: prioritize Tier 1 in agent sweeps
- [x] `pnpm tsc --noEmit` exit 0, `pnpm test` passes, `pnpm lint` exit 0

---

## Phase 6.0 — Board-aware architecture foundation
**Status:** ✅ done

Refactor `executeDraft` to dispatch on URL pattern. Default handler preserves current behavior; specific boards opt into custom logic.

**Acceptance:**
- [x] `src/lib/boards/` directory with `BoardHandler` interface
- [x] Dispatcher `src/lib/boards/index.ts` mapping URL → handler
- [x] `src/lib/boards/default.ts` mirrors current generic executeDraft logic
- [x] `executeDraft` calls `dispatcher.find(url).process(page, bank, cvPath)`
- [x] Confidence tag (`verified | experimental | broken`) on each handler
- [x] JobCard shows board confidence badge
- [x] AI Apply button disabled (or shows warning confirm) when board confidence is `experimental` or `broken`
- [x] Dashboard "Boards" panel: list each handler, confidence, last QA date, active job count
- [x] tsc/tests/lint pass
- [x] Default handler retains 100% of current behavior — no regression on Greenhouse/Ashby/Lever direct URLs

---

## Phase 6.1 — Greenhouse handler
**Status:** ✅ done

First verified board. Most EU companies on Greenhouse use a consistent template.

**Acceptance:**
- [x] `src/lib/boards/greenhouse.ts` exports a `BoardHandler` matching `job-boards.greenhouse.io/*`
- [x] Test fixture: anonymized real Greenhouse HTML snapshot in `src/lib/boards/__fixtures__/greenhouse-sample.html`
- [x] Tests verify: URL matching, confidence tag, findHandler routing (16 new tests, 159 -> 175)
- [x] Greenhouse handler marked `verified`
- [x] tsc/tests/lint pass
- [x] Phase 6.1.1: Greenhouse autofill widget detection -- uploads CV via the autofill widget if present; manual fill respects pre-populated values

---

## Phase 6.3 — Arbeitnow redirect handler
**Status:** ✅ done

Most acute production bug. Arbeitnow URLs go to listing pages, not apply forms.

**Acceptance:**
- [x] `src/lib/boards/arbeitnow.ts` matches `arbeitnow.com/*`
- [x] `resolveApplyUrl(listingUrl): string` extracts the "Apply Now" link's destination
- [x] After resolution, dispatches to whichever handler matches the destination (Lever, JOIN, Greenhouse, etc.)
- [x] If destination matches no known board, falls back to default handler with `experimental` confidence
- [x] Test fixture: arbeitnow listing HTML with the Apply Now link
- [x] tsc/tests/lint pass

---

## After autonomous run completes

🛑 **Ping user for real-life QA** with:
- Summary of what was built
- Current confidence tags per board
- Suggested 5-job test batch against the new EU sources
- Open follow-up phases (deferred to after real-life data):
  - 6.2 Ashby handler
  - 6.4 Lever + Workable handlers
  - 6.5 NoFluff + StepStone EU-native handlers
  - 6.6 LinkedIn (mark broken/login-required)
  - 7.0 Per-company essay overrides

---

## Phase 6.1.2 — Bundled Greenhouse QA fixes
**Status:** done

Four bugs from real-life Adyen/Greenhouse QA, fixed atomically.

**Acceptance:**
- [x] `tryGreenhouseAccountAutofill` detects candidate-portal "Autofill with Greenhouse" button; returns 'skipped' when absent
- [x] `autofillUsed` type updated to `'greenhouse_account' | 'greenhouse_resume' | 'none'`
- [x] `process()` priority: account autofill -> resume widget -> manual fill loop
- [x] `findResumeFileInput` broadened: gathers id/name/aria-label/placeholder/title/accept + label[for] + closest label + ancestor fieldset/section/div (5 levels) + sibling span/small/p; excludes `data-gh-autofill-marker` inputs; picks best match by resume/cv mention count
- [x] `fillSelectFuzzy` replaces bare `selectOption({label})` in both select branches of `fillByQuestionText`: exact-label -> exact-value -> decline fuzzy -> yes/no exact -> substring fuzzy
- [x] `VERB_LABEL_RE` rejects slash/comma/ampersand-joined verb labels (e.g. "Acknowledge/Confirm") in `collectQuestions`
- [x] 9 new tests (198 -> 207), tsc/tests/lint all exit 0

---

## Phase 6.1.3 - CDP attach mode
**Status:** done

Allow auto-apply to connect to an existing user-launched Brave instance (with all logins/extensions/cookies) instead of always launching a separate Playwright-controlled Brave.

**Acceptance:**
- [x] `getBrowserMode()` exported from `apply-browser.ts`; returns 'attach' when `PLAYWRIGHT_BROWSER_DEBUG_URL` is set, 'managed' otherwise
- [x] `getSharedContext()` uses `chromium.connectOverCDP(debugUrl)` + `browser.contexts()[0]` in attach mode
- [x] `getSharedContext()` cache check: if `cached.browser()?.isConnected() ?? false` is false, drops cache and relaunches
- [x] `closeSharedContext()` in attach mode calls `ctx.browser()?.close()` (disconnects CDP, does not kill Brave); managed mode unchanged (`ctx.close()`)
- [x] GET `/api/apply/browser-mode` returns `{ mode: 'attach' | 'managed', debugUrl? }`
- [x] `API.browserMode` constant added to `src/lib/constants.ts`
- [x] BoardsPanel header shows "Attached Brave" (green) or "Managed Brave" (dim) badge via the new endpoint
- [x] `.env.local` documents CDP setup with commented-out `PLAYWRIGHT_BROWSER_DEBUG_URL=http://localhost:9222`
- [x] 7 new tests in `src/lib/apply-browser.test.ts` (207 -> 214), tsc/tests/lint all exit 0
- [x] Default behavior unchanged: when env unset, managed mode runs verbatim

---

## QA log

- Phase 6.1.3 completed 2026-05-26T23:00:00Z: CDP attach mode. getBrowserMode() exported (reads PLAYWRIGHT_BROWSER_DEBUG_URL). getSharedContext() refactored: cache check now tests browser().isConnected() ?? false before returning; attach mode calls chromium.connectOverCDP(debugUrl) then takes browser.contexts()[0]; managed mode path verbatim. closeSharedContext() in attach mode calls ctx.browser()?.close() (disconnects CDP session, does not kill Brave); managed mode unchanged. New GET /api/apply/browser-mode returns { mode, debugUrl? }. API.browserMode constant added. BoardsPanel header shows "Attached Brave" (green) or "Managed Brave" (dim) badge. .env.local documents PLAYWRIGHT_BROWSER_DEBUG_URL with commented setup instructions. 7 new tests (207 -> 214). tsc/tests/lint all exit 0.
- Phase 6.1.2 completed 2026-05-26T22:00:00Z: Four QA-driven fixes in greenhouse.ts and default.ts. (1) ACCOUNT_AUTOFILL_RE + tryGreenhouseAccountAutofill detects logged-in candidate-portal button; process() now runs account autofill first, then resume widget, then manual fill; autofillUsed type updated to 'greenhouse_account'|'greenhouse_resume'|'none'. (2) findResumeFileInput: RESUME_SIGNAL_PATTERN broadened to cover upload-your/drag-and-drop/attach etc.; signal gathered from 6 attribute sources + label[for] + closest label + ancestor div/section/fieldset (5 levels) + sibling span/small/p; inputs with data-gh-autofill-marker excluded; best-match by resume/cv count when multiple candidates. (3) fillSelectFuzzy added (exported): exact-label -> exact-value -> decline-fuzzy -> yes/no exact -> substring fuzzy; both select branches in fillByQuestionText now use it. (4) VERB_LABEL_RE (exported) added to collectQuestions to reject verb-only and slash-joined-verb labels like "Acknowledge/Confirm". 9 new tests (198 -> 207). tsc/tests/lint all exit 0.
- Phase 6.1.1 completed 2026-05-26T21:00:00Z: Added tryGreenhouseAutofill to greenhouse.ts -- detects Greenhouse's "Autofill from resume" widget by scanning section/div/fieldset/header/aside elements for text matching 4 prompt patterns, then uploads CV to the widget's file input (not the regular resume field). Manual fill in default.ts now skips inputs and textareas that already have a non-empty value (protects against Greenhouse autofill overwrite and browser pre-fill). autofillUsed field added to DraftProcessResult; executeDraft logs a consolidated summary line including autofill status. Fixture greenhouse-with-autofill.html added. 6 new tests (190 -> 196). tsc/tests/lint all exit 0.
- Phase 5.0 completed 2026-05-26T19:58:00Z: Rewrote priority-boards.ts with 14 Tier-1 EU-native boards (StepStone, Honeypot, NoFluff, Just Join IT, Pracuj, CVbankas, MeetFrank, The Hub, Landing.jobs, WTTJ, SwissDevJobs, WeAreDevelopers, Berlin Startup Jobs, LesJeudis) replacing US-first rotation. Added BoardSource enum + boardSource field to Job type; inferBoardSource helper in canonical-source.ts wired into sanitize-job at intake. Storage POST now surfaces letThroughAsUnknown count. Seeded data/user.example/eu-ats-companies.json with 30 EU-HQ companies. Wiped data/user/jobs.json. Agent prompt updated to lead with Tier-1 priority note. tsc/test (138 tests, 8 files)/lint all exit 0.
- Phase 6.3 completed 2026-05-26T20:19:00Z: Created src/lib/boards/arbeitnow.ts (id="arbeitnow", confidence="experimental") matching arbeitnow.com. resolveApplyUrl fetches the listing page with a browser UA, regex-scans anchors for external Apply Now links, and returns the destination URL (Type A redirect) or the original URL when no external link is found (Type B embedded widget). executeDraft updated: handler re-assigned after resolution so the destination URL gets the right handler (const -> let); failureReason field added to ApplyQueueEntry for isApplicationPage failures. Fixture in src/lib/boards/__fixtures__/arbeitnow-listing.html. dispatcher.test.ts updated (arbeitnow now routes to arbeitnowHandler, not defaultHandler). 15 new tests (arbeitnow.test.ts + updated dispatcher), 175 -> 190 total. tsc/tests/lint all exit 0.
- Phase 6.1 completed 2026-05-26T20:14:00Z: Created src/lib/boards/greenhouse.ts (id="greenhouse", confidence="verified") matching job-boards.greenhouse.io and boards.greenhouse.io. DOM-patch approach marks essay/cover-letter labels with data-greenhouse-essay-skip before delegating to defaultHandler.process(); collectQuestions in default.ts now skips any label whose for-target carries that attribute. Fixture in src/lib/boards/__fixtures__/greenhouse-sample.html (canonical Greenhouse form with EEO block, cover_letter, question_<digits> custom fields). 16 new tests (greenhouse.test.ts + updated dispatcher.test.ts), 159 -> 175 total. tsc/tests/lint all exit 0.
- Phase 6.0 completed 2026-05-26T20:08:00Z: Extracted processing logic from executeDraft into src/lib/boards/default.ts (defaultHandler, id="other", confidence="experimental"). Created BoardHandler interface + DraftProcessResult in src/lib/boards/types.ts. Dispatcher src/lib/boards/index.ts; findHandler(url) returns defaultHandler for all URLs until specific handlers added (6.1+). executeDraft refactored to call findHandler then handler.process(); stores boardSource/boardConfidence on queue entry. BoardConfidence type added to src/shared/types/apply.ts. New GET/POST /api/boards route returns handler registry + job counts + QA log. JobCard shows confidence dot badge + disables AI Apply for broken / shows confirm for experimental. Dashboard Boards panel (boards-panel.tsx) shows registry with Mark verified action. isBlockedInputName re-exported from apply-draft-executor for test compat. tsc/test (159 tests, 10 files)/lint all exit 0.
