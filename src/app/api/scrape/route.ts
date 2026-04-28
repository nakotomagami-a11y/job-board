import { NextResponse } from "next/server";
import { rateLimit } from "@lib/rate-limit";

// Headless rendering for JS-heavy boards (Himalayas, Wellfound, startup.jobs,
// Working Nomads, YC Work at a Startup). Replaces the Browser MCP fallback in
// COMMANDS.md with an in-process Playwright session — deterministic, no Chrome
// app required, no MCP coupling.
//
// Playwright is lazy-imported because (a) Chromium isn't bundled by default
// (run `npx playwright install chromium` once before using this route) and
// (b) we don't want a missing system dep to crash the whole Next.js server.

export const maxDuration = 60;

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 2_000_000; // 2 MB — anything larger is almost certainly noise.

interface ScrapeRequest {
  url: string;
  /** "load" | "domcontentloaded" | "networkidle" — defaults to "networkidle". */
  waitFor?: "load" | "domcontentloaded" | "networkidle";
  /** Optional CSS selector to wait for before extracting (e.g. ".job-card"). */
  waitForSelector?: string;
  /** If set, return only matched element textContent instead of full HTML. */
  extractSelector?: string;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, { bucket: "scrape", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: ScrapeRequest;
  try { body = (await req.json()) as ScrapeRequest; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!body.url) return NextResponse.json({ error: "Missing 'url'" }, { status: 400 });

  // Reject anything that isn't an http(s) URL — no file:// or chrome-extension://
  // tricks against the local server.
  let target: URL;
  try { target = new URL(body.url); }
  catch { return NextResponse.json({ error: "Malformed url" }, { status: 400 }); }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) urls are allowed" }, { status: 400 });
  }

  // Lazy-import: a missing Playwright install shouldn't crash the dev server.
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    return NextResponse.json(
      { error: `Playwright is not installed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) JobHunt/1.0 Playwright",
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    await page.goto(target.toString(), {
      waitUntil: body.waitFor ?? "networkidle",
      timeout: DEFAULT_TIMEOUT_MS,
    });

    if (body.waitForSelector) {
      await page.waitForSelector(body.waitForSelector, { timeout: DEFAULT_TIMEOUT_MS }).catch(() => {});
    }

    let payload: { url: string; html?: string; text?: string; truncated?: boolean };
    if (body.extractSelector) {
      const text = await page.$$eval(body.extractSelector, (els) =>
        els.map((el) => (el as HTMLElement).innerText).join("\n\n"),
      );
      payload = { url: page.url(), text };
    } else {
      const html = await page.content();
      const truncated = html.length > MAX_HTML_BYTES;
      payload = {
        url: page.url(),
        html: truncated ? html.slice(0, MAX_HTML_BYTES) : html,
        truncated,
      };
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
