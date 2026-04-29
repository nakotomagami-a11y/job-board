// Email candidate extraction. Deterministic — no guessing of personal addresses.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const NOISE_DOMAINS = new Set([
  "example.com",
  "example.org",
  "domain.com",
  "company.com",
  "yourcompany.com",
  "sentry.io",
  "wixpress.com",
  "google-analytics.com",
  "googletagmanager.com",
  "fontawesome.com",
  "schema.org",
  "w3.org",
]);

const NOISE_LOCAL = new Set(["noreply", "no-reply", "donotreply", "do-not-reply", "support@example"]);

export interface EmailCandidate {
  email: string;
  source: "jd" | "page" | "common-pattern";
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function extractEmailsFromText(text: string, source: "jd" | "page"): EmailCandidate[] {
  if (!text) return [];
  const matches = Array.from(new Set(text.match(EMAIL_RE) ?? []));
  return matches
    .map((email) => email.toLowerCase())
    .filter((email) => {
      const [local, domain] = email.split("@");
      if (!local || !domain) return false;
      if (NOISE_DOMAINS.has(domain)) return false;
      if (NOISE_LOCAL.has(local)) return false;
      return true;
    })
    .map((email) => {
      const local = email.split("@")[0];
      const isHiring = /^(careers?|jobs?|hiring|recruiting|recruitment|talent|apply|hr|people)$/.test(local);
      return {
        email,
        source,
        confidence: isHiring ? "high" : "medium",
        reason: isHiring ? `hiring-style address found in ${source}` : `email found in ${source}`,
      } satisfies EmailCandidate;
    });
}

const COMMON_HIRING_LOCALS = ["careers", "jobs", "hiring", "talent", "recruiting", "hr", "apply"];

/**
 * Build common-hiring-pattern candidates at a company domain. These are
 * SUGGESTIONS only — never used without explicit user confirmation.
 */
export function commonHiringPatterns(companyDomain: string): EmailCandidate[] {
  if (!companyDomain) return [];
  const domain = companyDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  return COMMON_HIRING_LOCALS.map((local) => ({
    email: `${local}@${domain}`,
    source: "common-pattern" as const,
    confidence: "low" as const,
    reason: `common hiring address pattern at ${domain}`,
  }));
}

export function gatherCandidates(input: {
  jdText?: string;
  pageText?: string;
  companyDomain?: string;
}): EmailCandidate[] {
  const out: EmailCandidate[] = [];
  if (input.jdText) out.push(...extractEmailsFromText(input.jdText, "jd"));
  if (input.pageText) out.push(...extractEmailsFromText(input.pageText, "page"));
  if (input.companyDomain) out.push(...commonHiringPatterns(input.companyDomain));
  // Dedup by address, prefer higher confidence first.
  const order = { high: 0, medium: 1, low: 2 } as const;
  out.sort((a, b) => order[a.confidence] - order[b.confidence]);
  const seen = new Set<string>();
  return out.filter((c) => {
    if (seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });
}

export function companyDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // Strip ATS hosts so we don't pattern jobs@boards.greenhouse.io
    const atsHosts = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com", "myworkdayjobs.com", "jobs.lever.co", "boards.greenhouse.io", "linkedin.com", "indeed.com"];
    if (atsHosts.some((a) => host.endsWith(a))) return null;
    return host;
  } catch {
    return null;
  }
}
