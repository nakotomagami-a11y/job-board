import fs from "fs/promises";
import path from "path";
import type { EmailDraft } from "./compose";

export const EMAIL_DRAFTS_DIR = path.join(
  process.cwd(),
  "data",
  "user",
  "auto-apply",
  "email-drafts",
);

export type EmailStatus = "draft" | "awaiting-confirm" | "sent" | "cancelled" | "error";

export interface EmailRecord {
  id: string;
  status: EmailStatus;
  draft: EmailDraft;
  mailtoUrl?: string;
  emlPath?: string;
  transport?: "mailto" | "smtp";
  error?: string;
  createdAt: string;
  updatedAt: string;
}

function recordPath(id: string): string {
  return path.join(EMAIL_DRAFTS_DIR, `${id}.json`);
}

function emlPath(id: string): string {
  return path.join(EMAIL_DRAFTS_DIR, `${id}.eml`);
}

export async function saveEmailDraft(record: EmailRecord, eml?: string): Promise<EmailRecord> {
  await fs.mkdir(EMAIL_DRAFTS_DIR, { recursive: true });
  const next: EmailRecord = { ...record, updatedAt: new Date().toISOString() };
  if (eml) {
    next.emlPath = emlPath(record.id);
    await fs.writeFile(next.emlPath, eml);
  }
  await fs.writeFile(recordPath(record.id), JSON.stringify(next, null, 2));
  return next;
}

export async function readEmailDraft(id: string): Promise<EmailRecord | null> {
  try {
    const raw = await fs.readFile(recordPath(id), "utf-8");
    return JSON.parse(raw) as EmailRecord;
  } catch {
    return null;
  }
}

export async function listEmailDrafts(): Promise<EmailRecord[]> {
  try {
    const files = await fs.readdir(EMAIL_DRAFTS_DIR);
    const out: EmailRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const id = f.replace(/\.json$/, "");
      const r = await readEmailDraft(id);
      if (r) out.push(r);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/**
 * Render an RFC822-ish .eml file (good for archival + manual send).
 * Not used for sending — the transport handles that.
 */
export function renderEml(draft: EmailDraft): string {
  const headers = [
    `From: ${draft.from}`,
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${draft.body}`;
}
