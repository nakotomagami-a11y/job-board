import fs from "fs/promises";
import path from "path";
import type { AnswerScope, AnswerValue, FieldType } from "./types";
import type { EmailDraft } from "./email/compose";
import type { EmailCandidate } from "./email/extract";
import type { BlockerDetection } from "./blockers";

export const SESSIONS_DIR = path.join(
  process.cwd(),
  "data",
  "user",
  "auto-apply",
  "sessions",
);

export type SessionStatus =
  | "init"
  | "running"
  | "awaiting-answers"
  | "awaiting-submit"
  | "awaiting-email-confirm"
  | "submitted"
  | "emailed"
  | "cancelled"
  | "error";

export interface PendingField {
  fieldId: string;
  label: string;
  fieldType: FieldType;
  options?: string[];
  required?: boolean;
  intentTag?: string;
  reason: string;
}

export interface PendingPage {
  pageUrl: string;
  screenshotPath?: string;
  fields: PendingField[];
  createdAt: string;
}

export interface ResolvedField {
  fieldId: string;
  value: AnswerValue;
  scope: AnswerScope;
  scopeKey?: string;
  saveToBank: boolean;
}

export interface Resolution {
  fields: ResolvedField[];
  resolvedAt: string;
}

export interface FilledFieldSummary {
  fieldId: string;
  label: string;
  displayValue: string;
  source: "bank" | "rule" | "user";
}

export interface SubmitRequest {
  pageUrl: string;
  screenshotPath?: string;
  filledFields: FilledFieldSummary[];
  requestedAt: string;
}

export type SubmitDecision = "confirm" | "cancel";

export interface EmailRequest {
  blockers: BlockerDetection[];
  candidates: EmailCandidate[];
  draft: EmailDraft;
  requestedAt: string;
}

export type EmailDecision =
  | { kind: "send"; finalDraft: EmailDraft }
  | { kind: "cancel" }
  | { kind: "skip" }; // skip = don't email, but don't mark session as cancelled

export interface LogEntry {
  at: string;
  kind:
    | "info"
    | "warn"
    | "error"
    | "pause"
    | "resume"
    | "submit-request"
    | "submit-decision"
    | "email-request"
    | "email-decision";
  message: string;
}

export interface Session {
  id: string;
  jobId?: string;
  jobUrl: string;
  ats?: string;
  company?: string;
  status: SessionStatus;
  pending?: PendingPage;
  resolution?: Resolution;
  submitRequest?: SubmitRequest;
  submitDecision?: SubmitDecision;
  emailRequest?: EmailRequest;
  emailDecision?: EmailDecision;
  log: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

export function sessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export async function readSession(id: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(sessionPath(id), "utf-8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const next: Session = { ...session, updatedAt: new Date().toISOString() };
  const tmp = `${sessionPath(session.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next, null, 2));
  await fs.rename(tmp, sessionPath(session.id));
}

export async function listSessions(): Promise<Session[]> {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions: Session[] = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
      const id = f.replace(/\.json$/, "");
      const s = await readSession(id);
      if (s) sessions.push(s);
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function newSession(input: {
  id: string;
  jobUrl: string;
  jobId?: string;
  ats?: string;
  company?: string;
}): Session {
  const now = new Date().toISOString();
  return {
    id: input.id,
    jobUrl: input.jobUrl,
    jobId: input.jobId,
    ats: input.ats,
    company: input.company,
    status: "init",
    log: [{ at: now, kind: "info", message: "session created" }],
    createdAt: now,
    updatedAt: now,
  };
}

export function appendLog(session: Session, kind: LogEntry["kind"], message: string): Session {
  return {
    ...session,
    log: [...session.log, { at: new Date().toISOString(), kind, message }],
  };
}
