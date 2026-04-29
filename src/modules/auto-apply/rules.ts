import type { UserProfile } from "@shared/types/profile";
import type { AnswerValue, FieldType } from "./types";

export interface ResolveCtx {
  profile: UserProfile | null;
  cvAnalysis: Record<string, unknown> | null;
}

export interface IntentRule {
  tag: string;
  fieldTypes?: FieldType[];
  patterns: RegExp[];
  alwaysAsk?: boolean;
  reviewEveryTime?: boolean;
  resolve?: (ctx: ResolveCtx) => AnswerValue | null;
}

const txt = (s: string | undefined | null): AnswerValue | null =>
  s && s.trim() ? { kind: "text", text: s.trim() } : null;

export const INTENT_RULES: IntentRule[] = [
  {
    tag: "name.full",
    fieldTypes: ["text"],
    patterns: [/^full name$/, /^name$/, /^your name$/, /^legal name$/],
    resolve: ({ profile }) => txt(profile?.name),
  },
  {
    tag: "name.first",
    fieldTypes: ["text"],
    patterns: [/^first name$/, /^given name$/, /^forename$/],
    resolve: ({ profile }) => {
      const parts = profile?.name?.trim().split(/\s+/);
      return parts && parts.length > 0 ? txt(parts[0]) : null;
    },
  },
  {
    tag: "name.last",
    fieldTypes: ["text"],
    patterns: [/^last name$/, /^family name$/, /^surname$/],
    resolve: ({ profile }) => {
      const parts = profile?.name?.trim().split(/\s+/);
      return parts && parts.length > 1 ? txt(parts.slice(1).join(" ")) : null;
    },
  },
  {
    tag: "email",
    fieldTypes: ["email", "text"],
    patterns: [/^email( address)?$/, /^e mail$/],
    resolve: ({ profile }) => txt(profile?.email),
  },
  {
    tag: "phone",
    fieldTypes: ["tel", "text"],
    patterns: [/^phone( number)?$/, /^mobile( number)?$/, /^cell$/, /^contact number$/],
    resolve: ({ profile }) => txt(profile?.phone),
  },
  {
    tag: "location.city",
    fieldTypes: ["text"],
    patterns: [/^city$/, /^current city$/, /^city of residence$/],
    resolve: ({ profile }) => txt(profile?.location),
  },
  {
    tag: "location.country",
    fieldTypes: ["text", "select"],
    patterns: [/^country$/, /^country of residence$/, /^current country$/],
  },
  {
    tag: "links.linkedin",
    fieldTypes: ["url", "text"],
    patterns: [/linkedin/, /linked in/],
    resolve: ({ profile }) => txt(profile?.linkedinUrl),
  },
  {
    tag: "links.github",
    fieldTypes: ["url", "text"],
    patterns: [/^github$/, /github (profile|url|link)/],
    resolve: ({ profile }) => txt(profile?.githubUrl),
  },
  {
    tag: "links.portfolio",
    fieldTypes: ["url", "text"],
    patterns: [/^portfolio$/, /portfolio (url|link|website)/, /personal website/, /^website$/],
    resolve: ({ profile }) => txt(profile?.websiteUrl),
  },
  {
    tag: "workAuth.authorized",
    fieldTypes: ["radio", "select", "checkbox"],
    patterns: [
      /authori[sz]ed to work/,
      /legally (authori[sz]ed|allowed) to work/,
      /right to work/,
      /eligible to work/,
    ],
  },
  {
    tag: "workAuth.sponsorship",
    fieldTypes: ["radio", "select", "checkbox"],
    patterns: [
      /require .*sponsor/,
      /need .*sponsor/,
      /visa sponsor/,
      /immigration support/,
      /will you (now|in the future) require sponsor/,
    ],
  },
  {
    tag: "salary.expectation",
    reviewEveryTime: true,
    patterns: [
      /salary (expectation|requirement|range)/,
      /expected salary/,
      /compensation expectation/,
      /desired (salary|compensation|pay)/,
    ],
  },
  {
    tag: "noticePeriod",
    patterns: [/notice period/, /how soon can you (start|join)/, /availability to start/],
  },
  {
    tag: "relocate",
    fieldTypes: ["radio", "select", "checkbox"],
    patterns: [/willing to relocate/, /open to relocation/],
  },
  {
    tag: "remote.preference",
    patterns: [/remote (preference|work preference)/, /work (location|arrangement) preference/],
  },
  {
    tag: "cv.upload",
    fieldTypes: ["file"],
    patterns: [/resume/, /^cv$/, /curriculum vitae/],
    resolve: ({ profile }) =>
      profile?.cvPath ? { kind: "file", assetPath: profile.cvPath } : null,
  },
  // Always-ask: legal / EEO categories. Never auto-resolve.
  {
    tag: "eeo.gender",
    alwaysAsk: true,
    patterns: [/^gender$/, /gender identity/],
  },
  {
    tag: "eeo.ethnicity",
    alwaysAsk: true,
    patterns: [/race\/ethnicity/, /^ethnicity$/, /^race$/, /hispanic or latino/],
  },
  {
    tag: "eeo.veteran",
    alwaysAsk: true,
    patterns: [/veteran status/, /protected veteran/],
  },
  {
    tag: "eeo.disability",
    alwaysAsk: true,
    patterns: [/disability status/, /^disabled$/, /form cc 305/],
  },
  {
    tag: "legal.ack",
    alwaysAsk: true,
    patterns: [
      /privacy (policy|notice)/,
      /terms and conditions/,
      /i (acknowledge|consent|agree) to/,
      /candidate privacy/,
    ],
  },
];

export function matchIntent(
  normalizedLabel: string,
  fieldType: FieldType,
): IntentRule | null {
  for (const rule of INTENT_RULES) {
    if (rule.fieldTypes && !rule.fieldTypes.includes(fieldType)) continue;
    if (rule.patterns.some((p) => p.test(normalizedLabel))) return rule;
  }
  return null;
}
