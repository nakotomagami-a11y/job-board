import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { Job } from '@shared/types/job';
import type { ApplyQueueEntry, UnansweredQuestion } from '@shared/types/apply';
import { readQueue, upsertEntry } from '@lib/apply-queue';
import { applySessions, getStealthChromium } from '@lib/apply-sessions';
import { readBank, matchQuestion, appendQuestionVariant, callMatcherAgent } from '@lib/answer-bank';
import type { AnswerBank } from '@lib/answer-bank';
import type { Page } from 'playwright';

// phase 2: parallel applies, LinkedIn Easy Apply modal handling

export const maxDuration = 120;

const JOBS_PATH = path.join(process.cwd(), 'data', 'user', 'jobs.json');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'data', 'user', 'apply-screenshots');
const BROWSER_PROFILE_DIR = path.join(process.cwd(), 'data', 'user', 'browser-profile');

// Max Haiku agent calls per draft to contain costs on forms with many custom questions.
const AGENT_CALL_LIMIT = 5;

interface DraftRequest {
  jobId: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns the first working submit strategy string, or null.
async function findSubmitStrategy(page: Page): Promise<string | null> {
  for (const sel of ['button[type="submit"]', 'input[type="submit"]']) {
    if ((await page.locator(sel).count()) > 0) return `css:${sel}`;
  }
  const textCandidates = [
    'Submit application', 'Submit Application', 'Submit my application',
    'Apply now', 'Apply Now', 'Apply',
    'Send application', 'Send Application',
    'Submit',
  ];
  for (const text of textCandidates) {
    const loc = page.getByRole('button', { name: text, exact: false });
    if ((await loc.count()) > 0) return `text:${text}`;
  }
  return null;
}

async function resolveSubmitLocator(page: Page, strategy: string) {
  if (strategy.startsWith('css:')) return page.locator(strategy.slice(4)).first();
  if (strategy.startsWith('text:')) {
    return page.getByRole('button', { name: strategy.slice(5), exact: false }).first();
  }
  return page.locator(strategy).first();
}

// Tries to fill a form field identified by its visible label text, placeholder, or name attribute.
// Returns true if a field was found and filled.
async function fillByQuestionText(page: Page, questionText: string, value: string): Promise<boolean> {
  if (!value) return false;

  // Label-based (most reliable: uses the <label> → input association)
  try {
    const loc = page.getByLabel(new RegExp(escapeRegex(questionText), 'i')).first();
    if ((await loc.count()) > 0) {
      const tag = await loc.evaluate((el) => el.tagName.toLowerCase());
      if (tag === 'select') {
        await loc.selectOption({ label: value }).catch(() => {});
      } else {
        await loc.fill(value);
      }
      return true;
    }
  } catch { /* non-fatal */ }

  // Placeholder-based
  const escapedQ = questionText.replace(/"/g, '\\"');
  try {
    const loc = page.locator(`input[placeholder*="${escapedQ}" i], textarea[placeholder*="${escapedQ}" i]`).first();
    if ((await loc.count()) > 0) {
      await loc.fill(value);
      return true;
    }
  } catch { /* non-fatal */ }

  // Name attribute (exact, since names are usually internal keys not display text)
  try {
    const loc = page.locator(`input[name="${escapedQ}"], textarea[name="${escapedQ}"], select[name="${escapedQ}"]`).first();
    if ((await loc.count()) > 0) {
      const tag = await loc.evaluate((el) => el.tagName.toLowerCase());
      if (tag === 'select') {
        await loc.selectOption({ label: value }).catch(() => {});
      } else {
        await loc.fill(value);
      }
      return true;
    }
  } catch { /* non-fatal */ }

  return false;
}

// Collects all visible question signals from the page (labels, input names, placeholders).
// Deduplicates by normalized text so the same question isn't processed twice.
async function collectQuestions(page: Page): Promise<string[]> {
  const labelTexts = await page.locator('label').allInnerTexts().catch(() => [] as string[]);
  const inputNames = await page
    .locator('input[name], textarea[name], select[name]')
    .evaluateAll((els) => (els as HTMLInputElement[]).map((el) => el.name).filter(Boolean))
    .catch(() => [] as string[]);
  const placeholders = await page
    .locator('[placeholder]')
    .evaluateAll((els) => (els as HTMLInputElement[]).map((el) => el.placeholder).filter(Boolean))
    .catch(() => [] as string[]);

  const seen = new Set<string>();
  const questions: string[] = [];
  for (const q of [...labelTexts, ...inputNames, ...placeholders]) {
    const trimmed = q.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      questions.push(trimmed);
    }
  }
  return questions;
}

function buildBankKeyDescriptions(bank: AnswerBank) {
  return Object.entries(bank.fields).map(([key, field]) => ({
    key,
    description: `${field.type}: ${field.value ? field.value.slice(0, 60) : '(not set)'}`,
  }));
}

export async function POST(req: Request) {
  let body: DraftRequest;
  try {
    body = (await req.json()) as DraftRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.jobId) return NextResponse.json({ error: "Missing 'jobId'" }, { status: 400 });

  // Sequential-only: block if any active draft is already open.
  const queue = await readQueue();
  const activeStatuses: string[] = ['pending_review', 'awaiting_answers'];
  const blocking = queue.find((e) => activeStatuses.includes(e.status));
  if (blocking) {
    return NextResponse.json(
      { error: `Already active: draftId ${blocking.draftId} for "${blocking.jobTitle}" (${blocking.status})` },
      { status: 409 },
    );
  }

  let jobs: Job[];
  try {
    jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf-8')) as Job[];
  } catch {
    return NextResponse.json({ error: 'Could not read jobs.json' }, { status: 500 });
  }
  const job = jobs.find((j) => j.id === body.jobId);
  if (!job) return NextResponse.json({ error: `Job not found: ${body.jobId}` }, { status: 404 });

  const bank = await readBank();

  const draftId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  await fs.mkdir(BROWSER_PROFILE_DIR, { recursive: true });

  let chromium;
  try {
    chromium = await getStealthChromium();
  } catch (e) {
    return NextResponse.json(
      { error: `playwright-extra unavailable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
      headless: false,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to launch browser: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const page = await context.newPage();

  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(2000);

    // ── Match and fill form fields ─────────────────────────────────────────
    const questions = await collectQuestions(page);
    const unansweredQuestions: UnansweredQuestion[] = [];
    let agentCallsUsed = 0;
    const bankKeyDescs = buildBankKeyDescriptions(bank);

    console.log(`[apply/draft] found ${questions.length} question signals on page`);

    for (const questionText of questions) {
      const match = matchQuestion(questionText, bank);

      if (!match) {
        // No code-level match at all — goes directly to awaiting_answers.
        unansweredQuestions.push({ questionText });
        continue;
      }

      const fieldValue = bank.fields[match.key]?.value ?? '';

      if (match.confidence >= 0.9) {
        // High confidence: fill directly without agent.
        if (fieldValue) {
          await fillByQuestionText(page, questionText, fieldValue);
          // Non-blocking: record this question text as a learned variant.
          appendQuestionVariant(match.key, questionText).catch(() => {});
        } else {
          // Known key but user hasn't set a value yet.
          unansweredQuestions.push({ questionText, suggestedKey: match.key });
        }
        continue;
      }

      // Medium confidence (0.5–0.9 range from fuzzy): call Haiku agent if quota allows.
      if (agentCallsUsed >= AGENT_CALL_LIMIT) {
        unansweredQuestions.push({ questionText, suggestedKey: match.key });
        continue;
      }

      try {
        agentCallsUsed++;
        const agentResult = await callMatcherAgent({
          questionText,
          bankKeys: bankKeyDescs,
          contextSnippet: '',
        });

        if ('novel' in agentResult && agentResult.novel) {
          unansweredQuestions.push({
            questionText,
            suggestedKey: agentResult.suggestedKey,
            suggestedType: agentResult.suggestedType,
          });
        } else if ('key' in agentResult) {
          const confirmedValue = bank.fields[agentResult.key]?.value ?? '';
          if (agentResult.confidence >= 0.9 && confirmedValue) {
            await fillByQuestionText(page, questionText, confirmedValue);
            appendQuestionVariant(agentResult.key, questionText).catch(() => {});
          } else {
            unansweredQuestions.push({
              questionText,
              suggestedKey: agentResult.key,
            });
          }
        }
      } catch (agentErr) {
        console.warn(`[apply/draft] agent call failed for "${questionText}":`, agentErr);
        unansweredQuestions.push({ questionText, suggestedKey: match.key });
      }
    }

    console.log(
      `[apply/draft] filled ${questions.length - unansweredQuestions.length}/${questions.length} fields; ${unansweredQuestions.length} unanswered`,
    );

    // ── Find and highlight the submit button ───────────────────────────────
    const submitStrategy = await findSubmitStrategy(page);
    if (submitStrategy) {
      const submitEl = await resolveSubmitLocator(page, submitStrategy);
      await submitEl.evaluate((el) => {
        (el as HTMLElement).style.outline = '3px solid red';
        (el as HTMLElement).style.boxShadow = '0 0 10px red';
        (el as HTMLElement).style.outlineOffset = '2px';
      }).catch(() => {});
      await submitEl.scrollIntoViewIfNeeded().catch(() => {});
    }

    // ── Screenshot ─────────────────────────────────────────────────────────
    const screenshotFile = `${draftId}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFile);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // ── Persist session and queue entry ────────────────────────────────────
    applySessions.set(sessionId, { context, page, submitStrategy });

    const status = unansweredQuestions.length > 0 ? 'awaiting_answers' : 'pending_review';
    const entry: ApplyQueueEntry = {
      draftId,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      applyUrl: job.url,
      status,
      screenshotPath: `data/user/apply-screenshots/${screenshotFile}`,
      createdAt: new Date().toISOString(),
      sessionId,
      ...(unansweredQuestions.length > 0 && { unansweredQuestions }),
    };
    await upsertEntry(entry);

    return NextResponse.json({ draftId, screenshotPath: entry.screenshotPath, status });
  } catch (e) {
    await context.close().catch(() => {});
    applySessions.delete(sessionId);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
