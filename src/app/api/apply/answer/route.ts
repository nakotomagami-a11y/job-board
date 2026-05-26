import { NextResponse } from 'next/server';
import path from 'path';
import type { Page } from 'playwright';
import { readQueue, upsertEntry } from '@lib/apply-queue';
import { applySessions } from '@lib/apply-sessions';
import { addNewField, appendQuestionVariant } from '@lib/answer-bank';
import type { FieldType } from '@lib/answer-bank';

export const maxDuration = 60;

const SCREENSHOTS_DIR = path.join(process.cwd(), 'data', 'user', 'apply-screenshots');

interface AnswerItem {
  questionText: string;
  suggestedKey?: string;
  value: string;
  type?: FieldType;
  saveToBank: boolean;
}

interface AnswerRequest {
  draftId: string;
  answers: AnswerItem[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fillByQuestionText(page: Page, questionText: string, value: string): Promise<boolean> {
  if (!value) return false;

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

  const escapedQ = questionText.replace(/"/g, '\\"');
  try {
    const loc = page.locator(`input[placeholder*="${escapedQ}" i], textarea[placeholder*="${escapedQ}" i]`).first();
    if ((await loc.count()) > 0) {
      await loc.fill(value);
      return true;
    }
  } catch { /* non-fatal */ }

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

export async function POST(req: Request) {
  let body: AnswerRequest;
  try {
    body = (await req.json()) as AnswerRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { draftId, answers } = body;
  if (!draftId || !Array.isArray(answers)) {
    return NextResponse.json({ error: "Missing 'draftId' or 'answers'" }, { status: 400 });
  }

  const queue = await readQueue();
  const entry = queue.find((e) => e.draftId === draftId);
  if (!entry) {
    return NextResponse.json({ error: `No queue entry for draftId: ${draftId}` }, { status: 404 });
  }
  if (entry.status !== 'awaiting_answers') {
    return NextResponse.json(
      { error: `Refused: entry status is '${entry.status}', expected 'awaiting_answers'` },
      { status: 409 },
    );
  }

  const session = applySessions.get(entry.sessionId);
  if (!session) {
    entry.status = 'failed';
    await upsertEntry(entry);
    return NextResponse.json(
      { error: 'Browser session no longer active. The draft was lost; cancel and start a new draft.' },
      { status: 410 },
    );
  }

  const { page } = session;
  const fillResults: { questionText: string; filled: boolean }[] = [];

  // Persist answers to bank and fill the live form.
  for (const ans of answers) {
    if (ans.saveToBank && ans.suggestedKey) {
      // If the key already exists in the bank, append the question as a variant.
      // If it's novel, create a new field. addNewField handles both cases.
      await addNewField(
        ans.suggestedKey,
        ans.value,
        ans.type ?? 'shortText',
        ans.questionText,
      );
    } else if (ans.saveToBank && !ans.suggestedKey) {
      // User provided a value but no key — skip bank write (edge case).
    } else if (!ans.saveToBank && ans.suggestedKey) {
      // appendQuestionVariant for existing keys even when not saving a new value,
      // so future matching improves.
      appendQuestionVariant(ans.suggestedKey, ans.questionText).catch(() => {});
    }

    const filled = await fillByQuestionText(page, ans.questionText, ans.value);
    fillResults.push({ questionText: ans.questionText, filled });
  }

  console.log('[apply/answer] fill results:', JSON.stringify(fillResults));

  // Re-detect submit button and re-highlight (position may have shifted after filling).
  const newStrategy = await findSubmitStrategy(page);
  if (newStrategy) {
    const submitEl = await resolveSubmitLocator(page, newStrategy);
    await submitEl.evaluate((el) => {
      (el as HTMLElement).style.outline = '3px solid red';
      (el as HTMLElement).style.boxShadow = '0 0 10px red';
      (el as HTMLElement).style.outlineOffset = '2px';
    }).catch(() => {});
    await submitEl.scrollIntoViewIfNeeded().catch(() => {});
  }
  session.submitStrategy = newStrategy;

  // Updated screenshot after fills.
  const screenshotFile = `${draftId}.png`;
  const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFile);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Compute remaining unanswered questions (those not addressed in this call).
  const answeredTexts = new Set(answers.map((a) => a.questionText.toLowerCase().trim()));
  const remaining = (entry.unansweredQuestions ?? []).filter(
    (q) => !answeredTexts.has(q.questionText.toLowerCase().trim()),
  );

  entry.status = remaining.length > 0 ? 'awaiting_answers' : 'pending_review';
  entry.screenshotPath = `data/user/apply-screenshots/${screenshotFile}`;
  entry.unansweredQuestions = remaining.length > 0 ? remaining : undefined;
  await upsertEntry(entry);

  return NextResponse.json({
    draftId,
    status: entry.status,
    screenshotPath: entry.screenshotPath,
    remainingUnanswered: remaining,
  });
}
