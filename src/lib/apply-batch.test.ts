import { describe, it, expect } from "vitest";
import { isActiveBatch } from "./apply-batch";
import type { ApplyBatch } from "./apply-batch";

function makeBatch(overrides: Partial<ApplyBatch> = {}): ApplyBatch {
  return {
    batchId: "test-id",
    jobIds: ["a", "b", "c"],
    currentIndex: 0,
    completedIds: [],
    status: "active",
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("isActiveBatch", () => {
  it("returns false for null", () => {
    expect(isActiveBatch(null)).toBe(false);
  });

  it("returns false when status is cancelled", () => {
    expect(isActiveBatch(makeBatch({ status: "cancelled" }))).toBe(false);
  });

  it("returns false when status is completed", () => {
    expect(isActiveBatch(makeBatch({ status: "completed" }))).toBe(false);
  });

  it("returns true when active and currentIndex < jobIds.length", () => {
    expect(isActiveBatch(makeBatch())).toBe(true);
  });

  it("returns false when currentIndex equals jobIds.length (exhausted)", () => {
    expect(isActiveBatch(makeBatch({ currentIndex: 3 }))).toBe(false);
  });

  it("returns false when currentIndex exceeds jobIds.length", () => {
    expect(isActiveBatch(makeBatch({ currentIndex: 5 }))).toBe(false);
  });

  it("returns true with currentIndex at last valid position", () => {
    expect(isActiveBatch(makeBatch({ currentIndex: 2 }))).toBe(true);
  });
});
