#!/usr/bin/env node
// Screen the job feed against the user's actual profile (Senior+, EU-based,
// remote preference) and produce a shortlist for the auto-apply runner.
//
// Reads:  data/user/jobs.json + data/user/profile.json
// Writes: data/user/auto-apply/job-screen.json
//
// The output has shape: { apply: Job[], skip: { id, reason }[], updatedAt }.
// This script intentionally errs on the side of skipping — it is cheaper to
// miss a borderline opportunity than to waste cycles applying to one that
// will reject on the first filter.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const JOBS_PATH = path.join(ROOT, "data", "user", "jobs.json");
const PROFILE_PATH = path.join(ROOT, "data", "user", "profile.json");
const OUT_PATH = path.join(ROOT, "data", "user", "auto-apply", "job-screen.json");

// Companies that operate as job aggregators, staffing/recruiting firms, or
// "talent platforms". They re-list other companies' postings under their own
// names with mis-leading titles. Adding to this list is the single highest-
// leverage way to reduce noise.
const AGGREGATORS = new Set([
  "Sundayy",
  "Foxglove/Sundayy",
  "AgileGrid Solutions",
  "YO HR Consultancy",
  "InterEx Group",
  "Jobgether",
  "DataAnnotation",
  "Go Offer",
  "Apetan Consulting LLC",
  "Crossing Hurdles",
  "Golden Technology",
  "Habanero Consulting Inc.",
  "Quik Hire Staffing",
  "Jobs Ai",
  "Momento USA LLC (via Jobs via Dice)",
  // LatAm-focused outsourcers — fine companies, but their roles target LatAm
  "Sophilabs",
  "Devsu",
  "Svitla Systems, Inc.",
  "WebOrigo",
]);

const AGGREGATOR_NAME_PATTERNS = [
  /\bstaffing\b/i,
  /\brecruit/i,
  /\bvia (jobs|dice)\b/i,
  /\b(consultancy|consulting)\b.*\b(llc|inc|ltd)?\b/i, // tighten if it over-matches
];

// Region-friendly substrings in the location string. If a posting's location
// contains any of these, treat it as fitting an EU-based remote candidate.
const FRIENDLY_LOCATION_SUBSTRINGS = [
  "europe", "emea", "eea", "uk", "united kingdom",
  "germany", "netherlands", "france", "spain", "portugal",
  "poland", "lithuania", "latvia", "estonia", "finland",
  "sweden", "norway", "denmark", "ireland", "belgium",
  "czech", "slovakia", "slovenia", "austria", "hungary",
  "romania", "bulgaria", "greece", "italy", "albania",
  "turkey", "türkiye",
  "worldwide", "anywhere", "global",
];

const HOSTILE_LOCATION_SUBSTRINGS = [
  "united states", "usa", " us only",
  "canada", "mexico",
  "india", "pakistan", "bangladesh",
  "peru", "brazil", "argentina", "colombia", "chile", "latin america", "latam",
  "asia-pacific", "apj", "apac",
];

// Subset of seniorities the user is open to. Lower than this = under-leveled.
const SENIORITY_TOKENS = ["senior", "staff", "lead", "principal"];
const UNDER_LEVELED_TOKENS = [" ii ", " 2 ", "junior", "entry", "associate", "graduate", "new grad"];

function isAggregator(company) {
  if (!company) return false;
  if (AGGREGATORS.has(company)) return true;
  return AGGREGATOR_NAME_PATTERNS.some((p) => p.test(company));
}

function locationFit(location) {
  if (!location) return { fit: "unknown", reason: "no location string" };
  const lc = location.toLowerCase();
  if (FRIENDLY_LOCATION_SUBSTRINGS.some((s) => lc.includes(s))) {
    return { fit: "good", reason: `friendly location keyword (${location})` };
  }
  if (HOSTILE_LOCATION_SUBSTRINGS.some((s) => lc.includes(s))) {
    return { fit: "bad", reason: `region mismatch (${location})` };
  }
  // "Remote" alone with no country — ambiguous, keep
  if (/^remote$/i.test(location.trim())) return { fit: "unknown", reason: "remote without specified region" };
  return { fit: "unknown", reason: `location not categorized (${location})` };
}

function levelFit(title, prefSeniority) {
  const lc = ` ${title.toLowerCase()} `;
  const isUnder = UNDER_LEVELED_TOKENS.some((t) => lc.includes(t));
  const wantsSenior = (prefSeniority ?? []).some((s) => SENIORITY_TOKENS.includes(s.toLowerCase()));
  if (wantsSenior && isUnder) return { fit: "bad", reason: `under-leveled title (${title})` };
  return { fit: "ok", reason: "" };
}

function freshnessFit(postedDate) {
  if (!postedDate) return { fit: "unknown" };
  const posted = new Date(postedDate);
  if (Number.isNaN(posted.getTime())) return { fit: "unknown" };
  const ageDays = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > 14) return { fit: "bad", reason: `posting is ${Math.round(ageDays)} days old` };
  return { fit: "ok" };
}

function screen(job, profile) {
  if (job.applied) return { decision: "skip", reason: "already applied" };
  if (job.rejected) return { decision: "skip", reason: "marked rejected" };

  if (isAggregator(job.company)) {
    return { decision: "skip", reason: `aggregator/staffing firm: ${job.company}` };
  }

  const lvl = levelFit(job.title, profile?.preferredSeniority);
  if (lvl.fit === "bad") return { decision: "skip", reason: lvl.reason };

  const loc = locationFit(job.location);
  if (loc.fit === "bad") return { decision: "skip", reason: loc.reason };

  const fresh = freshnessFit(job.postedDate);
  if (fresh.fit === "bad") return { decision: "skip", reason: fresh.reason };

  if (loc.fit === "good") return { decision: "apply", reason: loc.reason };
  return { decision: "review", reason: loc.reason };
}

async function main() {
  const jobs = JSON.parse(await fs.readFile(JOBS_PATH, "utf-8"));
  const profile = JSON.parse(await fs.readFile(PROFILE_PATH, "utf-8"));
  const sourceFilter = process.argv[2]; // e.g. "linkedin"
  const sourceMatch = (j) => {
    if (!sourceFilter) return true;
    const s = (j.source ?? "").toLowerCase();
    return s.includes(sourceFilter.toLowerCase());
  };

  const apply = [];
  const review = [];
  const skip = [];

  for (const job of jobs) {
    if (!sourceMatch(job)) continue;
    const result = screen(job, profile);
    const row = { id: job.id, title: job.title, company: job.company, url: job.url, reason: result.reason };
    if (result.decision === "apply") apply.push(row);
    else if (result.decision === "review") review.push(row);
    else skip.push(row);
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  const out = {
    sourceFilter: sourceFilter ?? null,
    counts: { apply: apply.length, review: review.length, skip: skip.length },
    apply,
    review,
    skip,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`apply: ${apply.length}    review: ${review.length}    skip: ${skip.length}`);
  console.log(`written → ${path.relative(ROOT, OUT_PATH)}`);
  console.log("");
  console.log("APPLY:");
  for (const r of apply) console.log(`  ${r.company} — ${r.title}    (${r.reason})`);
  console.log("");
  console.log("REVIEW:");
  for (const r of review) console.log(`  ${r.company} — ${r.title}    (${r.reason})`);
  console.log("");
  console.log("SKIP (top reasons):");
  const reasonCounts = {};
  for (const r of skip) reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
  Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([r, n]) => console.log(`  ${n}× ${r}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
