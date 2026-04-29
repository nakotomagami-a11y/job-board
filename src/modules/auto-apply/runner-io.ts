import {
  appendLog,
  readSession,
  writeSession,
  type PendingPage,
  type Resolution,
  type Session,
  type SubmitDecision,
  type SubmitRequest,
} from "./session";

const POLL_MS = 500;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Park the runner: write the page's unknown fields to the session file
 * and wait until the CLI writes a resolution back. Throws if cancelled.
 */
export async function pauseForAnswers(
  sessionId: string,
  pending: PendingPage,
): Promise<Resolution> {
  const current = await readSession(sessionId);
  if (!current) throw new Error(`session ${sessionId} not found`);

  const paused: Session = appendLog(
    {
      ...current,
      status: "awaiting-answers",
      pending,
      resolution: undefined,
    },
    "pause",
    `awaiting answers for ${pending.fields.length} field(s) on ${pending.pageUrl}`,
  );
  await writeSession(paused);

  while (true) {
    await sleep(POLL_MS);
    const s = await readSession(sessionId);
    if (!s) throw new Error("session disappeared");
    if (s.status === "cancelled") {
      throw new Error("session cancelled by user");
    }
    if (s.status === "running" && s.resolution) {
      const resumed = appendLog(s, "resume", "resolution received, resuming");
      // Keep resolution on the session for the audit log; clear pending.
      await writeSession({ ...resumed, pending: undefined });
      return s.resolution;
    }
  }
}

/**
 * Submit gate: the runner is at the final review screen. Hand the manifest
 * to the user via the session file and block until they explicitly confirm
 * or cancel. There is intentionally no override flag.
 */
export async function requestSubmit(
  sessionId: string,
  manifest: SubmitRequest,
): Promise<SubmitDecision> {
  const current = await readSession(sessionId);
  if (!current) throw new Error(`session ${sessionId} not found`);

  const requested: Session = appendLog(
    {
      ...current,
      status: "awaiting-submit",
      submitRequest: manifest,
      submitDecision: undefined,
    },
    "submit-request",
    `submit gate: ${manifest.filledFields.length} fields filled on ${manifest.pageUrl}`,
  );
  await writeSession(requested);

  while (true) {
    await sleep(POLL_MS);
    const s = await readSession(sessionId);
    if (!s) throw new Error("session disappeared");
    if (s.submitDecision === "confirm") {
      await writeSession(
        appendLog({ ...s, status: "running" }, "submit-decision", "confirmed by user"),
      );
      return "confirm";
    }
    if (s.submitDecision === "cancel" || s.status === "cancelled") {
      await writeSession(
        appendLog({ ...s, status: "cancelled" }, "submit-decision", "cancelled by user"),
      );
      return "cancel";
    }
  }
}
