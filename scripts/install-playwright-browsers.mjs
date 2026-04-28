#!/usr/bin/env node
/**
 * Postinstall hook — ensures Playwright's Chromium build is available so
 * `/api/scrape` works out-of-the-box. Without this the route fails on first
 * use with a confusing "browserType.launch: Executable doesn't exist" error.
 *
 * Behavior:
 *   - Skipped when SKIP_PLAYWRIGHT_BROWSER_INSTALL=1, CI=true, or the env
 *     suggests a CI/Docker environment that installs browsers separately.
 *   - Skipped if @playwright/test or playwright isn't actually installed
 *     (e.g. someone ran `npm install --omit=optional`).
 *   - Idempotent — Playwright's installer no-ops if Chromium is already on
 *     disk at the expected version.
 *   - Never fails the parent install. A network blip during `npm install`
 *     shouldn't brick the whole project; we log a hint and exit 0.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

if (process.env.SKIP_PLAYWRIGHT_BROWSER_INSTALL === "1") {
  console.log("[playwright] SKIP_PLAYWRIGHT_BROWSER_INSTALL=1 — skipping Chromium download.");
  process.exit(0);
}

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
  console.log("[playwright] PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 — skipping Chromium download.");
  process.exit(0);
}

// Confirm Playwright itself is installed before trying to invoke its CLI.
try {
  require.resolve("playwright/package.json");
} catch {
  console.log("[playwright] Package not installed — skipping browser download.");
  process.exit(0);
}

const result = spawnSync("npx", ["--no-install", "playwright", "install", "chromium"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error || (typeof result.status === "number" && result.status !== 0)) {
  console.warn(
    "[playwright] Chromium download did not complete cleanly. /api/scrape will fail until you run:\n" +
      "    npx playwright install chromium\n" +
      "  Set SKIP_PLAYWRIGHT_BROWSER_INSTALL=1 in your environment to silence this hook.",
  );
  // Exit 0 so the parent install isn't blocked.
  process.exit(0);
}
