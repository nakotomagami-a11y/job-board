import fs from 'fs/promises';
import path from 'path';
import type { ApplyQueueEntry } from '@shared/types/apply';

const QUEUE_PATH = path.join(process.cwd(), 'data', 'user', 'apply-queue.json');

export async function readQueue(): Promise<ApplyQueueEntry[]> {
  try {
    return JSON.parse(await fs.readFile(QUEUE_PATH, 'utf-8')) as ApplyQueueEntry[];
  } catch {
    return [];
  }
}

export async function writeQueue(entries: ApplyQueueEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(QUEUE_PATH), { recursive: true });
  await fs.writeFile(QUEUE_PATH, JSON.stringify(entries, null, 2));
}

export async function upsertEntry(entry: ApplyQueueEntry): Promise<void> {
  const entries = await readQueue();
  const idx = entries.findIndex((e) => e.draftId === entry.draftId);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await writeQueue(entries);
}
