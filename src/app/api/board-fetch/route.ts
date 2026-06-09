import { NextResponse } from "next/server";
import { ATS_COMPANIES, atsListingsUrl, type AtsCompany } from "@/config/ats-companies";
import { canonicalizeRole } from "@/config/role-aliases";
import { rateLimit } from "@lib/server-utils";
import { sanitizeJobs } from "@lib/job-utils";
import type { Job } from "@/types/job";

export const maxDuration = 30;

const FETCH_TIMEOUT_MS = 8000;
const FETCH_CONCURRENCY = 6;
// Titles containing any of these survive the first-pass filter.
// Covers the full set of roles we care about — generalist/product eng and
// AI-adjacent roles are intentionally included here.
const KEYWORDS = [
  // Core FE
  "frontend", "front-end", "front end",
  "react", "next.js", "nextjs", "vue", "angular",
  "javascript", "typescript",
  "ui engineer", "ui developer", "web developer", "web engineer",
  // Mobile
  "mobile", "ios", "android", "react native", "flutter",
  // Creative / design
  "design engineer", "creative developer", "creative technologist",
  // Generalist / product
  "software engineer", "product engineer", "founding engineer",
  "forward deployed", "solutions engineer", "platform engineer",
  "full stack", "fullstack", "full-stack",
  // AI-adjacent
  "ai engineer", "ml engineer", "llm engineer", "genai engineer",
  "applied ai", "machine learning engineer",
];

const today = () => new Date().toISOString().split("T")[0];

interface RawAny {
  [k: string]: unknown;
}

function titleMatches(title: string): boolean {
  const t = title.toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
}

function postedRecently(iso: string | undefined, days = 30): boolean {
  if (!iso) return true; // unknown date → keep, agent / scoring will handle it
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return ageDays <= days;
}

function inferRegion(location: string): Job["region"] {
  const l = location.toLowerCase();
  if (l.includes("remote")) return "Remote";
  if (/\b(uk|united kingdom|england|london|manchester)\b/.test(l)) return "UK";
  if (/\b(us|usa|united states|canada|new york|san francisco|toronto)\b/.test(l)) return "North America";
  if (/\b(germany|france|spain|netherlands|sweden|berlin|paris|amsterdam|warsaw|lithuania|poland|portugal|italy)\b/.test(l)) return "Europe";
  if (/\b(india|japan|china|singapore|tokyo|bangalore)\b/.test(l)) return "Asia";
  return "Remote";
}

function inferRoleType(title: string): Job["roleType"] {
  return canonicalizeRole(title);
}

function inferSeniority(title: string): Job["seniority"] {
  const t = title.toLowerCase();
  if (/\b(staff|principal)\b/.test(t)) return /principal/.test(t) ? "Principal" : "Staff";
  if (/\b(lead)\b/.test(t)) return "Lead";
  if (/\b(manager|head of)\b/.test(t)) return "Manager";
  if (/\b(senior|sr\.)\b/.test(t)) return "Senior";
  if (/\b(junior|jr\.|entry|graduate)\b/.test(t)) return "Junior";
  return "Mid";
}

function shortId(company: string, title: string): string {
  const slug = `${company}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}-${rand}`;
}

function normalizeGreenhouse(company: AtsCompany, raw: RawAny): Job | null {
  const title = String(raw.title ?? "");
  if (!titleMatches(title)) return null;
  const location = String((raw.location as RawAny)?.name ?? "Remote");
  const url = String(raw.absolute_url ?? "");
  if (!url) return null;
  const updated = String(raw.updated_at ?? raw.first_published ?? "");
  const postedDate = updated ? updated.split("T")[0] : today();
  if (!postedRecently(postedDate)) return null;

  return {
    id: shortId(company.name, title),
    title,
    company: company.name,
    companyType: "Other",
    location,
    region: inferRegion(location),
    roleType: inferRoleType(title),
    seniority: inferSeniority(title),
    url,
    tags: [],
    postedDate,
    verifiedDate: today(),
    source: "greenhouse",
    remote: location.toLowerCase().includes("remote"),
    category: (company.category as Job["category"]) ?? "Other",
    sourceType: "agent",
  };
}

