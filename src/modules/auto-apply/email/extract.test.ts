import { describe, it, expect } from "vitest";
import { commonHiringPatterns, companyDomainFromUrl, extractEmailsFromText, gatherCandidates } from "./extract";

describe("extractEmailsFromText", () => {
  it("pulls emails out of free text", () => {
    const r = extractEmailsFromText(
      "Send your CV to careers@acme.com or jane@acme.com — we reply fast.",
      "jd",
    );
    expect(r.map((c) => c.email).sort()).toEqual(["careers@acme.com", "jane@acme.com"]);
  });

  it("flags hiring-style addresses as high confidence", () => {
    const r = extractEmailsFromText("Apply at jobs@acme.com", "jd");
    expect(r[0].confidence).toBe("high");
  });

  it("filters obvious noise (example.com, no-reply)", () => {
    const r = extractEmailsFromText(
      "Email noreply@example.com or support@example.org — both bounce",
      "jd",
    );
    expect(r.length).toBe(0);
  });

  it("returns medium confidence for personal-looking addresses", () => {
    const r = extractEmailsFromText("contact: john.doe@acme.com", "jd");
    expect(r[0].confidence).toBe("medium");
  });
});

describe("commonHiringPatterns", () => {
  it("generates low-confidence common-pattern candidates", () => {
    const r = commonHiringPatterns("acme.com");
    expect(r.length).toBeGreaterThan(3);
    expect(r.every((c) => c.confidence === "low")).toBe(true);
    expect(r.every((c) => c.email.endsWith("@acme.com"))).toBe(true);
  });
});

describe("companyDomainFromUrl", () => {
  it("returns the company host", () => {
    expect(companyDomainFromUrl("https://www.acme.com/careers/eng")).toBe("acme.com");
  });

  it("returns null for ATS hosts", () => {
    expect(companyDomainFromUrl("https://boards.greenhouse.io/acme/jobs/123")).toBe(null);
    expect(companyDomainFromUrl("https://jobs.lever.co/acme/abc")).toBe(null);
  });
});

describe("gatherCandidates", () => {
  it("orders by confidence and dedupes", () => {
    const r = gatherCandidates({
      jdText: "Send to careers@acme.com or john@acme.com",
      pageText: "Mailto careers@acme.com",
      companyDomain: "acme.com",
    });
    // High-confidence careers@ first, dedup'd despite appearing in both.
    expect(r[0].email).toBe("careers@acme.com");
    expect(r[0].confidence).toBe("high");
    const emails = r.map((c) => c.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});
