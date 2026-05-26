import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { Job } from '@shared/types/job';
import type { ApplyQueueEntry, ApplyStatus, UnansweredQuestion } from '@shared/types/apply';
import { readQueue, writeQueue, upsertEntry } from '@lib/apply-queue';
import { applySessions } from '@lib/apply-sessions';
import { getSharedContext } from '@lib/apply-browser';
import { readBank, matchQuestion, appendQuestionVariant, callMatcherAgent } from '@lib/answer-bank';
import type { AnswerBank } from '@lib/answer-bank';
import type { Page } from 'playwright';
import { readBatch, isActiveBatch, advanceBatch } from '@lib/apply-batch';
import { SCREENSHOTS_DIR, JOBS_PATH } from '@lib/apply-paths';

// Max Haiku agent calls per draft to contain costs on forms with many custom questions.
const AGENT_CALL_LIMIT = 5;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Case-insensitive exact-match sets for non-question text to skip.
const HEADER_CHROME = new Set([
  'search', 'menu', 'close', 'open menu', 'skip to content', 'back to', 'view all',
]);

const BUTTON_TEXT_BLOCKLIST = new Set([
  'acknowledge', 'submit', 'apply', 'reset', 'cancel', 'attach', 'attach a file',
  'enter manually', 'choose file', 'upload', 'download', 'browse', 'click here', 'continue',
]);

function isGarbageText(text: string): boolean {
  if (text.length < 3) return true;
  if (!/[a-zA-Z]/.test(text)) return true;
  if (/^[\d\W_]+$/.test(text)) return true;
  return false;
}

function isBlockedInputName(name: string): boolean {
  if (/^question_\d+/.test(name)) return true;
  if (/^(g-recaptcha-response|csrf|honeypot|_token|__token|RequestVerificationToken)$/i.test(name)) return true;
  if (/^[\d[\]_-]+$/.test(name)) return true;
  return false;
}

async function collectQuestions(page: Page): Promise<string[]> {
  // Walk all <label> elements in the DOM. For each, resolve the associated
  // input element (via 'for' attribute) to determine the input type, then
  // apply skip rules before keeping the label text.
  const labelData = await page.locator('label').evaluateAll((labels) => {
    return labels.map((label) => {
      const text = (label as HTMLElement).innerText.trim();
      const forAttr = label.getAttribute('for');
      let inputType: string | null = null;
      let inputTag: string | null = null;
      if (forAttr) {
        const el = document.getElementById(forAttr);
        if (el) {
          inputTag = el.tagName.toLowerCase();
          if (el instanceof HTMLInputElement) {
            inputType = (el.type || 'text').toLowerCase();
          }
        }
      }
      return { text, inputType, inputTag };
    });
  }).catch(() => [] as Array<{ text: string; inputType: string | null; inputTag: string | null }>);

  // Walk inputs/textareas/selects that lack an explicit <label for="..."> or
  // wrapping <label>. Use aria-label / aria-labelledby / placeholder before
  // falling back to the raw name attribute.
  type UnlabeledInput = {
    name: string;
    type: string;
    ariaLabel: string;
    ariaLabelledByText: string;
    placeholder: string;
    hasLabel: boolean;
  };
  const unlabeledData = await page
    .locator('input[name], textarea[name], select[name]')
    .evaluateAll((els) => {
      return (els as HTMLInputElement[]).map((el) => {
        const name = el.name;
        const type = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : 'textarea';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const ariaLabelledById = el.getAttribute('aria-labelledby') || '';
        let ariaLabelledByText = '';
        if (ariaLabelledById) {
          const ref = document.getElementById(ariaLabelledById);
          if (ref) ariaLabelledByText = (ref as HTMLElement).innerText.trim();
        }
        const placeholder = el.getAttribute('placeholder') || '';

        // Determine if this input is associated with a label
        const id = el.id;
        let hasLabel = el.closest('label') !== null;
        if (!hasLabel && id) {
          hasLabel = Array.from(document.querySelectorAll('label[for]')).some(
            (l) => l.getAttribute('for') === id,
          );
        }

        return { name, type, ariaLabel, ariaLabelledByText, placeholder, hasLabel };
      });
    })
    .catch(() => [] as UnlabeledInput[]);

  const seen = new Set<string>();
  const questions: string[] = [];

  function addIfNew(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);
    questions.push(trimmed);
  }

  // Process labels
  for (const { text, inputType, inputTag } of labelData) {
    if (!text) continue;
    if (isGarbageText(text)) continue;
    const lower = text.toLowerCase().trim();
    if (HEADER_CHROME.has(lower)) continue;
    if (BUTTON_TEXT_BLOCKLIST.has(lower)) continue;
    // Skip labels whose associated element is a file/hidden/button-type input
    if (inputTag === 'button') continue;
    if (inputType === 'file') continue;
    if (inputType === 'hidden') continue;
    if (inputType === 'submit' || inputType === 'button' || inputType === 'reset') continue;
    addIfNew(text);
  }

  // Process unlabeled inputs
  for (const { name, type, ariaLabel, ariaLabelledByText, placeholder, hasLabel } of unlabeledData) {
    if (hasLabel) continue;
    if (type === 'file' || type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') continue;

    // Prefer semantic label text over raw name
    const semanticLabel = ariaLabel || ariaLabelledByText || placeholder;
    if (semanticLabel) {
      const lower = semanticLabel.toLowerCase().trim();
      if (!isGarbageText(semanticLabel) && !HEADER_CHROME.has(lower) && !BUTTON_TEXT_BLOCKLIST.has(lower)) {
        addIfNew(semanticLabel);
        continue;
      }
    }

    // Fall back to name attribute with system-pattern filtering
    if (!name) continue;
    if (isGarbageText(name)) continue;
    if (isBlockedInputName(name)) continue;
    const lower = name.toLowerCase().trim();
    if (HEADER_CHROME.has(lower) || BUTTON_TEXT_BLOCKLIST.has(lower)) continue;
    addIfNew(name);
  }

  return questions;
}

