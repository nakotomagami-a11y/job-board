import { describe, it, expect } from "vitest";
import type { Job } from "@/types/job";
import type { UserProfile } from "@/types/profile";
import { scoreJob, rubricReject } from "@lib/job-scoring";

const NOW = new Date("2026-04-07T00:00:00Z").getTime();

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Senior Frontend Engineer",
    company: "Acme",
    companyType: "Startup",
    location: "Remote",
    region: "Remote",
    roleType: "Frontend",
    seniority: "Senior",
    url: "https://example.com/jobs/1",
    tags: ["React", "TypeScript", "Next.js"],
    salary: "$120k - $150k",
    postedDate: "2026-04-05",
    verifiedDate: "2026-04-05",
    source: "test",
    remote: true,
    category: "SaaS / Dev Tools",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: "Test User",
    remotePreference: "remote",
    preferredRegions: ["Remote"],
    preferredRoles: ["Frontend"],
    preferredSeniority: ["Senior"],
    preferredCategories: ["SaaS / Dev Tools"],
    skills: ["React", "TypeScript", "Next.js"],
    salaryRange: { min: 120_000, max: 160_000, currency: "USD" },
    onboardingComplete: true,
    createdAt: "2026-04-01",
    updatedAt: "2026-04-01",
    ...overrides,
  };
}

