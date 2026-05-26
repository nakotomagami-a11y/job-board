"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplyQueueEntry, UnansweredQuestion } from "@shared/types/apply";
import type { FieldType } from "@lib/answer-bank";
import { API } from "@lib/constants";

// phase 3: video recording preview, notification on submit confirmation

const POLL_INTERVAL_MS = 3000;

const FIELD_TYPES: FieldType[] = [
  "shortText", "url", "email", "phone",
  "yesNoExplanation", "essay", "number", "country", "shortAnswer",
];

type ActionState = "idle" | "busy";

interface BatchState {
  batch: {
    batchId: string;
    jobIds: string[];
    currentIndex: number;
    completedIds: string[];
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  isActive: boolean;
}

export function PendingApplications() {
  const [queue, setQueue] = useState<ApplyQueueEntry[]>([]);
  const [batchState, setBatchState] = useState<BatchState | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(API.applyQueue);
      if (res.ok) setQueue((await res.json()) as ApplyQueueEntry[]);
    } catch { /* silent — poll will retry */ }
  }, []);

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch(API.applyBatch);
      if (res.ok) setBatchState((await res.json()) as BatchState);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchBatch();
    pollRef.current = setInterval(() => {
      fetchQueue();
      fetchBatch();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQueue, fetchBatch]);

  const pendingEntries = queue.filter((e) => e.status === "pending_review");
  const awaitingEntries = queue.filter((e) => e.status === "awaiting_answers");
  const processingEntries = queue.filter((e) => e.status === "processing");
  const isActiveBatch = batchState?.isActive === true;

  if (
    pendingEntries.length === 0 &&
    awaitingEntries.length === 0 &&
    processingEntries.length === 0 &&
    !isActiveBatch
  ) {
    return null;
  }

  const handleAction = async (draftId: string, action: "submit" | "cancel") => {
    setActionState("busy");
    setMsg(null);
    try {
      const res = await fetch(API.applyConfirm, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, action }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (res.ok) {
        setMsg({
          text: action === "submit"
            ? `✅ Submitted! Status: ${data.status}`
            : "🚫 Application cancelled.",
          kind: "ok",
        });
        await fetchQueue();
        await fetchBatch();
      } else {
        setMsg({ text: data.error ?? "Action failed", kind: "err" });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Action failed", kind: "err" });
    } finally {
      setActionState("idle");
    }
  };

  const handleAnswers = async (draftId: string, answers: AnswerFormState[]) => {
    setActionState("busy");
    setMsg(null);
    try {
      const res = await fetch(API.applyAnswer, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, answers }),
      });
      const data = (await res.json()) as {
        status?: string;
        remainingUnanswered?: UnansweredQuestion[];
        error?: string;
      };
      if (res.ok) {
        setMsg({
          text: data.status === "pending_review"
            ? "✅ Answers saved — form is ready for review."
            : `Answers saved. ${data.remainingUnanswered?.length ?? 0} question(s) still need answers.`,
          kind: "ok",
        });
        await fetchQueue();
      } else {
        setMsg({ text: data.error ?? "Failed to submit answers", kind: "err" });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to submit answers", kind: "err" });
    } finally {
      setActionState("idle");
    }
  };

  const handleCancelBatch = async () => {
    if (!confirm("Cancel the entire batch? All in-progress applications will be closed.")) return;
    setActionState("busy");
    setMsg(null);
    try {
      const res = await fetch(API.applyBatchCancel, { method: "POST" });
      const data = (await res.json()) as { cancelledCount?: number; error?: string };
      if (res.ok) {
        setMsg({ text: `🛑 Batch cancelled. ${data.cancelledCount ?? 0} draft(s) closed.`, kind: "ok" });
        await fetchQueue();
        await fetchBatch();
      } else {
        setMsg({ text: data.error ?? "Cancel failed", kind: "err" });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Cancel failed", kind: "err" });
    } finally {
      setActionState("idle");
    }
  };

  const currentlyProcessing = processingEntries[0];
  const batch = batchState?.batch;

  return (
    <div>
      {/* ── Batch progress header ── */}
      {isActiveBatch && batch && (
        <section style={{
          margin: "0 0 16px",
          padding: "14px 20px",
          background: "rgba(56,189,248,0.05)",
          border: "1px solid rgba(56,189,248,0.2)",
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--c-primary)" }}>
              🚀 Batch in progress
            </span>
            <span style={{
              background: "rgba(56,189,248,0.12)",
              color: "var(--c-primary)",
              borderRadius: "var(--radius-pill)",
              padding: "1px 8px",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}>
              {batch.completedIds.length} of {batch.jobIds.length} dispatched
            </span>
            {currentlyProcessing && (
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                ⏳ Drafting: <strong style={{ color: "var(--text)" }}>{currentlyProcessing.jobTitle}</strong>
              </span>
            )}
            <button
              className="filter-btn"
              disabled={actionState === "busy"}
              onClick={handleCancelBatch}
              style={{
                marginLeft: "auto",
                padding: "5px 12px",
                fontSize: "0.75rem",
                opacity: actionState === "busy" ? 0.5 : 1,
                borderColor: "rgba(248,113,113,0.3)",
                color: "#f87171",
              }}
            >
              🛑 Cancel Batch
            </button>
          </div>
          {msg && (
            <div style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              background: msg.kind === "ok" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              color: msg.kind === "ok" ? "var(--c-secondary)" : "#f87171",
              border: `1px solid ${msg.kind === "ok" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}>
              {msg.text}
            </div>
          )}
        </section>
      )}

      {awaitingEntries.length > 0 && (
        <section style={{
          margin: "0 0 24px",
          padding: "16px 20px",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#a78bfa" }}>
              ❓ Awaiting Your Answers
            </span>
            <span style={{
              background: "rgba(139,92,246,0.15)",
              color: "#a78bfa",
              borderRadius: "var(--radius-pill)",
              padding: "1px 8px",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}>
              {awaitingEntries.length}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-dim)" }}>
              Answer these questions and they&apos;ll be saved to your answer bank for next time
            </span>
          </div>

          {msg && !isActiveBatch && (
            <div style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.82rem",
              background: msg.kind === "ok" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              color: msg.kind === "ok" ? "var(--c-secondary)" : "#f87171",
              border: `1px solid ${msg.kind === "ok" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {awaitingEntries.map((entry) => (
              <AwaitingCard
                key={entry.draftId}
                entry={entry}
                disabled={actionState === "busy"}
                onAnswers={handleAnswers}
                onCancel={(id) => handleAction(id, "cancel")}
              />
            ))}
          </div>
        </section>
      )}

      {pendingEntries.length > 0 && (
        <section style={{
          margin: "0 0 24px",
          padding: "16px 20px",
          background: "rgba(251,146,60,0.06)",
          border: "1px solid rgba(251,146,60,0.25)",
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--c-accent)" }}>
              ✋ Pending Review
            </span>
            <span style={{
              background: "rgba(251,146,60,0.15)",
              color: "var(--c-accent)",
              borderRadius: "var(--radius-pill)",
              padding: "1px 8px",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}>
              {pendingEntries.length}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-dim)" }}>
              Browser is open — review the filled form before approving
            </span>
          </div>

          {msg && pendingEntries.length > 0 && !isActiveBatch && (
            <div style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.82rem",
              background: msg.kind === "ok" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              color: msg.kind === "ok" ? "var(--c-secondary)" : "#f87171",
              border: `1px solid ${msg.kind === "ok" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingEntries.map((entry) => (
              <PendingCard
                key={entry.draftId}
                entry={entry}
                disabled={actionState === "busy"}
                onAction={handleAction}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Awaiting answers card ─────────────────────────────────────────────────────

interface AnswerFormState {
  questionText: string;
  suggestedKey: string;
  value: string;
  type: FieldType;
  saveToBank: boolean;
}

function AwaitingCard({
  entry,
  disabled,
  onAnswers,
  onCancel,
}: {
  entry: ApplyQueueEntry;
  disabled: boolean;
  onAnswers: (draftId: string, answers: AnswerFormState[]) => void;
  onCancel: (draftId: string) => void;
}) {
  const questions = entry.unansweredQuestions ?? [];
  const [forms, setForms] = useState<AnswerFormState[]>(() =>
    questions.map((q) => ({
      questionText: q.questionText,
      suggestedKey: q.suggestedKey ?? "",
      value: "",
      type: (q.suggestedType as FieldType | undefined) ?? "shortText",
      saveToBank: true,
    })),
  );

  const updateForm = (idx: number, patch: Partial<AnswerFormState>) => {
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const screenshotUrl = `/api/apply/screenshot/${entry.draftId}`;

  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
    }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
          {entry.jobTitle}
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginLeft: 8 }}>
          @ {entry.company}
        </span>
        <span style={{
          marginLeft: 10,
          fontSize: "0.7rem",
          color: "var(--text-dim)",
          background: "rgba(139,92,246,0.1)",
          borderRadius: "var(--radius-pill)",
          padding: "1px 7px",
        }}>
          {questions.length} question{questions.length !== 1 ? "s" : ""} need{questions.length === 1 ? "s" : ""} answers
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <img
          src={screenshotUrl}
          alt="Form preview"
          style={{ width: "100%", maxWidth: 400, borderRadius: 6, border: "1px solid var(--border)" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {forms.map((form, idx) => (
          <div key={idx} style={{
            padding: "10px 12px",
            background: "rgba(139,92,246,0.04)",
            border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: "var(--radius-sm)",
          }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              {form.questionText}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                Bank key
                <input
                  type="text"
                  value={form.suggestedKey}
                  onChange={(e) => updateForm(idx, { suggestedKey: e.target.value })}
                  placeholder="e.g. visaSponsorship"
                  style={{
                    padding: "5px 8px",
                    fontSize: "0.78rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                Type
                <select
                  value={form.type}
                  onChange={(e) => updateForm(idx, { type: e.target.value as FieldType })}
                  style={{
                    padding: "5px 8px",
                    fontSize: "0.78rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                  }}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: 8 }}>
              Your answer
              <textarea
                value={form.value}
                onChange={(e) => updateForm(idx, { value: e.target.value })}
                rows={2}
                style={{
                  padding: "5px 8px",
                  fontSize: "0.82rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--text-dim)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.saveToBank}
                onChange={(e) => updateForm(idx, { saveToBank: e.target.checked })}
              />
              Save to answer bank (remember for next time)
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="apply-btn"
          disabled={disabled || forms.some((f) => !f.value.trim())}
          onClick={() => onAnswers(entry.draftId, forms)}
          style={{
            padding: "9px 16px",
            fontSize: "0.82rem",
            opacity: disabled || forms.some((f) => !f.value.trim()) ? 0.5 : 1,
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.3)",
            color: "#a78bfa",
          }}
        >
          {disabled ? "⏳" : "💾"} Submit Answers
        </button>
        <button
          className="filter-btn"
          disabled={disabled}
          onClick={() => {
            if (confirm(`Cancel application for "${entry.jobTitle}"?`)) onCancel(entry.draftId);
          }}
          style={{
            padding: "9px 16px",
            fontSize: "0.82rem",
            opacity: disabled ? 0.5 : 1,
            borderColor: "rgba(248,113,113,0.3)",
            color: "#f87171",
          }}
        >
          🚫 Cancel
        </button>
        <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", alignSelf: "center", marginLeft: 4 }}>
          {new Date(entry.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// ── Pending review card ───────────────────────────────────────────────────────

function PendingCard({
  entry,
  disabled,
  onAction,
}: {
  entry: ApplyQueueEntry;
  disabled: boolean;
  onAction: (draftId: string, action: "submit" | "cancel") => void;
}) {
  const screenshotUrl = `/api/apply/screenshot/${entry.draftId}`;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 16,
      padding: "14px 16px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
            {entry.jobTitle}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginLeft: 8 }}>
            @ {entry.company}
          </span>
        </div>
        <a
          href={entry.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.72rem", color: "var(--c-primary)", wordBreak: "break-all" }}
        >
          {entry.applyUrl}
        </a>
        <div style={{ marginTop: 10 }}>
          {/* Native <img> intentional: screenshots are dynamic blobs, not optimised assets */}
          <img
            src={screenshotUrl}
            alt="Form preview with highlighted submit button"
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 8,
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
          <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: 4 }}>
            Submit button outlined in red. Review the headed browser window before approving.
          </p>
        </div>
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "stretch",
        justifyContent: "flex-start",
        minWidth: 110,
      }}>
        <button
          className="apply-btn"
          disabled={disabled}
          onClick={() => onAction(entry.draftId, "submit")}
          style={{
            padding: "10px 16px",
            fontSize: "0.82rem",
            opacity: disabled ? 0.5 : 1,
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.3)",
            color: "var(--c-secondary)",
          }}
        >
          {disabled ? "⏳" : "✅"} Approve
        </button>
        <button
          className="filter-btn"
          disabled={disabled}
          onClick={() => {
            if (confirm(`Cancel application for "${entry.jobTitle}"?`)) {
              onAction(entry.draftId, "cancel");
            }
          }}
          style={{
            padding: "10px 16px",
            fontSize: "0.82rem",
            opacity: disabled ? 0.5 : 1,
            borderColor: "rgba(248,113,113,0.3)",
            color: "#f87171",
          }}
        >
          🚫 Cancel
        </button>
        <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", textAlign: "center", marginTop: 2 }}>
          {new Date(entry.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
