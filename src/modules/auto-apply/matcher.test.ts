import { describe, it, expect } from "vitest";
import type { UserProfile } from "@shared/types/profile";
import { matchField } from "./matcher";
import { seedAnswerBank } from "./seed";
import { EMPTY_BANK, type AnswerBank, type AnswerEntry } from "./types";
import { fingerprintQuestion } from "./normalize";

const profile: UserProfile = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  location: "London",
  remotePreference: "remote",
  preferredRegions: [],
  preferredRoles: [],
  preferredSeniority: [],
  preferredCategories: [],
  skills: [],
  onboardingComplete: true,
  createdAt: "",
  updatedAt: "",
};

const ctx = { profile, cvAnalysis: null };

function bankFrom(extra: AnswerEntry[] = []): AnswerBank {
  const seeded = seedAnswerBank(EMPTY_BANK, { profile, cvAnalysis: null });
  return { ...seeded, entries: [...seeded.entries, ...extra] };
}

describe("matchField — seeded profile fields", () => {
  it("resolves email from seeded entry (Tier 1)", () => {
    const bank = bankFrom();
    const result = matchField({ label: "Email", fieldType: "email" }, bank, ctx);
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.entry.value).toEqual({ kind: "text", text: "ada@example.com" });
    }
  });

  it("resolves first name via intent rule when fingerprint differs", () => {
    const bank = bankFrom();
    const result = matchField(
      { label: "Given name", fieldType: "text" },
      bank,
      ctx,
    );
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.entry.intentTag).toBe("name.first");
      expect(result.entry.value).toEqual({ kind: "text", text: "Ada" });
    }
  });
});

describe("matchField — unknown handling", () => {
  it("returns unknown when no rule and no fingerprint", () => {
    const bank = bankFrom();
    const result = matchField(
      { label: "What is your favorite color?", fieldType: "text" },
      bank,
      ctx,
    );
    expect(result.status).toBe("unknown");
  });

  it("returns unknown when intent matches but profile lacks data", () => {
    const bareProfile = { ...profile, email: undefined };
    const bank = seedAnswerBank(EMPTY_BANK, { profile: bareProfile, cvAnalysis: null });
    const result = matchField(
      { label: "Email", fieldType: "email" },
      bank,
      { profile: bareProfile, cvAnalysis: null },
    );
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.intentTag).toBe("email");
    }
  });
});

describe("matchField — always-ask", () => {
  it("flags free-text textarea as alwaysAsk", () => {
    const bank = bankFrom();
    const result = matchField(
      { label: "Why do you want to work here?", fieldType: "textarea" },
      bank,
      ctx,
    );
    expect(result.status).toBe("alwaysAsk");
  });

  it("flags EEO gender as alwaysAsk", () => {
    const bank = bankFrom();
    const result = matchField(
      { label: "Gender", fieldType: "select", options: ["Male", "Female", "Decline"] },
      bank,
      ctx,
    );
    expect(result.status).toBe("alwaysAsk");
  });

  it("flags salary expectation as alwaysAsk even when seeded", () => {
    const profileWithSalary = {
      ...profile,
      salaryRange: { min: 100, max: 120, currency: "USD" },
    };
    const bank = seedAnswerBank(EMPTY_BANK, { profile: profileWithSalary, cvAnalysis: null });
    const result = matchField(
      { label: "Salary expectation", fieldType: "text" },
      bank,
      { profile: profileWithSalary, cvAnalysis: null },
    );
    expect(result.status).toBe("alwaysAsk");
  });

  it("flags legal acknowledgement as alwaysAsk", () => {
    const bank = bankFrom();
    const result = matchField(
      { label: "I acknowledge the candidate privacy notice", fieldType: "checkbox" },
      bank,
      ctx,
    );
    expect(result.status).toBe("alwaysAsk");
  });
});

describe("matchField — option mismatch on dropdowns", () => {
  it("returns unknown when saved value is not in options", () => {
    const seededBank = bankFrom();
    const customEntry: AnswerEntry = {
      id: "test:country",
      fingerprint: fingerprintQuestion("country", "select"),
      intentTag: "location.country",
      scope: "global",
      fieldType: "select",
      value: { kind: "choice", choice: "United States" },
      source: "user",
      createdAt: "",
      updatedAt: "",
      useCount: 0,
    };
    const bank: AnswerBank = { ...seededBank, entries: [...seededBank.entries, customEntry] };
    const result = matchField(
      { label: "Country", fieldType: "select", options: ["USA", "UK", "Germany"] },
      bank,
      ctx,
    );
    expect(result.status).toBe("unknown");
  });

  it("uses normalization rule when present", () => {
    const seededBank = bankFrom();
    const customEntry: AnswerEntry = {
      id: "test:country",
      fingerprint: fingerprintQuestion("country", "select"),
      intentTag: "location.country",
      scope: "global",
      fieldType: "select",
      value: { kind: "choice", choice: "United States" },
      source: "user",
      createdAt: "",
      updatedAt: "",
      useCount: 0,
    };
    const bank: AnswerBank = {
      ...seededBank,
      entries: [...seededBank.entries, customEntry],
      normalizations: [
        {
          fieldType: "select",
          intentTag: "location.country",
          from: "United States",
          to: "USA",
          createdAt: "",
        },
      ],
    };
    const result = matchField(
      { label: "Country", fieldType: "select", options: ["USA", "UK", "Germany"] },
      bank,
      ctx,
    );
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.normalizedTo).toBe("USA");
    }
  });
});

describe("matchField — ambiguity", () => {
  it("returns ambiguous when two distinct global answers share a fingerprint", () => {
    const seededBank = bankFrom();
    const fp = fingerprintQuestion("notice period", "text");
    const a: AnswerEntry = {
      id: "a",
      fingerprint: fp,
      intentTag: "noticePeriod",
      scope: "global",
      fieldType: "text",
      value: { kind: "text", text: "2 weeks" },
      source: "user",
      createdAt: "",
      updatedAt: "",
      useCount: 0,
    };
    const b: AnswerEntry = { ...a, id: "b", value: { kind: "text", text: "1 month" } };
    const bank: AnswerBank = { ...seededBank, entries: [...seededBank.entries, a, b] };
    const result = matchField(
      { label: "Notice period", fieldType: "text" },
      bank,
      ctx,
    );
    expect(result.status).toBe("ambiguous");
  });
});

describe("matchField — scope precedence", () => {
  it("prefers per-company over global", () => {
    const seededBank = bankFrom();
    const fp = fingerprintQuestion("notice period", "text");
    const globalEntry: AnswerEntry = {
      id: "g",
      fingerprint: fp,
      intentTag: "noticePeriod",
      scope: "global",
      fieldType: "text",
      value: { kind: "text", text: "2 weeks" },
      source: "user",
      createdAt: "",
      updatedAt: "",
      useCount: 0,
    };
    const perCompany: AnswerEntry = {
      ...globalEntry,
      id: "c",
      scope: "perCompany",
      scopeKey: "Acme",
      value: { kind: "text", text: "immediate" },
    };
    const bank: AnswerBank = {
      ...seededBank,
      entries: [...seededBank.entries, globalEntry, perCompany],
    };
    const result = matchField(
      { label: "Notice period", fieldType: "text", company: "Acme" },
      bank,
      ctx,
    );
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.entry.value).toEqual({ kind: "text", text: "immediate" });
    }
  });
});
