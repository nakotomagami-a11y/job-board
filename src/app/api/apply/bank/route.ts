import { NextResponse } from 'next/server';
import { readBank, writeBank } from '@lib/answer-bank';
import type { AnswerBank, BankField } from '@lib/answer-bank';

export async function GET() {
  try {
    const bank = await readBank();
    return NextResponse.json(bank);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface PutBody {
  fields: Record<string, Partial<BankField> & { value?: string; type?: BankField['type']; questionVariants?: string[] }>;
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    if (!body.fields || typeof body.fields !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid fields object' }, { status: 400 });
    }
    const bank = await readBank();
    const now = new Date().toISOString();
    for (const [key, patch] of Object.entries(body.fields)) {
      const existing = bank.fields[key];
      if (existing) {
        bank.fields[key] = {
          ...existing,
          ...patch,
          updatedAt: now,
        } as BankField;
      } else {
        if (patch.value === undefined || !patch.type) continue;
        bank.fields[key] = {
          value: patch.value,
          type: patch.type,
          questionVariants: patch.questionVariants ?? [],
          source: 'manual',
          createdAt: now,
          updatedAt: now,
          usedCount: 0,
        } as BankField;
      }
    }
    bank.updatedAt = now;
    await writeBank(bank as AnswerBank);
    return NextResponse.json({ ok: true, fields: Object.keys(bank.fields).length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
