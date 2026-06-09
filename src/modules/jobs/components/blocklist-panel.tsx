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
      <div className="p-5 bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.25)] rounded-card mb-5 text-center text-[0.85rem] text-text-dim">
        Loading blocklist...
      </div>
    );
  }

  return (
    <section className="mb-6 px-5 py-4 bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.25)] rounded-card">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <span className="text-[0.95rem] font-bold text-danger">
          Blocked Companies
        </span>
        <span className="bg-[rgba(248,113,113,0.15)] text-danger rounded-pill px-2 py-[1px] text-[0.72rem] font-semibold">
          {data.count} blocked
        </span>
        {data.updatedAt && (
          <span className="ml-auto text-[0.7rem] text-text-dim">
            Updated {new Date(data.updatedAt).toLocaleString()}
          </span>
        )}
        <button className="filter-btn text-[0.72rem] px-2.5 py-1" onClick={onClose}>
          Close
        </button>
      </div>

      {addMsg && (
        <div className={`mb-3 px-3 py-2 rounded-sm text-[0.82rem] border ${addState === "err" ? "bg-[rgba(248,113,113,0.08)] text-danger border-[rgba(248,113,113,0.2)]" : "bg-[rgba(52,211,153,0.08)] text-secondary border-[rgba(52,211,153,0.2)]"}`}>
          {addMsg}
        </div>
      )}

      {data.companies.length === 0 ? (
        <div className="py-5 text-center text-[0.82rem] text-text-dim">
          No companies blocked yet. Add a company below to prevent its jobs from appearing.
        </div>
      ) : (
        <ul className="list-none m-0 mb-4 p-0 flex flex-col gap-1.5">
          {data.companies.map((company) => (
            <li key={company} className="flex items-center justify-between px-3 py-2 rounded-sm bg-surface border border-border">
              <span className="text-[0.85rem] text-text-base">{company}</span>
              {confirmRemove === company ? (
                <div className="flex gap-1.5 items-center">
                  <span className="text-[0.72rem] text-text-dim">Remove?</span>
                  <button
                    onClick={() => handleRemove(company)}
                    disabled={removeState === "loading"}
                    className="text-[0.72rem] px-2 py-[3px] cursor-pointer bg-[rgba(248,113,113,0.15)] border border-[rgba(248,113,113,0.35)] text-danger rounded-sm"
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setConfirmRemove(null)}
                    className="text-[0.72rem] px-2 py-[3px] cursor-pointer bg-surface border border-border text-text-dim rounded-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(company)}
                  title={`Remove ${company} from blocklist`}
                  className="bg-transparent border-none cursor-pointer text-text-dim text-base leading-none px-1.5 py-[2px]"
                >
                  x
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Company name..."
          className="flex-1 px-2.5 py-[7px] text-[0.85rem] bg-surface border border-border rounded-sm text-text-base"
        />
        <button
          className={`apply-btn px-3.5 py-[7px] text-[0.82rem] bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-danger ${addState === "loading" || !addInput.trim() ? "opacity-50" : ""}`}
          onClick={handleAdd}
          disabled={addState === "loading" || !addInput.trim()}
        >
          {addState === "loading" ? "..." : "Block"}
        </button>
      </div>
      <div className="mt-2 text-[0.7rem] text-text-dim">
        Adding a company blocks all current and future jobs from it. Removal does not un-reject past jobs.
      </div>
    </section>
  );
}
