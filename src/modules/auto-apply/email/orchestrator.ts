import type { Job } from "@shared/types/job";
import type { UserProfile } from "@shared/types/profile";
import { type BlockerDetection } from "../blockers";
import { appendLog, readSession, writeSession, type Session } from "../session";
import { composeEmail, type EmailDraft } from "./compose";
import { gatherCandidates, companyDomainFromUrl, type EmailCandidate } from "./extract";
import { loadEmailConfig } from "./transport";

const POLL_MS = 500;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface EmailFallbackInput {
  sessionId: string;
  job: Pick<Job, "id" | "title" | "company" | "url" | "description">;
  profile: UserProfile;
  blockers: BlockerDetection[];
  pageText?: string;
}

/**
 * Build candidates + an initial draft, write to the session, and block until
 * the CLI records a decision. The runner calls this when the form path is
 * blocked. Returns the user's decision (send | cancel | skip).
 */
export async function requestEmailFallback(input: EmailFallbackInput) {
  const { sessionId, job, profile, blockers } = input;
  const current = await readSession(sessionId);
  if (!current) throw new Error(`session ${sessionId} not found`);

  const config = await loadEmailConfig();
  const companyDomain = companyDomainFromUrl(job.url) ?? undefined;
  const candidates = gatherCandidates({
    jdText: job.description,
    pageText: input.pageText,
    companyDomain,
  });

  // If we have any candidate at all, draft against the best one. The user
  // can still pick a different recipient or enter their own in the CLI.
  const placeholderRecipient: EmailCandidate =
    candidates[0] ?? {
      email: "",
      source: "common-pattern",
      confidence: "low",
      reason: "no recipient discovered — please provide one",
    };

  const draft: EmailDraft = composeEmail({
    job,
    profile,
    recipient: { email: placeholderRecipient.email, reason: placeholderRecipient.reason },
    fromAddress: config.fromAddress,
  });

  const next: Session = appendLog(
    {
      ...current,
      status: "awaiting-email-confirm",
      emailRequest: {
        blockers,
        candidates,
        draft,
        requestedAt: new Date().toISOString(),
      },
      emailDecision: undefined,
    },
    "email-request",
    `email fallback: ${candidates.length} candidate(s), blockers=${blockers.map((b) => b.kind).join(",")}`,
  );
  await writeSession(next);

  while (true) {
    await sleep(POLL_MS);
    const s = await readSession(sessionId);
    if (!s) throw new Error("session disappeared");
    if (!s.emailDecision) continue;
    if (s.emailDecision.kind === "cancel") {
      await writeSession(
        appendLog({ ...s, status: "cancelled" }, "email-decision", "user cancelled email fallback"),
      );
      return s.emailDecision;
    }
    if (s.emailDecision.kind === "skip") {
      await writeSession(
        appendLog({ ...s, status: "running" }, "email-decision", "user skipped email fallback"),
      );
      return s.emailDecision;
    }
    if (s.emailDecision.kind === "send") {
      // Status update happens in the CLI after the transport runs.
      return s.emailDecision;
    }
  }
}
