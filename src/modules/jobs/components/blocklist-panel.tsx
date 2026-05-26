"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@lib/constants";

interface BlocklistPanelProps {
  onClose: () => void;
}

interface BlocklistData {
  companies: string[];
  count: number;
  updatedAt: string | null;
}

export function BlocklistPanel({ onClose }: BlocklistPanelProps) {
  const [data, setData] = useState<BlocklistData | null>(null);
  const [addInput, setAddInput] = useState("");
  const [addState, setAddState] = useState<"idle" | "loading" | "done" | "err">("idle");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removeState, setRemoveState] = useState<"idle" | "loading">("idle");

  const load = useCallback(async () => {
    try {
      const res = await fetch(API.blocklist);
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData((await res.json()) as BlocklistData);
    } catch {
      setData({ companies: [], count: 0, updatedAt: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const name = addInput.trim();
    if (!name) return;
    setAddState("loading");
    setAddMsg(null);
    try {
      const res = await fetch(API.blocklist, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: name, retroactive: true }),
      });
      const body = (await res.json()) as {
        added?: boolean;
        alreadyPresent?: boolean;
        retroactiveCount?: number;
        error?: string;
      };
      if (res.ok) {
        if (body.alreadyPresent) {
          setAddState("done");
          setAddMsg(`${name} is already on the blocklist`);
        } else {
          setAddState("done");
          const n = body.retroactiveCount ?? 0;
          setAddMsg(`Added ${name} - ${n} existing job${n !== 1 ? "s" : ""} hidden`);
          setAddInput("");
          await load();
        }
      } else {
        setAddState("err");
        setAddMsg(body.error ?? "Failed to add");
      }
    } catch (e) {
      setAddState("err");
      setAddMsg(e instanceof Error ? e.message : "Failed");
    }
    setTimeout(() => { setAddState("idle"); setAddMsg(null); }, 5000);
  };

  const handleRemove = async (company: string) => {
    setRemoveState("loading");
    try {
      await fetch(API.blocklist, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });
      await load();
    } finally {
      setRemoveState("idle");
      setConfirmRemove(null);
    }
  };

  if (!data) {
    return (
      <div style={{
        padding: 20, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)",
        borderRadius: "var(--radius)", marginBottom: 20, textAlign: "center", fontSize: "0.85rem", color: "var(--text-dim)",
      }}>
        Loading blocklist...
      </div>
    );
  }

  return (
    <section style={{
      margin: "0 0 24px", padding: "16px 20px",
      background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)",
      borderRadius: "var(--radius)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f87171" }}>
          Blocked Companies
        </span>
        <span style={{
          background: "rgba(248,113,113,0.15)", color: "#f87171",
          borderRadius: "var(--radius-pill)", padding: "1px 8px",
          fontSize: "0.72rem", fontWeight: 600,
        }}>
          {data.count} blocked
        </span>
        {data.updatedAt && (
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Updated {new Date(data.updatedAt).toLocaleString()}
          </span>
        )}
        <button className="filter-btn" onClick={onClose} style={{ fontSize: "0.72rem", padding: "4px 10px" }}>
          Close
        </button>
      </div>

      {addMsg && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.82rem",
          background: addState === "err" ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)",
          color: addState === "err" ? "#f87171" : "var(--c-secondary)",
          border: `1px solid ${addState === "err" ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`,
        }}>
          {addMsg}
        </div>
      )}

      {data.companies.length === 0 ? (
        <div style={{
          padding: "20px 0", textAlign: "center", fontSize: "0.82rem", color: "var(--text-dim)",
        }}>
          No companies blocked yet. Add a company below to prevent its jobs from appearing.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {data.companies.map((company) => (
            <li key={company} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: "var(--radius-sm)",
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>{company}</span>
              {confirmRemove === company ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Remove?</span>
                  <button
                    onClick={() => handleRemove(company)}
                    disabled={removeState === "loading"}
                    style={{
                      fontSize: "0.72rem", padding: "3px 8px", cursor: "pointer",
                      background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)",
                      color: "#f87171", borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setConfirmRemove(null)}
                    style={{
                      fontSize: "0.72rem", padding: "3px 8px", cursor: "pointer",
                      background: "var(--surface)", border: "1px solid var(--border)",
                      color: "var(--text-dim)", borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(company)}
                  title={`Remove ${company} from blocklist`}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-dim)", fontSize: "1rem", lineHeight: 1, padding: "2px 6px",
                  }}
                >
                  x
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Company name..."
          style={{
            flex: 1, padding: "7px 10px", fontSize: "0.85rem",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
          }}
        />
        <button
          className="apply-btn"
          onClick={handleAdd}
          disabled={addState === "loading" || !addInput.trim()}
          style={{
            padding: "7px 14px", fontSize: "0.82rem",
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#f87171",
            opacity: addState === "loading" || !addInput.trim() ? 0.5 : 1,
          }}
        >
          {addState === "loading" ? "..." : "Block"}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text-dim)" }}>
        Adding a company blocks all current and future jobs from it. Removal does not un-reject past jobs.
      </div>
    </section>
  );
}
