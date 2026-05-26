import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { Job } from '@shared/types/job';
import { readQueue } from '@lib/apply-queue';
import { readBatch, writeBatch, isActiveBatch } from '@lib/apply-batch';
import { executeDraft, recoverStuckEntries } from '@lib/apply-draft-executor';
import { JOBS_PATH } from '@lib/apply-paths';

export const maxDuration = 30;

interface BatchStartRequest {
  jobIds: string[];
}

export async function POST(req: Request) {
  let body: BatchStartRequest;
  try {
    body = (await req.json()) as BatchStartRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobIds } = body;
  if (!Array.isArray(jobIds) || jobIds.length < 1 || jobIds.length > 10) {
    return NextResponse.json(
      { error: 'jobIds must be an array of 1–10 job IDs' },
      { status: 400 },
    );
  }

  // Recover stuck entries first — so we don't false-positive on the processing check
  await recoverStuckEntries();

  // Reject if there's already an active batch
  const existingBatch = await readBatch();
  if (isActiveBatch(existingBatch)) {
    const done = existingBatch.completedIds.length;
    const total = existingBatch.jobIds.length;
    return NextResponse.json(
      { error: `Batch already active (${done}/${total} dispatched). Cancel it first.` },
      { status: 409 },
    );
  }

  // Reject if any entry is currently processing
  const queue = await readQueue();
  const processing = queue.find((e) => e.status === 'processing');
  if (processing) {
    return NextResponse.json(
      { error: `A draft is currently processing: "${processing.jobTitle}"` },
      { status: 409 },
    );
  }

  // Load jobs for validation
  let jobs: Job[];
  try {
    jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf-8')) as Job[];
  } catch {
    return NextResponse.json({ error: 'Could not read jobs.json' }, { status: 500 });
  }

  const missingJobIds: string[] = [];
  const skippedJobIds: string[] = [];
  const validJobIds: string[] = [];

  for (const jobId of jobIds) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      missingJobIds.push(jobId);
      continue;
    }
    if (job.applied || job.rejected) {
      skippedJobIds.push(jobId);
      continue;
    }
    validJobIds.push(jobId);
  }

  if (validJobIds.length === 0) {
    return NextResponse.json(
      {
        error: 'No actionable jobs: all provided IDs are missing or already applied/rejected',
        missingJobIds,
        skippedJobIds,
      },
      { status: 400 },
    );
  }

  // Write batch state
  const batchId = crypto.randomUUID();
  await writeBatch({
    batchId,
    jobIds: validJobIds,
    currentIndex: 0,
    completedIds: [],
    status: 'active',
    startedAt: new Date().toISOString(),
    completedAt: null,
  });

  // Fire the first draft asynchronously so this response returns immediately
  setImmediate(() => {
    executeDraft(validJobIds[0], batchId).catch((err) => {
      console.error('[apply/batch/start] first draft failed:', err);
    });
  });

  return NextResponse.json({
    batchId,
    jobIds: validJobIds,
    queued: validJobIds.length,
    missingJobIds,
    skippedJobIds,
  });
}
