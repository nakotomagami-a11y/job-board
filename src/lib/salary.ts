/**
 * Parse a free-form salary string into a numeric range.
 *
 * Handles:
 *  - "$120,000 - $150,000" → { min: 120000, max: 150000 }
 *  - "$120k - $150k"        → { min: 120000, max: 150000 }
 *  - "120K"                 → { min: 120000, max: 120000 }
 *  - "1.2M"                 → { min: 1200000, max: 1200000 }
 *  - "€80k–€100k"           → { min: 80000, max: 100000 }   (en dash)
 *  - "USD 100,000+"         → { min: 100000, max: 100000 }
 *  - missing / unparseable  → null
 *
 * Currency symbols are ignored — the result is currency-agnostic.
 */
export interface SalaryRange {
  min: number;
  max: number;
}

const NUMBER_PATTERN = /(\d+(?:[,.\d]*)?)\s*([kKmM])?/g;

export function parseSalary(input?: string | null): SalaryRange | null {
  if (!input) return null;

  // Normalize unicode dashes/spaces so the regex sees a clean string.
  const text = input.replace(/[–—]/g, "-").replace(/\u00a0/g, " ");

  const matches: number[] = [];
  for (const m of text.matchAll(NUMBER_PATTERN)) {
    const raw = m[1].replace(/,/g, "");
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    const suffix = m[2]?.toLowerCase();
    const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
    // Heuristic: a bare number ≤ 999 with no suffix in a salary context is
    // almost certainly thousands (e.g. "120 - 150"), not literal dollars.
    const value =
      multiplier === 1 && n > 0 && n < 1000 ? n * 1_000 : n * multiplier;
    matches.push(value);
  }

  if (matches.length === 0) return null;
  const min = Math.min(...matches);
  const max = Math.max(...matches);
  return { min, max };
}

/** Convenience: returns the lower bound for sorting, or 0 if unparseable. */
export function salarySortValue(input?: string | null): number {
  const range = parseSalary(input);
  return range?.min ?? 0;
}
