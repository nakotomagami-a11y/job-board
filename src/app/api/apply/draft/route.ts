import { NextResponse } from 'next/server';
import { readQueue } from '@lib/apply-queue';
import { readBatch, isActiveBatch } from '@lib/apply-batch';
import { executeDraft } from '@lib/apply-draft-executor';

// phase 3: parallel applies, LinkedIn Easy Apply modal handling

export const maxDuration = 120;

interface DraftRequest {
  jobId: string;
}

export async function POST(req: Request) {
  let body: DraftRequest;
  try {
    body = (await req.json()) as DraftRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.jobId) return NextResponse.json({ error: "Missing 'jobId'" }, { status: 400 });

  // Block single-job applies while a batch is running — user must finish or cancel it first.
  const batch = await readBatch();
  if (isActiveBatch(batch)) {
    const done = batch.completedIds.length;
    const total = batch.jobIds.length;
    return NextResponse.json(
      { error: `Batch in progress (${done}/${total}). Finish or cancel batch first.` },
      { status: 409 },
    );
  }

  // Only 'processing' blocks; awaiting_answers + pending_review can coexist.
  const queue = await readQueue();
  const blocking = queue.find((e) => e.status === 'processing');
  if (blocking) {
    return NextResponse.json(
      { error: `Already processing: draftId ${blocking.draftId} for "${blocking.jobTitle}"` },
      { status: 409 },
    );
  }

  try {
    const result = await executeDraft(body.jobId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith('Job not found') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
