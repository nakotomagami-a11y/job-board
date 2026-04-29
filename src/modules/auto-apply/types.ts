export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "checkboxGroup"
  | "file"
  | "date";

export type AnswerScope = "global" | "perAts" | "perCompany" | "oneTime";

export type AnswerValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "boolean"; boolean: boolean }
  | { kind: "choice"; choice: string }
  | { kind: "choices"; choices: string[] }
  | { kind: "file"; assetPath: string };

export type AnswerSource = "profile" | "cv-analysis" | "user" | "rule";

export interface AnswerEntry {
  id: string;
  fingerprint: string;
  intentTag?: string;
  scope: AnswerScope;
  scopeKey?: string;
  fieldType: FieldType;
  value: AnswerValue;
  source: AnswerSource;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  useCount: number;
  reviewEveryTime?: boolean;
}

export interface NormalizationRule {
  fieldType: FieldType;
  ats?: string;
  intentTag?: string;
  from: string;
  to: string;
  createdAt: string;
}

export interface AnswerBank {
  version: 1;
  entries: AnswerEntry[];
  normalizations: NormalizationRule[];
  updatedAt: string;
}

export interface MatchInput {
  label: string;
  fieldType: FieldType;
  options?: string[];
  required?: boolean;
  ats?: string;
  company?: string;
}

export type MatchStatus =
  | "matched"
  | "ambiguous"
  | "unknown"
  | "alwaysAsk";

export type MatchResult =
  | {
      status: "matched";
      entry: AnswerEntry;
      tier: 1 | 2;
      needsConfirm?: boolean;
      needsReview?: boolean;
      normalizedTo?: string;
    }
  | { status: "ambiguous"; entries: AnswerEntry[]; reason: string }
  | { status: "unknown"; reason: string; intentTag?: string }
  | { status: "alwaysAsk"; reason: string; intentTag?: string };

export const EMPTY_BANK: AnswerBank = {
  version: 1,
  entries: [],
  normalizations: [],
  updatedAt: new Date(0).toISOString(),
};
