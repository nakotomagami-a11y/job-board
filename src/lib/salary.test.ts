import { describe, it, expect } from "vitest";
import { parseSalary, salarySortValue } from "./salary";

describe("parseSalary", () => {
  it("returns null for missing input", () => {
    expect(parseSalary(null)).toBeNull();
    expect(parseSalary(undefined)).toBeNull();
    expect(parseSalary("")).toBeNull();
  });

  it("returns null when no numbers present", () => {
    expect(parseSalary("competitive")).toBeNull();
    expect(parseSalary("DOE")).toBeNull();
  });

  it("parses comma-formatted ranges", () => {
    expect(parseSalary("$120,000 - $150,000")).toEqual({ min: 120_000, max: 150_000 });
  });

  it("parses k-suffixed ranges", () => {
    expect(parseSalary("$120k - $150k")).toEqual({ min: 120_000, max: 150_000 });
    expect(parseSalary("80K-100K")).toEqual({ min: 80_000, max: 100_000 });
  });

  it("parses single-value k", () => {
    expect(parseSalary("120K")).toEqual({ min: 120_000, max: 120_000 });
  });

  it("parses M-suffixed values", () => {
    expect(parseSalary("1.2M")).toEqual({ min: 1_200_000, max: 1_200_000 });
  });

  it("normalizes en-dash and em-dash", () => {
    expect(parseSalary("€80k–€100k")).toEqual({ min: 80_000, max: 100_000 });
    expect(parseSalary("€80k—€100k")).toEqual({ min: 80_000, max: 100_000 });
  });

  it("treats bare numbers under 1000 as thousands", () => {
    // "120 - 150" almost certainly means 120k–150k in salary context
    expect(parseSalary("120 - 150")).toEqual({ min: 120_000, max: 150_000 });
  });

  it("handles open-ended (plus sign) ranges", () => {
    expect(parseSalary("USD 100,000+")).toEqual({ min: 100_000, max: 100_000 });
  });

  it("ignores currency prefixes", () => {
    expect(parseSalary("USD 100k - 130k")).toEqual({ min: 100_000, max: 130_000 });
    expect(parseSalary("£60,000 to £80,000")).toEqual({ min: 60_000, max: 80_000 });
  });

  it("returns lowest value as min regardless of order", () => {
    expect(parseSalary("$150k - $120k")).toEqual({ min: 120_000, max: 150_000 });
  });
});

describe("salarySortValue", () => {
  it("returns 0 for unparseable input", () => {
    expect(salarySortValue(null)).toBe(0);
    expect(salarySortValue("competitive")).toBe(0);
  });

  it("returns the lower bound for ranges", () => {
    expect(salarySortValue("$120k - $150k")).toBe(120_000);
  });

  it("returns the single value for single-number salaries", () => {
    expect(salarySortValue("100K")).toBe(100_000);
  });
});
