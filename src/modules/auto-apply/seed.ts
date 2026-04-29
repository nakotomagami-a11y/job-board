import type { UserProfile } from "@shared/types/profile";
import type {
  AnswerBank,
  AnswerEntry,
  AnswerScope,
  AnswerValue,
  FieldType,
} from "./types";
import { fingerprintQuestion } from "./normalize";

export interface SeedSources {
  profile: UserProfile | null;
  cvAnalysis: Record<string, unknown> | null;
}

interface SeedSpec {
  intentTag: string;
  label: string;
  fieldType: FieldType;
  value: AnswerValue;
  scope?: AnswerScope;
  reviewEveryTime?: boolean;
}

const now = () => new Date().toISOString();

function entryFromSpec(spec: SeedSpec): AnswerEntry {
  return {
    id: `seed:${spec.intentTag}`,
    fingerprint: fingerprintQuestion(spec.label, spec.fieldType),
    intentTag: spec.intentTag,
    scope: spec.scope ?? "global",
    fieldType: spec.fieldType,
    value: spec.value,
    source: "profile",
    createdAt: now(),
    updatedAt: now(),
    useCount: 0,
    reviewEveryTime: spec.reviewEveryTime,
  };
}

export function buildSeedEntries({ profile }: SeedSources): AnswerEntry[] {
  const entries: AnswerEntry[] = [];
  const push = (s: SeedSpec) => entries.push(entryFromSpec(s));

  if (profile?.name?.trim()) {
    const trimmed = profile.name.trim();
    push({ intentTag: "name.full", label: "full name", fieldType: "text", value: { kind: "text", text: trimmed } });
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 1) {
      push({ intentTag: "name.first", label: "first name", fieldType: "text", value: { kind: "text", text: parts[0] } });
    }
    if (parts.length >= 2) {
      push({
        intentTag: "name.last",
        label: "last name",
        fieldType: "text",
        value: { kind: "text", text: parts.slice(1).join(" ") },
      });
    }
  }

  if (profile?.email?.trim()) {
    push({
      intentTag: "email",
      label: "email",
      fieldType: "email",
      value: { kind: "text", text: profile.email.trim() },
    });
  }

  if (profile?.location?.trim()) {
    push({
      intentTag: "location.city",
      label: "city",
      fieldType: "text",
      value: { kind: "text", text: profile.location.trim() },
    });
  }

  if (profile?.salaryRange) {
    push({
      intentTag: "salary.expectation",
      label: "salary expectation",
      fieldType: "text",
      value: {
        kind: "text",
        text: `${profile.salaryRange.min}-${profile.salaryRange.max} ${profile.salaryRange.currency}`,
      },
      reviewEveryTime: true,
    });
  }

  return entries;
}

export function seedAnswerBank(
  existing: AnswerBank,
  sources: SeedSources,
): AnswerBank {
  const seeds = buildSeedEntries(sources);
  const existingTags = new Set(
    existing.entries.filter((e) => e.source !== "rule").map((e) => `${e.intentTag}|${e.scope}|${e.scopeKey ?? ""}`),
  );
  const merged = [...existing.entries];
  for (const s of seeds) {
    const key = `${s.intentTag}|${s.scope}|${s.scopeKey ?? ""}`;
    if (existingTags.has(key)) continue;
    merged.push(s);
  }
  return {
    ...existing,
    entries: merged,
    updatedAt: now(),
  };
}
