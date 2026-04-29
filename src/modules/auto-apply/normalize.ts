import type { FieldType } from "./types";

export function normalizeQuestion(label: string): string {
  return label
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprintQuestion(label: string, fieldType: FieldType): string {
  return `${fieldType}::${normalizeQuestion(label)}`;
}
