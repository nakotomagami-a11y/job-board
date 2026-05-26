"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@lib/constants";
import type { AnswerBank, BankField, FieldType } from "@lib/answer-bank";

const FIELD_TYPES: FieldType[] = [
  "shortText", "url", "email", "phone",
  "yesNoExplanation", "essay", "number", "country", "shortAnswer",
];

interface AnswerBankPanelProps {
  onClose: () => void;
}

interface FieldDraft {
  value: string;
  type: FieldType;
  questionVariants: string[];
  dirty: boolean;
}

export function AnswerBankPanel({ onClose }: AnswerBankPanelProps) {
  const [bank, setBank] = useState<AnswerBank | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadBank = useCallback(async () => {
    try {
      const res = await fetch(API.applyBank);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as AnswerBank;
      setBank(data);
      const init: Record<string, FieldDraft> = {};
      for (const [key, field] of Object.entries(data.fields)) {
        init[key] = {
          value: field.value,
          type: field.type,
          questionVariants: field.questionVariants ?? [],
          dirty: false,
        };
      }
      setDrafts(init);
    } catch (e) {
      setSaveState("error");
      setSaveMsg(e instanceof Error ? e.message : "Failed to load bank");
    }
  }, []);

  useEffect(() => { loadBank(); }, [loadBank]);

  const updateDraft = (key: string, patch: Partial<FieldDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch, dirty: true },
    }));
  };

  const handleSave = async () => {
    const dirtyFields: Record<string, Partial<BankField>> = {};
    for (const [key, draft] of Object.entries(drafts)) {
      if (!draft.dirty) continue;
      dirtyFields[key] = {
        value: draft.value,
        type: draft.type,
        questionVariants: draft.questionVariants,
      };
    }
    if (Object.keys(dirtyFields).length === 0) {
      setSaveMsg("No changes to save.");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
      return;
    }
    setSaveState("saving");
    setSaveMsg(null);
    try {
      const res = await fetch(API.applyBank, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: dirtyFields }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok) {
        setSaveState("saved");
        setSaveMsg(`Saved ${Object.keys(dirtyFields).length} change${Object.keys(dirtyFields).length === 1 ? "" : "s"}.`);
        await loadBank();
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setSaveState("error");
        setSaveMsg(data.error ?? "Save failed");
      }
    } catch (e) {
      setSaveState("error");
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (!bank) {
    return (
      <div style={{
        padding: 20, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: "var(--radius)", marginBottom: 20, textAlign: "center", fontSize: "0.85rem", color: "var(--text-dim)",
      }}>
        Loading answer bank...
      </div>
    );
  }

  // Partition by the SAVED bank value, not the current draft value. Otherwise
  // typing the first letter into an empty field flips its section, unmounting
  // the input mid-keystroke and stealing focus — feels like the panel closed.
  // Only re-partition after Save (which triggers loadBank() and resets drafts).
  const entries = Object.entries(drafts);
  const emptyEntries = entries.filter(([key]) => {
    const saved = bank.fields[key];
    return !saved?.value || !saved.value.trim();
  });
  const filledEntries = entries.filter(([key]) => {
    const saved = bank.fields[key];
    return saved?.value && saved.value.trim().length > 0;
  });

  return (
    <section style={{
      margin: "0 0 24px", padding: "16px 20px",
      background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)",
      borderRadius: "var(--radius)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#a78bfa" }}>
          📖 Answer Bank
        </span>
        <span style={{
          background: "rgba(139,92,246,0.15)", color: "#a78bfa",
          borderRadius: "var(--radius-pill)", padding: "1px 8px",
          fontSize: "0.72rem", fontWeight: 600,
        }}>
          {entries.length} field{entries.length !== 1 ? "s" : ""}
        </span>
        {emptyEntries.length > 0 && (
          <span style={{
            background: "rgba(202,138,4,0.15)", color: "#ca8a04",
            borderRadius: "var(--radius-pill)", padding: "1px 8px",
            fontSize: "0.72rem", fontWeight: 600,
          }}>
            {emptyEntries.length} empty
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-dim)" }}>
          Updated {new Date(bank.updatedAt).toLocaleString()}
        </span>
        <button className="filter-btn" onClick={onClose} style={{ fontSize: "0.72rem", padding: "4px 10px" }}>✕ Close</button>
      </div>

      {saveMsg && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.82rem",
          background: saveState === "error" ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)",
          color: saveState === "error" ? "#f87171" : "var(--c-secondary)",
          border: `1px solid ${saveState === "error" ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`,
        }}>
          {saveMsg}
        </div>
      )}

      {emptyEntries.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ca8a04", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Needs attention — {emptyEntries.length} empty field{emptyEntries.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {emptyEntries.map(([key, draft]) => (
              <FieldRow key={key} fieldKey={key} draft={draft} emphasis="empty" onUpdate={(p) => updateDraft(key, p)} />
            ))}
          </div>
        </div>
      )}

      <details>
        <summary style={{ cursor: "pointer", fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: 10, userSelect: "none" }}>
          ▸ All {filledEntries.length} filled field{filledEntries.length !== 1 ? "s" : ""}
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {filledEntries.map(([key, draft]) => (
            <FieldRow key={key} fieldKey={key} draft={draft} emphasis="filled" onUpdate={(p) => updateDraft(key, p)} />
          ))}
        </div>
      </details>

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        <button
          className="apply-btn"
          onClick={handleSave}
          disabled={saveState === "saving"}
          style={{
            padding: "9px 16px", fontSize: "0.82rem",
            opacity: saveState === "saving" ? 0.5 : 1,
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.3)",
            color: "#a78bfa",
          }}
        >
          {saveState === "saving" ? "⏳ Saving..." : "💾 Save Changes"}
        </button>
        <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
          Edits go to data/user/answer-bank.json — reused on every future AI Apply.
        </span>
      </div>
    </section>
  );
}