function buildBankKeyDescriptions(bank: AnswerBank) {
  return Object.entries(bank.fields).map(([key, field]) => ({
    key,
    description: `${field.type}: ${field.value ? field.value.slice(0, 60) : '(not set)'}`,
  }));
}

// Mark any 'processing' entries without an active browser session as 'failed'.
// Also advances the batch past any failed entries that belonged to it.
// Called at the start of executeDraft and batch/start to recover from server restarts.
export async function recoverStuckEntries(): Promise<string[]> {
  const queue = await readQueue();
  const recovered: string[] = [];
  for (const entry of queue) {
    if (entry.status === 'processing' && !applySessions.has(entry.sessionId)) {
      entry.status = 'failed';
      recovered.push(entry.draftId);
    }
  }
  if (recovered.length > 0) {
    await writeQueue(queue);
    console.log('[apply/executor] recovered stuck entries:', recovered);
  }
  return recovered;
}

// Fire-and-forget: advance the batch and dispatch the next draft.
// Runs in setImmediate so the calling executeDraft can return/resolve first.
function scheduleAdvance(batchId?: string): void {
  if (!batchId) return;
  setImmediate(() => {
    advanceAndDispatch(batchId).catch((err) => {
      console.error('[apply/batch] advance failed:', err);
    });
  });
}

async function advanceAndDispatch(batchId: string): Promise<void> {
  const batch = await readBatch();
  if (!batch || batch.status !== 'active' || batch.batchId !== batchId) return;
  const nextJobId = await advanceBatch();
  if (!nextJobId) return;
  await executeDraft(nextJobId, batchId);
}

