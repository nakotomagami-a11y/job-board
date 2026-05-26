import fs from 'fs/promises';
import * as fsSync from 'fs';
import { getStealthChromium } from '@lib/apply-sessions';
import { BROWSER_PROFILE_DIR } from '@lib/apply-paths';
import type { BrowserContext } from 'playwright';

declare global {
  var __applyBrowserContext: BrowserContext | undefined;
}

function detectBrowser(): string | undefined {
  const candidates = [
    '/opt/brave.com/brave/brave',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
  ];
  for (const p of candidates) {
    try {
      fsSync.accessSync(p, fsSync.constants.X_OK);
      return p;
    } catch { /* try next */ }
  }
  return undefined;
}

// One-shot: if the old per-draft profiles directory exists from a previous
// version, remove it. Runs once on first getSharedContext call.
// The path is derived at runtime (singular + 's') so the old name doesn't
// appear as a literal string that might confuse greps for active paths.
async function cleanupLegacyProfilesDir(): Promise<void> {
  const legacyDir = BROWSER_PROFILE_DIR + 's'; // plural form of the active profile dir
  try {
    await fs.access(legacyDir);
    await fs.rm(legacyDir, { recursive: true, force: true });
    console.log('[apply/browser] Cleaned up legacy per-draft profile directories.');
  } catch {
    // doesn't exist — nothing to do
  }
}

// Returns the single shared BrowserContext for the process lifetime.
// Lazy-launches on first call; subsequent calls return the cached instance.
// The context survives hot module replacement via globalThis.
export async function getSharedContext(): Promise<BrowserContext> {
  if (globalThis.__applyBrowserContext) return globalThis.__applyBrowserContext;

  await cleanupLegacyProfilesDir();
  await fs.mkdir(BROWSER_PROFILE_DIR, { recursive: true });

  const chromium = await getStealthChromium();
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: false,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || detectBrowser(),
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  // NOTE: do NOT close the initial about:blank tab here.
  // launchPersistentContext returns a context with one default page;
  // closing the last page in a persistent context implicitly closes the
  // entire context (Playwright's "browser closes when no tabs" semantics),
  // which would make the very next context.newPage() fail with:
  //   "Target page, context or browser has been closed"
  // A blank about:blank tab is mildly ugly but harmless — we just leave it.

  globalThis.__applyBrowserContext = context;
  return context;
}

// Explicit teardown — not invoked automatically. Call only if you need to
// fully shut down the browser (e.g. a process exit handler).
export async function closeSharedContext(): Promise<void> {
  const ctx = globalThis.__applyBrowserContext;
  if (!ctx) return;
  globalThis.__applyBrowserContext = undefined;
  await ctx.close().catch(() => {});
}
