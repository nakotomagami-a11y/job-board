import { describe, it, expect } from "vitest";
import type { Job } from "@shared/types/job";
import { applyFilters, initialFilters, type Filters } from "./filter-jobs";

const NOW = new Date("2026-04-07T00:00:00Z").getTime();

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j",
    title: "Frontend Engineer",
    company: "Acme",
    companyType: "Startup",
    location: "Berlin",
    region: "Europe",
    roleType: "Frontend",
    seniority: "Senior",
    url: "https://example.com",
    tags: ["React"],
    postedDate: "2026-04-05",
    verifiedDate: "2026-04-05",
    source: "test",
    remote: false,
    category: "SaaS / Dev Tools",
    ...overrides,
  };
}

function withFilters(overrides: Partial<Filters>): Filters {
  return { ...initialFilters, ...overrides };
}

describe("applyFilters", () => {
  const a = makeJob({ id: "a", company: "Acme", region: "Europe", roleType: "Frontend" });
  const b = makeJob({ id: "b", company: "Globex", region: "Remote", roleType: "Mobile", remote: true });
  const c = makeJob({ id: "c", company: "Initech", applied: true, region: "North America" });
  const d = makeJob({ id: "d", company: "Umbrella", rejected: true, postedDate: "2026-01-01", region: "UK" });
  const all = [a, b, c, d];

  it("returns all jobs with default filters", () => {
    expect(applyFilters(all, initialFilters, NOW)).toHaveLength(4);
  });

  it("filters by free-text search across title/company/tags", () => {
    expect(applyFilters(all, withFilters({ search: "globex" }), NOW)).toEqual([b]);
    expect(applyFilters(all, withFilters({ search: "REACT" }), NOW)).toHaveLength(4);
  });

  it("filters by region exact match", () => {
    expect(applyFilters(all, withFilters({ region: "Europe" }), NOW)).toEqual([a]);
  });

  it("'Remote' region keeps any job marked remote regardless of region field", () => {
    expect(applyFilters(all, withFilters({ region: "Remote" }), NOW)).toEqual([b]);
  });

  it("filters by role type", () => {
    expect(applyFilters(all, withFilters({ roleType: "Mobile" }), NOW)).toEqual([b]);
  });

  it("filters Active = neither applied nor rejected", () => {
    const result = applyFilters(all, withFilters({ status: "Active" }), NOW);
    expect(result.map((j) => j.id)).toEqual(["a", "b"]);
  });

  it("filters Applied", () => {
    expect(applyFilters(all, withFilters({ status: "Applied" }), NOW)).toEqual([c]);
  });

  it("filters Rejected", () => {
    expect(applyFilters(all, withFilters({ status: "Rejected" }), NOW)).toEqual([d]);
  });

  it("filters by timeframe in days", () => {
    // d was posted 2026-01-01, NOW is 2026-04-07 — 96 days old
    const result = applyFilters(all, withFilters({ timeframeDays: 30 }), NOW);
    expect(result).not.toContain(d);
    expect(result).toHaveLength(3);
  });

  it("ignores timeframe when set to the sentinel 999", () => {
    expect(applyFilters(all, withFilters({ timeframeDays: 999 }), NOW)).toHaveLength(4);
  });

  it("combines multiple filters with AND semantics", () => {
    const result = applyFilters(
      all,
      withFilters({ region: "Europe", status: "Active" }),
      NOW
    );
    expect(result).toEqual([a]);
  });
});
