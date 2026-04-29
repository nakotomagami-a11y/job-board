import fs from "fs/promises";
import path from "path";
import { EMPTY_BANK, type AnswerBank, type AnswerEntry, type NormalizationRule } from "./types";

export const ANSWER_BANK_PATH = path.join(
  process.cwd(),
  "data",
  "user",
  "answer-bank.json",
);

export async function loadAnswerBank(): Promise<AnswerBank> {
  try {
    const raw = await fs.readFile(ANSWER_BANK_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AnswerBank;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
      return {
        version: 1,
        entries: parsed.entries,
        normalizations: parsed.normalizations ?? [],
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    }
    return { ...EMPTY_BANK };
  } catch {
    return { ...EMPTY_BANK };
  }
}

export async function saveAnswerBank(bank: AnswerBank): Promise<void> {
  await fs.mkdir(path.dirname(ANSWER_BANK_PATH), { recursive: true });
  const next: AnswerBank = { ...bank, updatedAt: new Date().toISOString() };
  await fs.writeFile(ANSWER_BANK_PATH, JSON.stringify(next, null, 2));
}

export function upsertEntry(bank: AnswerBank, entry: AnswerEntry): AnswerBank {
  const idx = bank.entries.findIndex(
    (e) =>
      e.intentTag === entry.intentTag &&
      e.fingerprint === entry.fingerprint &&
      e.scope === entry.scope &&
      (e.scopeKey ?? "") === (entry.scopeKey ?? ""),
  );
  const entries = [...bank.entries];
  if (idx >= 0) {
    entries[idx] = { ...entry, createdAt: entries[idx].createdAt, updatedAt: new Date().toISOString() };
  } else {
    entries.push({ ...entry, updatedAt: new Date().toISOString() });
  }
  return { ...bank, entries };
}

export function deleteEntry(bank: AnswerBank, id: string): AnswerBank {
  return { ...bank, entries: bank.entries.filter((e) => e.id !== id) };
}

export function addNormalization(
  bank: AnswerBank,
  rule: NormalizationRule,
): AnswerBank {
  const exists = bank.normalizations.some(
    (n) =>
      n.fieldType === rule.fieldType &&
      (n.ats ?? "") === (rule.ats ?? "") &&
      (n.intentTag ?? "") === (rule.intentTag ?? "") &&
      n.from === rule.from &&
      n.to === rule.to,
  );
  if (exists) return bank;
  return { ...bank, normalizations: [...bank.normalizations, rule] };
}
