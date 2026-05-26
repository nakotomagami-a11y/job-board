import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export type FieldType =
  | 'email'
  | 'shortText'
  | 'phone'
  | 'country'
  | 'url'
  | 'number'
  | 'shortAnswer'
  | 'yesNoExplanation'
  | 'essay';

export interface BankFieldOverride {
  matches: string; // substring of company/job context that triggers this override
  value: string;
}

export interface BankField {
  value: string;
  type: FieldType;
  questionVariants: string[];
  source: string;
  createdAt: string;
  usedCount: number;
  overrides?: BankFieldOverride[]; // phase 2: context-specific answers (EU vs US roles etc)
}

export interface AnswerBank {
  version: 1;
  updatedAt: string;
  fields: Record<string, BankField>;
}

export interface MatchResult {
  key: string;
  confidence: number;
  source: 'exact' | 'variant' | 'fuzzy';
}

export interface AgentMatchResult {
  key: string;
  confidence: number;
  reasoning: string;
}

export interface AgentNovelResult {
  novel: true;
  suggestedKey: string;
  suggestedType: string;
}

export type AgentResponse = AgentMatchResult | AgentNovelResult;

export interface AgentInput {
  questionText: string;
  bankKeys: Array<{ key: string; description: string }>;
  contextSnippet: string;
}

const BANK_PATH = path.join(process.cwd(), 'data', 'user', 'answer-bank.json');

export async function readBank(): Promise<AnswerBank> {
  try {
    return JSON.parse(await fs.readFile(BANK_PATH, 'utf-8')) as AnswerBank;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), fields: {} };
  }
}

export async function writeBank(bank: AnswerBank): Promise<void> {
  await fs.mkdir(path.dirname(BANK_PATH), { recursive: true });
  const tmp = `${BANK_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(bank, null, 2));
  await fs.rename(tmp, BANK_PATH);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 && tokB.size === 0) return 1;
  let intersection = 0;
  for (const t of tokA) {
    if (tokB.has(t)) intersection++;
  }
  const union = tokA.size + tokB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Maps Jaccard score (0.7–1.0) into confidence range (0.7–0.95) linearly.
function fuzzyConfidence(jaccard: number): number {
  return 0.7 + ((jaccard - 0.7) / 0.3) * 0.25;
}

export function matchQuestion(questionText: string, bank: AnswerBank): MatchResult | null {
  const normQ = normalize(questionText);
  let best: MatchResult | null = null;

  function update(key: string, confidence: number, source: 'exact' | 'variant' | 'fuzzy') {
    if (!best || confidence > best.confidence) {
      best = { key, confidence, source };
    }
  }

  for (const [key, field] of Object.entries(bank.fields)) {
    // exact: question text equals the field key name
    if (normQ === normalize(key)) {
      update(key, 1.0, 'exact');
      continue;
    }

    // variant: exact match against any stored question variant
    let variantMatched = false;
    for (const variant of field.questionVariants) {
      if (normQ === normalize(variant)) {
        update(key, 1.0, 'variant');
        variantMatched = true;
        break;
      }
    }
    if (variantMatched) continue;

    // fuzzy: token-Jaccard similarity above threshold against key name + all variants
    const candidates = [key, ...field.questionVariants];
    for (const candidate of candidates) {
      const score = jaccardSimilarity(questionText, candidate);
      if (score > 0.7) {
        update(key, fuzzyConfidence(score), 'fuzzy');
      }
    }
  }

  return best;
}

export async function appendQuestionVariant(key: string, newQuestionText: string): Promise<void> {
  const bank = await readBank();
  const field = bank.fields[key];
  if (!field) throw new Error(`Unknown bank key: ${key}`);

  const normNew = normalize(newQuestionText);
  const exists = field.questionVariants.some((v) => normalize(v) === normNew);
  if (!exists) field.questionVariants.push(newQuestionText);
  field.usedCount = (field.usedCount ?? 0) + 1;
  bank.updatedAt = new Date().toISOString();
  await writeBank(bank);
}

export async function addNewField(
  key: string,
  value: string,
  type: FieldType,
  sourceQuestion: string,
): Promise<void> {
  const bank = await readBank();

  if (bank.fields[key]) {
    bank.fields[key].value = value;
    const normSrc = normalize(sourceQuestion);
    const exists = bank.fields[key].questionVariants.some((v) => normalize(v) === normSrc);
    if (!exists) bank.fields[key].questionVariants.push(sourceQuestion);
    bank.fields[key].usedCount = (bank.fields[key].usedCount ?? 0) + 1;
  } else {
    bank.fields[key] = {
      value,
      type,
      questionVariants: [sourceQuestion],
      source: 'user',
      createdAt: new Date().toISOString(),
      usedCount: 1,
    };
  }

  bank.updatedAt = new Date().toISOString();
  await writeBank(bank);
}

// Calls the apply-question-matcher Haiku subagent via the claude CLI.
// Returns the parsed JSON response or throws on failure.
// The caller is responsible for rate-limiting (max 5 calls per draft).
export function callMatcherAgent(input: AgentInput): Promise<AgentResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', '--agent', 'apply-question-matcher'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Matcher agent timed out after 30s'));
    }, 30_000);

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Matcher agent exited ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      // Agent is instructed to return JSON only, but extract defensively.
      const jsonMatch = /\{[\s\S]*\}/.exec(stdout);
      if (!jsonMatch) {
        reject(new Error(`No JSON in agent output: ${stdout.slice(0, 200)}`));
        return;
      }
      try {
        resolve(JSON.parse(jsonMatch[0]) as AgentResponse);
      } catch (e) {
        reject(new Error(`Agent JSON parse error: ${e}`));
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