// Core draft logic. Called by the draft route POST handler (no batchId) and
// by the batch advance mechanism (with batchId). Both paths are equivalent
// except the batch path checks for cancellation and triggers advance on exit.
export async function executeDraft(
  jobId: string,
  batchId?: string,
): Promise<{ draftId: string; status: ApplyStatus }> {
  // Bail early if the batch was cancelled while we were queued
  if (batchId) {
    const batch = await readBatch();
    if (!isActiveBatch(batch) || batch.batchId !== batchId) {
      console.log(`[apply/executor] batch ${batchId} not active, skipping draft for ${jobId}`);
      return { draftId: '', status: 'cancelled' };
    }
  }

  // Recover any stuck 'processing' entries from a prior server run
  await recoverStuckEntries();

  // Only 'processing' blocks. awaiting_answers + pending_review can coexist freely.
  const queue = await readQueue();
  const blocking = queue.find((e) => e.status === 'processing');
  if (blocking) {
    throw new Error(
      `Already processing: draftId ${blocking.draftId} for "${blocking.jobTitle}"`,
    );
  }

  let jobs: Job[];
  try {
    jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf-8')) as Job[];
  } catch {
    throw new Error('Could not read jobs.json');
  }
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const bank = await readBank();
  const draftId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Write 'processing' entry immediately — this is the lock signal.
  const entry: ApplyQueueEntry = {
    draftId,
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    applyUrl: job.url,
    status: 'processing',
    screenshotPath: '',
    createdAt: new Date().toISOString(),
    sessionId,
    processingStartedAt: new Date().toISOString(),
    ...(batchId && { batchId }),
  };
  await upsertEntry(entry);

  let page;
  try {
    const context = await getSharedContext();
    page = await context.newPage();

    // Register the session early so batch cancel can close it mid-fill
    applySessions.set(sessionId, { page, submitStrategy: null });

    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(2000);

    // ── Match and fill form fields ─────────────────────────────────────────
    const questions = await collectQuestions(page);
    const unansweredQuestions: UnansweredQuestion[] = [];
    let agentCallsUsed = 0;
    let codeFilled = 0;
    let agentFilled = 0;
    const bankKeyDescs = buildBankKeyDescriptions(bank);

    console.log(`[apply/executor] ${job.title}: found ${questions.length} question signals`);

    for (const questionText of questions) {
      const match = matchQuestion(questionText, bank);

      // Fast path: confident code match — fill without agent call
      if (match && match.confidence >= 0.9) {
        const fieldValue = bank.fields[match.key]?.value ?? '';
        if (fieldValue) {
          await fillByQuestionText(page, questionText, fieldValue);
          appendQuestionVariant(match.key, questionText).catch(() => {});
          codeFilled++;
        } else {
          unansweredQuestions.push({ questionText, suggestedKey: match.key });
        }
        continue;
      }

      // Slow path: no confident match — ask Haiku before giving up
      if (agentCallsUsed >= AGENT_CALL_LIMIT) {
        unansweredQuestions.push({ questionText, suggestedKey: match?.key });
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
            agentFilled++;
          } else {
            unansweredQuestions.push({ questionText, suggestedKey: agentResult.key });
          }
        }
      } catch (agentErr) {
        console.warn(`[apply/executor] agent call failed for "${questionText}":`, agentErr);
        unansweredQuestions.push({ questionText, suggestedKey: match?.key });
      }
    }

    console.log(
      `[apply/draft] code-filled: ${codeFilled}, agent-filled: ${agentFilled}, unanswered: ${unansweredQuestions.length}, agent-calls-used: ${agentCallsUsed}/${AGENT_CALL_LIMIT}`,
    );

    // ── Find and highlight submit button ───────────────────────────────────
    const submitStrategy = await findSubmitStrategy(page);
    if (submitStrategy) {
      if (submitStrategy.startsWith('css:')) {
        await page.locator(submitStrategy.slice(4)).first().evaluate((el) => {
          (el as HTMLElement).style.outline = '3px solid red';
          (el as HTMLElement).style.boxShadow = '0 0 10px red';
          (el as HTMLElement).style.outlineOffset = '2px';
        }).catch(() => {});
        await page.locator(submitStrategy.slice(4)).first().scrollIntoViewIfNeeded().catch(() => {});
      } else if (submitStrategy.startsWith('text:')) {
        const btn = page.getByRole('button', { name: submitStrategy.slice(5), exact: false }).first();
        await btn.evaluate((el) => {
          (el as HTMLElement).style.outline = '3px solid red';
          (el as HTMLElement).style.boxShadow = '0 0 10px red';
          (el as HTMLElement).style.outlineOffset = '2px';
        }).catch(() => {});
        await btn.scrollIntoViewIfNeeded().catch(() => {});
      }
      const sess = applySessions.get(sessionId);
      if (sess) sess.submitStrategy = submitStrategy;
    }

    // ── Screenshot ─────────────────────────────────────────────────────────
    const screenshotFile = `${draftId}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFile);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // ── Transition out of 'processing' ────────────────────────────────────
    const status: ApplyStatus = unansweredQuestions.length > 0 ? 'awaiting_answers' : 'pending_review';
    entry.status = status;
    entry.screenshotPath = `data/user/apply-screenshots/${screenshotFile}`;
    if (unansweredQuestions.length > 0) entry.unansweredQuestions = unansweredQuestions;
    await upsertEntry(entry);

    // Advance batch now that we've left 'processing' — response returns to caller first
    scheduleAdvance(batchId);

    return { draftId, status };
  } catch (e) {
    // Close only this tab; the shared context stays alive for other drafts
    const sess = applySessions.get(sessionId);
    if (sess) await sess.page.close().catch(() => {});
    applySessions.delete(sessionId);
    entry.status = 'failed';
    await upsertEntry(entry);
    // Advance batch past this failed job
    scheduleAdvance(batchId);
    throw e;
  }
}
