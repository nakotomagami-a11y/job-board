import { describe, it, expect } from "vitest";
import { isBlocked, type Blocklist } from "./company-blocklist";

function makeList(companies: string[]): Blocklist {
  return { version: 1, updatedAt: null, companies };
}

describe("isBlocked - exact and case-insensitive", () => {
  it("matches exact entry", () => {
    expect(isBlocked("Revolut", makeList(["Revolut"]))).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isBlocked("revolut", makeList(["Revolut"]))).toBe(true);
    expect(isBlocked("REVOLUT", makeList(["Revolut"]))).toBe(true);
  });

  it("matches entry stored in different case", () => {
    expect(isBlocked("Toptal", makeList(["toptal"]))).toBe(true);
  });

  it("matches company name with suffix (Revolut Bank)", () => {
    expect(isBlocked("Revolut Bank", makeList(["Revolut"]))).toBe(true);
  });

  it("matches company name with suffix (Revolut Ltd)", () => {
    expect(isBlocked("Revolut Ltd", makeList(["Revolut"]))).toBe(true);
  });

  it("does NOT match partial substring without word boundary (Revolutionary != Revolut)", () => {
    expect(isBlocked("Revolutionary Robotics", makeList(["Revolut"]))).toBe(false);
  });

  it("does NOT match when entry is a partial stem (Revo != Revolut)", () => {
    expect(isBlocked("Revolut", makeList(["Revo"]))).toBe(false);
  });

  it("returns false for empty company name", () => {
    expect(isBlocked("", makeList(["Revolut"]))).toBe(false);
  });

  it("returns false for whitespace-only company name", () => {
    expect(isBlocked("   ", makeList(["Revolut"]))).toBe(false);
  });

  it("returns false when blocklist is empty", () => {
    expect(isBlocked("Revolut", makeList([]))).toBe(false);
  });

  it("matches one of several blocklist entries", () => {
    const list = makeList(["Revolut", "Toptal", "Intercom"]);
    expect(isBlocked("Intercom", list)).toBe(true);
    expect(isBlocked("Toptal Inc", list)).toBe(true);
  });

  it("handles leading/trailing whitespace in company name", () => {
    expect(isBlocked("  Revolut  ", makeList(["Revolut"]))).toBe(true);
  });
});
