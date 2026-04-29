import type {
  AnswerBank,
  AnswerEntry,
  MatchInput,
  MatchResult,
} from "./types";
import { fingerprintQuestion, normalizeQuestion } from "./normalize";
import { matchIntent, type ResolveCtx } from "./rules";

const FREE_TEXT_TRIGGERS = [
  /\bexplain\b/,
  /\bdescribe\b/,
  /\bwhy (do|are|would)\b/,
  /\btell us\b/,
  /\bin your own words\b/,
];

function isFreeText(normalized: string, fieldType: string): boolean {
  if (fieldType !== "textarea") return false;
  return FREE_TEXT_TRIGGERS.some((p) => p.test(normalized));
}

function rankByScope(entry: AnswerEntry, input: MatchInput): number {
  if (entry.scope === "perCompany" && entry.scopeKey === input.company) return 3;
  if (entry.scope === "perAts" && entry.scopeKey === input.ats) return 2;
  if (entry.scope === "global") return 1;
  return 0;
}

function findByFingerprint(
  bank: AnswerBank,
  fp: string,
  input: MatchInput,
): AnswerEntry[] {
  return bank.entries
    .filter((e) => e.fingerprint === fp && e.fieldType === input.fieldType)
    .filter((e) => {
      if (e.scope === "global") return true;
      if (e.scope === "perCompany") return e.scopeKey === input.company;
      if (e.scope === "perAts") return e.scopeKey === input.ats;
      return false;
    })
    .sort((a, b) => rankByScope(b, input) - rankByScope(a, input));
}

function findByIntent(
  bank: AnswerBank,
  intentTag: string,
  input: MatchInput,
): AnswerEntry[] {
  return bank.entries
    .filter((e) => e.intentTag === intentTag && e.fieldType === input.fieldType)
    .filter((e) => {
      if (e.scope === "global") return true;
      if (e.scope === "perCompany") return e.scopeKey === input.company;
      if (e.scope === "perAts") return e.scopeKey === input.ats;
      return false;
    })
    .sort((a, b) => rankByScope(b, input) - rankByScope(a, input));
}

export function matchField(
  input: MatchInput,
  bank: AnswerBank,
  ctx: ResolveCtx,
): MatchResult {
  const normalized = normalizeQuestion(input.label);

  if (isFreeText(normalized, input.fieldType)) {
    return {
      status: "alwaysAsk",
      reason: "free-text question (explain/describe/why)",
    };
  }

  const fp = fingerprintQuestion(input.label, input.fieldType);

  // Tier 1: exact fingerprint match
  const fpHits = findByFingerprint(bank, fp, input);
  if (fpHits.length >= 1) {
    const topRank = rankByScope(fpHits[0], input);
    const top = fpHits.filter((e) => rankByScope(e, input) === topRank);
    const distinct = new Set(top.map((e) => JSON.stringify(e.value)));
    if (distinct.size > 1) {
      return {
        status: "ambiguous",
        entries: top,
        reason: "multiple saved answers for this question",
      };
    }
    const entry = top[0];
    if (entry.reviewEveryTime) {
      return { status: "alwaysAsk", reason: "field flagged review-every-time", intentTag: entry.intentTag };
    }
    const normalizedTo = maybeNormalizeOption(entry, input, bank);
    if (entry.fieldType === "select" || entry.fieldType === "radio") {
      if (input.options && !optionMatch(entry, input, normalizedTo)) {
        return { status: "unknown", reason: "saved value not in options", intentTag: entry.intentTag };
      }
    }
    return { status: "matched", entry, tier: 1, normalizedTo };
  }

  // Tier 2: intent rule
  const rule = matchIntent(normalized, input.fieldType);
  if (rule) {
    if (rule.alwaysAsk) {
      return { status: "alwaysAsk", reason: `intent ${rule.tag} is always-ask`, intentTag: rule.tag };
    }

    // Look up saved answer by intent tag.
    const intentHits = findByIntent(bank, rule.tag, input);
    if (intentHits.length >= 1) {
      const entry = intentHits[0];
      if (entry.reviewEveryTime || rule.reviewEveryTime) {
        return { status: "alwaysAsk", reason: "field flagged review-every-time", intentTag: rule.tag };
      }
      const normalizedTo = maybeNormalizeOption(entry, input, bank);
      if (entry.fieldType === "select" || entry.fieldType === "radio") {
        if (input.options && !optionMatch(entry, input, normalizedTo)) {
          return { status: "unknown", reason: "saved value not in options", intentTag: rule.tag };
        }
      }
      return { status: "matched", entry, tier: 2, normalizedTo };
    }

    // Try resolver from profile/cvAnalysis (read-only — does not write to bank here).
    const resolved = rule.resolve?.(ctx) ?? null;
    if (resolved) {
      const synthetic: AnswerEntry = {
        id: `rule:${rule.tag}`,
        fingerprint: fp,
        intentTag: rule.tag,
        scope: "global",
        fieldType: input.fieldType,
        value: resolved,
        source: "rule",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        useCount: 0,
        reviewEveryTime: rule.reviewEveryTime,
      };
      if (rule.reviewEveryTime) {
        return { status: "alwaysAsk", reason: "field flagged review-every-time", intentTag: rule.tag };
      }
      if (synthetic.fieldType === "select" || synthetic.fieldType === "radio") {
        if (input.options && !optionMatch(synthetic, input, undefined)) {
          return { status: "unknown", reason: "resolved value not in options", intentTag: rule.tag };
        }
      }
      return { status: "matched", entry: synthetic, tier: 2 };
    }

    return { status: "unknown", reason: `intent ${rule.tag} matched but no saved answer`, intentTag: rule.tag };
  }

  return { status: "unknown", reason: "no matching fingerprint or intent rule" };
}

function valueAsString(entry: AnswerEntry): string | null {
  switch (entry.value.kind) {
    case "text":
      return entry.value.text;
    case "choice":
      return entry.value.choice;
    case "number":
      return String(entry.value.number);
    case "boolean":
      return entry.value.boolean ? "yes" : "no";
    default:
      return null;
  }
}

function optionMatch(
  entry: AnswerEntry,
  input: MatchInput,
  normalizedTo: string | undefined,
): boolean {
  if (!input.options) return true;
  const target = normalizedTo ?? valueAsString(entry);
  if (!target) return false;
  return input.options.includes(target);
}

function maybeNormalizeOption(
  entry: AnswerEntry,
  input: MatchInput,
  bank: AnswerBank,
): string | undefined {
  const raw = valueAsString(entry);
  if (!raw || !input.options) return undefined;
  if (input.options.includes(raw)) return undefined;
  const rule = bank.normalizations.find(
    (n) =>
      n.fieldType === input.fieldType &&
      (!n.ats || n.ats === input.ats) &&
      (!n.intentTag || n.intentTag === entry.intentTag) &&
      n.from === raw &&
      input.options!.includes(n.to),
  );
  return rule?.to;
}
