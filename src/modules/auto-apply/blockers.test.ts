import { describe, it, expect } from "vitest";
import { detectBlockers, shouldFallbackToEmail } from "./blockers";

describe("detectBlockers", () => {
  it("flags 404 / expired postings", () => {
    const r = detectBlockers({
      url: "https://example.com/jobs/123",
      statusCode: 404,
      bodyText: "Page not found",
    });
    expect(r.some((b) => b.kind === "not-found")).toBe(true);
  });

  it("flags captcha by iframe presence", () => {
    const r = detectBlockers({
      url: "https://example.com/apply",
      hasCaptchaIframe: true,
      hasFormFields: true,
    });
    expect(r.some((b) => b.kind === "captcha")).toBe(true);
  });

  it("flags captcha by body copy", () => {
    const r = detectBlockers({
      url: "https://example.com/apply",
      bodyText: "Please complete the security check to continue.",
      hasFormFields: true,
    });
    expect(r.some((b) => b.kind === "captcha")).toBe(true);
  });

  it("flags login wall when password input present without file input", () => {
    const r = detectBlockers({
      url: "https://example.com/apply",
      hasPasswordInput: true,
      hasFileInput: false,
    });
    expect(r.some((b) => b.kind === "login-wall")).toBe(true);
  });

  it("flags account creation requirement", () => {
    const r = detectBlockers({
      url: "https://example.com/apply",
      bodyText: "Create an account to apply for this position",
      hasFormFields: true,
    });
    expect(r.some((b) => b.kind === "account-required")).toBe(true);
  });

  it("flags external redirect away from posting domain", () => {
    const r = detectBlockers({
      url: "https://example.com/jobs/123",
      redirectedTo: "https://workday.acme.com/account/create",
      hasFormFields: false,
    });
    expect(r.some((b) => b.kind === "external-redirect")).toBe(true);
  });

  it("flags no-application-form when nothing else matches", () => {
    const r = detectBlockers({
      url: "https://example.com/job",
      hasFormFields: false,
    });
    expect(r.some((b) => b.kind === "no-application-form")).toBe(true);
  });

  it("does not flag clean Greenhouse-style page", () => {
    const r = detectBlockers({
      url: "https://boards.greenhouse.io/acme/jobs/123",
      hasFormFields: true,
      hasFileInput: true,
      bodyText: "Apply for this Job",
    });
    expect(r.length).toBe(0);
  });
});

describe("shouldFallbackToEmail", () => {
  it("returns true for login walls and captchas", () => {
    expect(shouldFallbackToEmail([{ kind: "login-wall", evidence: "" }])).toBe(true);
    expect(shouldFallbackToEmail([{ kind: "captcha", evidence: "" }])).toBe(true);
    expect(shouldFallbackToEmail([{ kind: "account-required", evidence: "" }])).toBe(true);
  });

  it("returns false for not-found (no point emailing about a dead posting)", () => {
    expect(shouldFallbackToEmail([{ kind: "not-found", evidence: "" }])).toBe(false);
  });
});