describe("scoreJob", () => {
  it("scores a perfect match near 100", () => {
    const score = scoreJob(makeJob(), makeProfile(), NOW);
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("penalizes role type mismatch", () => {
    const job = makeJob({ roleType: "Mobile", title: "iOS Engineer" });
    const profile = makeProfile({ preferredRoles: ["Frontend"] });
    const score = scoreJob(job, profile, NOW);
    // Role match should drop from 20 → ~4, total around 80 give-or-take.
    expect(score).toBeLessThan(90);
  });

  it("rewards remote jobs for remote-preference profiles even outside preferred regions", () => {
    const remoteJob = makeJob({ region: "Asia", remote: true });
    const onsiteJob = makeJob({ region: "Asia", remote: false });
    const profile = makeProfile({ preferredRegions: ["Remote"] });
    expect(scoreJob(remoteJob, profile, NOW)).toBeGreaterThan(
      scoreJob(onsiteJob, profile, NOW)
    );
  });

  it("gives partial credit for adjacent seniority levels", () => {
    const exact = scoreJob(makeJob({ seniority: "Senior" }), makeProfile(), NOW);
    const oneOff = scoreJob(makeJob({ seniority: "Mid" }), makeProfile(), NOW);
    const twoOff = scoreJob(makeJob({ seniority: "Junior" }), makeProfile(), NOW);
    expect(exact).toBeGreaterThan(oneOff);
    expect(oneOff).toBeGreaterThan(twoOff);
  });

  it("decays score with job age", () => {
    const fresh = scoreJob(makeJob({ postedDate: "2026-04-07" }), makeProfile(), NOW);
    const old = scoreJob(makeJob({ postedDate: "2026-03-08" }), makeProfile(), NOW);
    expect(fresh).toBeGreaterThan(old);
  });

  it("does not award salary points when range is below profile minimum", () => {
    const lowSalary = scoreJob(
      makeJob({ salary: "$60k - $80k" }),
      makeProfile({ salaryRange: { min: 120_000, max: 160_000, currency: "USD" } }),
      NOW
    );
    const matchingSalary = scoreJob(makeJob(), makeProfile(), NOW);
    expect(matchingSalary).toBeGreaterThan(lowSalary);
  });

  it("gives a neutral mid-score when profile has no preferences set", () => {
    const empty: UserProfile = {
      name: "",
      remotePreference: "any",
      preferredRegions: [],
      preferredRoles: [],
      preferredSeniority: [],
      preferredCategories: [],
      skills: [],
      onboardingComplete: true,
      createdAt: "",
      updatedAt: "",
    };
    const score = scoreJob(makeJob(), empty, NOW);
    // All neutrals: 12.5 + 10 + 10 + 7.5 + 5 + recency + 1.5 ≈ 47-50
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(60);
  });

  it("matches skills case-insensitively and substring-friendly", () => {
    const job = makeJob({ tags: ["react native", "javascript"] });
    const profile = makeProfile({ skills: ["React", "JavaScript"] });
    const score = scoreJob(job, profile, NOW);
    // Both skills should hit (React ⊂ "react native"), so techStack ≈ 25
    expect(score).toBeGreaterThan(80);
  });

  it("matches alias-equivalent preferred roles (React Developer ↔ Frontend)", () => {
    const job = makeJob({ roleType: "Frontend", title: "Senior Frontend Engineer" });
    const profile = makeProfile({ preferredRoles: ["React Developer"] });
    const score = scoreJob(job, profile, NOW);
    expect(score).toBeGreaterThan(85);
  });

  it("matches Generalist / Product Engineer when profile includes Software Engineer", () => {
    const job = makeJob({ roleType: "Generalist / Product Engineer", title: "Founding Engineer" });
    const profile = makeProfile({ preferredRoles: ["Software Engineer", "Frontend Engineer"] });
    const score = scoreJob(job, profile, NOW);
    expect(score).toBeGreaterThan(70);
  });

  it("awards full region score for a remote+Europe job when profile prefers both", () => {
    const job = makeJob({ region: "Europe", remote: true });
    const profileRemoteFirst = makeProfile({ preferredRegions: ["Remote", "Europe"] });
    const profileEuropeFirst = makeProfile({ preferredRegions: ["Europe", "Remote"] });
    // Both orderings should award full regionMatch (20 pts) not partial (14 pts)
    const scoreR = scoreJob(job, profileRemoteFirst, NOW);
    const scoreE = scoreJob(job, profileEuropeFirst, NOW);
    expect(scoreR).toBeGreaterThanOrEqual(scoreE - 1); // within 1 pt of each other
    // Neither should be penalised to the partial (0.7) bracket
    expect(scoreR).toBeGreaterThan(85);
    expect(scoreE).toBeGreaterThan(85);
  });
});

describe("rubricReject", () => {
  const NOW_R = new Date("2026-04-07T00:00:00Z").getTime();

  function makeRubricJob(overrides: Partial<Job> = {}): Job {
    return {
      id: "r",
      title: "Senior Frontend Engineer",
      company: "Acme",
      companyType: "Startup",
      location: "Remote",
      region: "Remote",
      roleType: "Frontend",
      seniority: "Senior",
      url: "https://example.com/jobs/frontend-123",
      tags: [],
      postedDate: "2026-04-05",
      verifiedDate: "2026-04-05",
      source: "test",
      remote: true,
      category: "SaaS / Dev Tools",
      ...overrides,
    };
  }

  function makeRubricProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
      name: "Dev",
      remotePreference: "remote",
      preferredRegions: ["Remote"],
      preferredRoles: ["Frontend"],
      preferredSeniority: ["Senior"],
      preferredCategories: [],
      skills: ["React", "TypeScript"],
      onboardingComplete: true,
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("passes a valid job with no tags when title contains a profile skill", () => {
    const job = makeRubricJob({ tags: [], title: "Senior React Engineer", description: "TypeScript codebase" });
    expect(rubricReject(job, makeRubricProfile(), NOW_R)).toBeNull();
  });

  it("rejects a tagless job whose title+desc has zero overlap with profile skills", () => {
    const job = makeRubricJob({
      tags: [],
      title: "Backend Java Engineer",
      description: "Spring Boot, Hibernate, Kafka",
    });
    const result = rubricReject(job, makeRubricProfile(), NOW_R);
    expect(result).toMatch(/no tags/);
  });

  it("still rejects when tags are present but have zero overlap", () => {
    const job = makeRubricJob({ tags: ["Java", "Spring Boot", "Kafka"] });
    const result = rubricReject(job, makeRubricProfile(), NOW_R);
    expect(result).toMatch(/zero overlap/);
  });
});
