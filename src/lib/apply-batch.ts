import fs from 'fs/promises';
import path from 'path';
import { BATCH_PATH } from '@lib/apply-paths';

export interface ApplyBatch {
  batchId: string;
  jobIds: string[];
  currentIndex: number;
  completedIds: string[];
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
}

export async function readBatch(): Promise<ApplyBatch | null> {
  try {
    return JSON.parse(await fs.readFile(BATCH_PATH, 'utf-8')) as ApplyBatch;
  } catch {
    return null;
  }
}

export async function writeBatch(batch: ApplyBatch): Promise<void> {
  await fs.mkdir(path.dirname(BATCH_PATH), { recursive: true });
  const tmp = BATCH_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(batch, null, 2));
  await fs.rename(tmp, BATCH_PATH);
}

export function isActiveBatch(batch: ApplyBatch | null): batch is ApplyBatch {
  return batch !== null && batch.status === 'active' && batch.currentIndex < batch.jobIds.length;
}

// Marks batch.jobIds[currentIndex] as completed, increments currentIndex.
// Returns the next jobId or null if the batch is exhausted.
export async function advanceBatch(): Promise<string | null> {
  const batch = await readBatch();
  if (!batch || batch.status !== 'active') return null;

  const current = batch.jobIds[batch.currentIndex];
  if (current && !batch.completedIds.includes(current)) {
    batch.completedIds.push(current);
  }
  batch.currentIndex++;

  if (batch.currentIndex >= batch.jobIds.length) {
    batch.status = 'completed';
    batch.completedAt = new Date().toISOString();
    await writeBatch(batch);
    return null;
  }

  await writeBatch(batch);
  return batch.jobIds[batch.currentIndex];
}
