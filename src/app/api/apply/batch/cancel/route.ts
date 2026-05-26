import { NextResponse } from 'next/server';
import { readBatch, writeBatch, isActiveBatch } from '@lib/apply-batch';
import { readQueue, writeQueue } from '@lib/apply-queue';
import { applySessions } from '@lib/apply-sessions';

export const maxDuration = 30;

const CANCELLABLE = new Set(['processing', 'awaiting_answers', 'pending_review']);

export async function POST() {
  const batch = await readBatch();
  if (!batch || !isActiveBatch(batch)) {
    return NextResponse.json({ error: 'No active batch to cancel' }, { status: 409 });
  }

  // Mark batch cancelled first so any in-flight executeDraft calls bail out
  batch.status = 'cancelled';
  batch.completedAt = new Date().toISOString();
  await writeBatch(batch);

  // Close browser tabs and cancel queue entries that belong to this batch.
  // The shared BrowserContext stays alive — only individual pages are closed.
  const queue = await readQueue();
  let cancelledCount = 0;

  for (const entry of queue) {
    if (entry.batchId !== batch.batchId) continue;
    if (!CANCELLABLE.has(entry.status)) continue;

    const session = applySessions.get(entry.sessionId);
    if (session) {
      await session.page.close().catch(() => {});
      applySessions.delete(entry.sessionId);
    }

    entry.status = 'cancelled';
    cancelledCount++;
  }

  await writeQueue(queue);

  return NextResponse.json({
    batchId: batch.batchId,
    status: 'cancelled',
    cancelledCount,
  });
}
