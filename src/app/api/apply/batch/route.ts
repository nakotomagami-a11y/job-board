import { NextResponse } from 'next/server';
import { readBatch, isActiveBatch } from '@lib/apply-batch';

export async function GET() {
  const batch = await readBatch();
  return NextResponse.json({ batch, isActive: isActiveBatch(batch) });
}
