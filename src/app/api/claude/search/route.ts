import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { WebSearchTool20250305 } from "@anthropic-ai/sdk/resources/messages";
import { rateLimit } from "@lib/rate-limit";
import { sanitizeJobs } from "@lib/sanitize-job";
import type { Job } from "@shared/types/job";

export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = rateLimit(req, { bucket: "claude-search", limit: 5, windowMs: 60_000 });
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // API key must come from server env, never from a request header. Accepting
  // a client-supplied x-api-key would let any caller substitute their own key
  // or echo a logged one back. The Anthropic key lives in process.env only.
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const { profile, focusArea } = await req.json();

  const skills = profile?.skills?.join(", ") || "React, TypeScript, Next.js";
  const regions = profile?.preferredRegions?.join(", ") || "any";
  const roles = profile?.preferredRoles?.join(", ") || "Frontend, Mobile";
  const seniority = profile?.preferredSeniority?.join(", ") || "Mid, Senior";
  const categories = profile?.preferredCategories?.join(", ") || "any";
  const remotePreference = profile?.remotePreference || "remote";
  const today = new Date().toISOString().split("T")[0];

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: `You are an expert job search assistant. Your job is to search the web thoroughly and find REAL, CURRENTLY ACTIVE job listings for a software developer.

CANDIDATE PROFILE:
- Primary skills: ${skills}
- Preferred regions: ${regions}
- Preferred roles: ${roles}
- Seniority level: ${seniority}
- Industry preferences: ${categories}
- Work style preference: ${remotePreference}
${profile?.cvText ? `\nCV excerpt (first 800 chars): ${profile.cvText.substring(0, 800)}` : ""}

SEARCH FOCUS: ${focusArea || "Search broadly across all regions and industries. Cover: gaming studios, crypto/web3 companies, AI startups, fintech, SaaS/dev tools, e-commerce, and general tech companies."}

SEARCH STRATEGY — you MUST search multiple sources:
1. Search job aggregators: LinkedIn Jobs, Indeed, Glassdoor
2. Search remote-first boards: WeWorkRemotely, RemoteOK, arc.dev
3. Search startup boards: Wellfound (AngelList), Y Combinator Work at a Startup, startup.jobs
4. Search ATS platforms: Greenhouse (boards.greenhouse.io), Lever (jobs.lever.co), Ashby (jobs.ashbyhq.com)
5. Search industry-specific: web3.career, cryptojobslist.com, hitmarker.net (gaming)
6. Search company career pages directly for major companies
7. Check Hacker News "Who is Hiring" threads

For each source, search for terms like: "frontend developer", "React engineer", "React Native developer", "UI engineer", "web developer", "design engineer", "mobile developer"

CRITICAL RULES:
1. Every job MUST have a REAL, WORKING application URL — not a search results page
2. Only include jobs that appear to be posted within the last 30 days
3. Do NOT invent or hallucinate job listings — every job must come from an actual source you found
4. Include salary when visible in the listing
5. Try to find at least 15-20 listings across different companies
6. Prefer direct application links (greenhouse, lever, ashby, company career pages)
7. Include the source website where you found it

OUTPUT FORMAT — return ONLY a valid JSON array, no other text:
[
  {
    "id": "company-slug-xxxx",
    "title": "Exact Job Title",
    "company": "Company Name",
    "companyType": "Startup",
    "location": "City, Country",
    "region": "Europe",
    "roleType": "Frontend",
    "seniority": "Senior",
    "url": "https://direct-application-url.com/jobs/123",
    "tags": ["React", "TypeScript", "Next.js"],
    "salary": "$100,000 - $150,000",
    "postedDate": "${today}",
    "verifiedDate": "${today}",
    "source": "greenhouse / linkedin / etc",
    "remote": true,
    "category": "SaaS / Dev Tools",
    "sourceType": "claude-search",
    "description": "1-2 sentence description of the role"
  }
]

VALID ENUM VALUES:
- region: Remote | Europe | North America | Asia | UK | Hybrid
- roleType: Frontend | Mobile | Full-Stack (Frontend-leaning) | Design Engineer | Creative Developer
- seniority: Junior | Mid | Senior | Staff | Principal | Lead | Manager
- companyType: AAA Game Studio | Indie Game Studio | Gaming Platform | Tech Giant | Gaming Hardware | Dev Tools | Startup | Other
- category: Gaming | Crypto / Web3 | AI / ML | Fintech | SaaS / Dev Tools | E-Commerce | Social / Community | Other
- sourceType: always "claude-search"
- remote: boolean

Generate unique IDs using format: companyname-shortdesc-4randomchars (lowercase, hyphens)`,
      messages: [
        {
          role: "user",
          content: `Search the web RIGHT NOW for the latest frontend/mobile developer job openings. I need real, active listings with working application links. Search as many sources as you can and find at least 15 positions.${focusArea ? `\n\nSpecific focus: ${focusArea}` : ""}`,
        },
      ],
      tools: [
        { type: "web_search_20250305", name: "web_search" } satisfies WebSearchTool20250305,
      ],
    });

    // Extract JSON from the response (may be mixed with web_search tool results)
    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    // Try to parse the JSON array from the response
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const jobs = JSON.parse(jsonMatch[0]);
        // Validate, normalize, and sanitize jobs (drop unsafe URLs / strip HTML)
        const enriched = jobs
          .filter(
            (j: Record<string, unknown>) =>
              j.title && j.company && j.url && typeof j.url === "string"
          )
          .map((j: Record<string, unknown>) => ({
            ...j,
            sourceType: "claude-search",
            verifiedDate: today,
            // Ensure ID uniqueness
            id:
              j.id ||
              `${String(j.company).toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 6)}`,
          })) as Job[];
        const validJobs = sanitizeJobs(enriched);
        return NextResponse.json({ jobs: validJobs, count: validJobs.length });
      } catch {
        return NextResponse.json({
          jobs: [],
          count: 0,
          error: "Failed to parse job listings from Claude response",
          raw: jsonText.substring(0, 500),
        });
      }
    }

    return NextResponse.json({
      jobs: [],
      count: 0,
      error: "No job listings found in response",
      raw: jsonText.substring(0, 500),
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
