import { NextResponse } from 'next/server';
import path from 'path';
import { readQueue, upsertEntry } from '@lib/apply-queue';
import { applySessions } from '@lib/apply-sessions';
import type { Page } from 'playwright';

// This is the ONLY place in the codebase that may click the submit button.
// Defense layer (a): submit-click code lives only here.
// Defense layer (b): refuses to submit unless queue entry shows 'pending_review'.

export const maxDuration = 60;

const SCREENSHOTS_DIR = path.join(process.cwd(), 'data', 'user', 'apply-screenshots');

interface ConfirmRequest {
  draftId: string;
  action: 'submit' | 'cancel';
}

async function resolveSubmitLocator(page: Page, strategy: string) {
  if (strategy.startsWith('css:')) return page.locator(strategy.slice(4)).first();
  if (strategy.startsWith('text:')) {
    return page.getByRole('button', { name: strategy.slice(5), exact: false }).first();
  }
  return page.locator(strategy).first();
}

async function closeAndCleanup(sessionId: string): Promise<void> {
  const session = applySessions.get(sessionId);
  if (session) {
    await session.page.close().catch(() => {});
    applySessions.delete(sessionId);
  }
}

export async function POST(req: Request) {
  let body: ConfirmRequest;
  try {
    body = (await req.json()) as ConfirmRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { draftId, action } = body;
  if (!draftId || !action) {
    return NextResponse.json({ error: "Missing 'draftId' or 'action'" }, { status: 400 });
  }
  if (action !== 'submit' && action !== 'cancel') {
    return NextResponse.json({ error: "action must be 'submit' or 'cancel'" }, { status: 400 });
  }

  const queue = await readQueue();
  const entry = queue.find((e) => e.draftId === draftId);
  if (!entry) {
    return NextResponse.json({ error: `No queue entry found for draftId: ${draftId}` }, { status: 404 });
  }

  if (action === 'cancel') {
    // Allow cancel for both awaiting_answers and pending_review
    if (entry.status !== 'pending_review' && entry.status !== 'awaiting_answers') {
      return NextResponse.json(
        { error: `Refused: entry status is '${entry.status}', expected 'pending_review' or 'awaiting_answers'` },
        { status: 409 },
      );
    }
    await closeAndCleanup(entry.sessionId);
    entry.status = 'cancelled';
    await upsertEntry(entry);
    return NextResponse.json({ draftId, status: 'cancelled', screenshotPath: entry.screenshotPath });
  }

  // action === 'submit'
  // Defense layer (b): the queue entry MUST be pending_review.
  if (entry.status !== 'pending_review') {
    return NextResponse.json(
      { error: `Refused: entry status is '${entry.status}', expected 'pending_review'` },
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

  const { page, submitStrategy } = session;

  try {
    if (!submitStrategy) {
      throw new Error('No submit button was found during draft — cannot submit');
    }

    const submitEl = await resolveSubmitLocator(page, submitStrategy);

    // Click and wait for navigation or a 5-second timeout — whichever comes first.
    await Promise.all([
      page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
      submitEl.click(),
    ]);

    await page.waitForTimeout(1500);

    const postFile = `${draftId}-submitted.png`;
    const postPath = path.join(SCREENSHOTS_DIR, postFile);
    await page.screenshot({ path: postPath, fullPage: false });

    entry.status = 'submitted';
    entry.submittedAt = new Date().toISOString();
    entry.postSubmitScreenshotPath = `data/user/apply-screenshots/${postFile}`;
    await upsertEntry(entry);

    return NextResponse.json({
      draftId,
      status: 'submitted',
      screenshotPath: entry.postSubmitScreenshotPath,
    });
  } catch (e) {
    entry.status = 'failed';
    await upsertEntry(entry);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  } finally {
    await page.close().catch(() => {});
    applySessions.delete(entry.sessionId);
  }
}
