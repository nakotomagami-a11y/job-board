import { describe, it, expect } from "vitest";
import { fingerprintQuestion, normalizeQuestion } from "./normalize";

describe("normalizeQuestion", () => {
  it("lowercases and strips required marker", () => {
    expect(normalizeQuestion("Full Name *")).toBe("full name");
  });

  it("strips parentheticals", () => {
    expect(normalizeQuestion("Phone (mobile preferred)")).toBe("phone");
  });

  it("normalizes smart quotes", () => {
    expect(normalizeQuestion("What’s your name?")).toBe("what's your name");
  });

  it("collapses whitespace and punctuation", () => {
    expect(normalizeQuestion("  E-mail   address?? ")).toBe("e mail address");
  });
});

describe("fingerprintQuestion", () => {
  it("includes fieldType so same label across types differs", () => {
    expect(fingerprintQuestion("Email", "email")).not.toBe(
      fingerprintQuestion("Email", "text"),
    );
  });

  it("is stable across casing/whitespace", () => {
    expect(fingerprintQuestion("Full Name *", "text")).toBe(
      fingerprintQuestion("  full name  ", "text"),
    );
  });
});
