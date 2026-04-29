export type BlockerKind =
  | "login-wall"
  | "captcha"
  | "account-required"
  | "paywall"
  | "not-found"
  | "no-application-form"
  | "external-redirect"
  | "geo-block";

export interface BlockerDetection {
  kind: BlockerKind;
  evidence: string;
}

export interface PageSignals {
  url: string;
  title?: string;
  bodyText?: string;
  hasPasswordInput?: boolean;
  hasCaptchaIframe?: boolean;
  hasFormFields?: boolean;
  hasFileInput?: boolean;
  redirectedTo?: string;
  statusCode?: number;
}

const LOGIN_WORDS = /(sign in|log in|please log in|create an account|register to apply|login required)/i;
const CAPTCHA_WORDS = /(captcha|are you human|verify you('re| are) human|i'm not a robot|cloudflare|please complete the security check)/i;
const ACCOUNT_WORDS = /(create.*account.*to apply|create.*profile.*to apply|register.*to apply|sign up to apply)/i;
const PAYWALL_WORDS = /(subscribe to (read|view|see)|paywall|premium members only|paid subscription required)/i;
const GEOBLOCK_WORDS = /(not available in your (country|region)|geographic restriction|geo restricted)/i;

export function detectBlockers(signals: PageSignals): BlockerDetection[] {
  const out: BlockerDetection[] = [];
  const body = signals.bodyText ?? "";
  const title = signals.title ?? "";

  if (signals.statusCode === 404 || /\b404\b|page not found|posting (no longer|not) available|this job has expired/i.test(body) || /404|not found/i.test(title)) {
    out.push({ kind: "not-found", evidence: "404 / posting expired" });
  }

  if (signals.hasCaptchaIframe || CAPTCHA_WORDS.test(body) || CAPTCHA_WORDS.test(title)) {
    out.push({ kind: "captcha", evidence: "captcha indicator detected" });
  }

  if (signals.hasPasswordInput && !signals.hasFileInput) {
    out.push({ kind: "login-wall", evidence: "password field present without application form" });
  } else if (LOGIN_WORDS.test(body) && !signals.hasFormFields) {
    out.push({ kind: "login-wall", evidence: "login copy without form" });
  }

  if (ACCOUNT_WORDS.test(body)) {
    out.push({ kind: "account-required", evidence: "account creation required to apply" });
  }

  if (PAYWALL_WORDS.test(body)) {
    out.push({ kind: "paywall", evidence: "paywall copy" });
  }

  if (GEOBLOCK_WORDS.test(body)) {
    out.push({ kind: "geo-block", evidence: "geographic restriction copy" });
  }

  if (signals.redirectedTo && !signals.hasFormFields) {
    try {
      const from = new URL(signals.url).hostname;
      const to = new URL(signals.redirectedTo).hostname;
      if (from !== to) {
        out.push({ kind: "external-redirect", evidence: `redirect from ${from} to ${to}` });
      }
    } catch {
      // ignore malformed urls
    }
  }

  if (!signals.hasFormFields && !out.length) {
    out.push({ kind: "no-application-form", evidence: "no detectable application form on page" });
  }

  // Dedupe by kind
  const seen = new Set<string>();
  return out.filter((b) => {
    if (seen.has(b.kind)) return false;
    seen.add(b.kind);
    return true;
  });
}

export function shouldFallbackToEmail(blockers: BlockerDetection[]): boolean {
  return blockers.some((b) =>
    ["login-wall", "account-required", "paywall", "captcha", "no-application-form", "external-redirect"].includes(b.kind),
  );
}
