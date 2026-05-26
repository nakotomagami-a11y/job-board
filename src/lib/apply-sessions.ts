import type { Page } from 'playwright';

export interface ApplySession {
  page: Page;
  // The selector/strategy string that found the submit button during draft.
  // Format: 'css:<selector>' | 'text:<button label>'
  submitStrategy: string | null;
}

// Survives hot module replacement in Next.js dev via globalThis.
declare global {
  var __applySessionMap: Map<string, ApplySession> | undefined;
  var __chromiumReady: boolean | undefined;
}

if (!globalThis.__applySessionMap) {
  globalThis.__applySessionMap = new Map<string, ApplySession>();
}

export const applySessions: Map<string, ApplySession> = globalThis.__applySessionMap!;

// Lazy-initialises playwright-extra + stealth exactly once per process.
export async function getStealthChromium() {
  const { chromium } = await import('playwright-extra');
  if (!globalThis.__chromiumReady) {
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(StealthPlugin());
    globalThis.__chromiumReady = true;
  }
  return chromium;
}