function normalizeLever(company: AtsCompany, raw: RawAny): Job | null {
  const title = String(raw.text ?? "");
  if (!titleMatches(title)) return null;
  const categories = (raw.categories as RawAny) ?? {};
  const location = String(categories.location ?? categories.allLocations ?? "Remote");
  const url = String(raw.hostedUrl ?? raw.applyUrl ?? "");
  if (!url) return null;
  const createdAt = Number(raw.createdAt ?? 0);
  const postedDate = createdAt ? new Date(createdAt).toISOString().split("T")[0] : today();
  if (!postedRecently(postedDate)) return null;
  const commitment = String(categories.commitment ?? "").toLowerCase();
  if (commitment.includes("intern") || commitment.includes("contract")) return null;

  return {
    id: shortId(company.name, title),
    title,
    company: company.name,
    companyType: "Other",
    location,
    region: inferRegion(location),
    roleType: inferRoleType(title),
    seniority: inferSeniority(title),
    url,
    tags: [],
    postedDate,
    verifiedDate: today(),
    source: "lever",
    remote: location.toLowerCase().includes("remote"),
    category: (company.category as Job["category"]) ?? "Other",
    sourceType: "agent",
  };
}

function normalizeAshby(company: AtsCompany, raw: RawAny): Job | null {
  const title = String(raw.title ?? "");
  if (!titleMatches(title)) return null;
  const location = String(raw.locationName ?? "Remote");
  const url = String(raw.applyUrl ?? raw.jobUrl ?? "");
  if (!url) return null;
  const updated = String(raw.updatedAt ?? raw.publishedAt ?? "");
  const postedDate = updated ? updated.split("T")[0] : today();
  if (!postedRecently(postedDate)) return null;

  return {
    id: shortId(company.name, title),
    title,
    company: company.name,
    companyType: "Other",
    location,
    region: inferRegion(location),
    roleType: inferRoleType(title),
    seniority: inferSeniority(title),
    url,
    tags: [],
    postedDate,
    verifiedDate: today(),
    source: "ashby",
    remote: Boolean(raw.isRemote) || location.toLowerCase().includes("remote"),
    category: (company.category as Job["category"]) ?? "Other",
    sourceType: "agent",
  };
}

function normalize(company: AtsCompany, raw: RawAny): Job | null {
  switch (company.provider) {
    case "greenhouse": return normalizeGreenhouse(company, raw);
    case "lever":      return normalizeLever(company, raw);
    case "ashby":      return normalizeAshby(company, raw);
    case "workable":   return null; // schema varies, skip for now
  }
}

async function fetchOne(company: AtsCompany): Promise<{ company: string; jobs: Job[]; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(atsListingsUrl(company), {
      signal: ctrl.signal,
      headers: { "User-Agent": "JobHunt/1.0 (board-fetch)" },
    });
    if (!res.ok) return { company: company.name, jobs: [], error: `HTTP ${res.status}` };
    const data: RawAny = await res.json();

    let list: RawAny[] = [];
    if (Array.isArray(data.jobs)) list = data.jobs as RawAny[];
    else if (Array.isArray(data)) list = data as RawAny[];
    else if (Array.isArray((data as RawAny).postings)) list = (data as RawAny).postings as RawAny[];

    const jobs = list.map((r) => normalize(company, r)).filter((j): j is Job => j !== null);
    return { company: company.name, jobs };
  } catch (e) {
    return { company: company.name, jobs: [], error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAll(companies: AtsCompany[]): Promise<{ jobs: Job[]; perCompany: { company: string; count: number; error?: string }[] }> {
  const perCompany: { company: string; count: number; error?: string }[] = [];
  const allJobs: Job[] = [];

  let cursor = 0;
  const workers = Array.from({ length: FETCH_CONCURRENCY }, () => (async () => {
    while (cursor < companies.length) {
      const idx = cursor++;
      const result = await fetchOne(companies[idx]);
      perCompany.push({ company: result.company, count: result.jobs.length, error: result.error });
      allJobs.push(...result.jobs);
    }
  })());

  await Promise.all(workers);
  return { jobs: allJobs, perCompany };
}

export async function POST(req: Request) {
  const limited = rateLimit(req, { bucket: "board-fetch", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const slugs: string[] | undefined = body.slugs;

    const targets = slugs?.length
      ? ATS_COMPANIES.filter((c) => slugs.includes(c.slug))
      : ATS_COMPANIES;

    const { jobs, perCompany } = await fetchAll(targets);
    const safeJobs = sanitizeJobs(jobs);
    return NextResponse.json({
      jobs: safeJobs,
      count: safeJobs.length,
      perCompany,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    companies: ATS_COMPANIES.map((c) => ({ slug: c.slug, name: c.name, provider: c.provider })),
    count: ATS_COMPANIES.length,
  });
}
