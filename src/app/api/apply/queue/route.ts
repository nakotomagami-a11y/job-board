import { NextResponse } from 'next/server';
import { readQueue } from '@lib/apply-queue';

export async function GET() {
  const queue = await readQueue();
  return NextResponse.json(queue);
}