function FieldRow({ fieldKey, draft, emphasis, onUpdate }: {
  fieldKey: string;
  draft: FieldDraft;
  emphasis: "empty" | "filled";
  onUpdate: (patch: Partial<FieldDraft>) => void;
}) {
  const isEssay = draft.type === "essay" || draft.type === "yesNoExplanation" || draft.type === "shortAnswer";
  return (
    <div style={{
      padding: "10px 12px",
      background: emphasis === "empty" ? "rgba(202,138,4,0.04)" : "var(--surface)",
      border: `1px solid ${emphasis === "empty" ? "rgba(202,138,4,0.25)" : "var(--border)"}`,
      borderRadius: "var(--radius-sm)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <code style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>{fieldKey}</code>
        <select
          value={draft.type}
          onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
          style={{
            padding: "3px 6px", fontSize: "0.7rem",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text-dim)",
          }}
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {draft.questionVariants.length > 0 && (
          <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>
            {draft.questionVariants.length} variant{draft.questionVariants.length !== 1 ? "s" : ""}
          </span>
        )}
        {draft.dirty && (
          <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#fbbf24", fontWeight: 600 }}>● unsaved</span>
        )}
      </div>
      {isEssay ? (
        <textarea
          value={draft.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          rows={2}
          placeholder={emphasis === "empty" ? "(empty — type your answer)" : ""}
          style={{
            width: "100%", padding: "6px 9px", fontSize: "0.85rem",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
            resize: "vertical", fontFamily: "inherit",
          }}
        />
      ) : (
        <input
          type="text"
          value={draft.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={emphasis === "empty" ? "(empty — type your answer)" : ""}
          style={{
            width: "100%", padding: "6px 9px", fontSize: "0.85rem",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
          }}
        />
      )}
      {draft.questionVariants.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: "pointer", fontSize: "0.68rem", color: "var(--text-dim)", userSelect: "none" }}>
            ▸ Question variants the matcher knows
          </summary>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {draft.questionVariants.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
