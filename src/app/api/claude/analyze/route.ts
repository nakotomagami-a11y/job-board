import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  // API key must come from server env, never from a client header.
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const { text, action } = await req.json();

  // Simple ping test for onboarding
  if (action === "ping") {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say ok" }],
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: String(e) },
        { status: 401 }
      );
    }
  }

  // CV Analysis
  if (!text) {
    return NextResponse.json(
      { error: "No text provided" },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are a CV/resume analyzer. Extract structured data from the CV text.

Return ONLY valid JSON with this exact structure:
{
  "name": "First Last",
  "email": "email@example.com",
  "location": "City, Country",
  "skills": ["React", "TypeScript", "Next.js", ...],
  "suggestedRoles": ["Frontend", "Mobile", ...],
  "suggestedSeniority": ["Senior", "Mid", ...],
  "suggestedCategories": ["Gaming", "Fintech", ...],
  "yearsExperience": 5,
  "summary": "Brief 1-2 sentence summary of the candidate"
}

RULES:
- "name": Extract ONLY the person's full name. Never include job titles like "Software Engineer", "Developer", etc.
- "email": Extract email address if present, or null.
- "location": Extract city/country if mentioned, or null.
- "skills": List ALL specific technologies, frameworks, libraries, and tools mentioned. Include programming languages, frameworks (React, Next.js, Vue), tools (Git, Docker, Figma), and methodologies (Agile, TDD).
- "suggestedRoles": Choose from ONLY these values: Frontend, Mobile, Full-Stack (Frontend-leaning), Design Engineer, Creative Developer
- "suggestedSeniority": Choose from ONLY these values: Junior, Mid, Senior, Staff, Principal, Lead, Manager
- "suggestedCategories": Choose from ONLY these values: Gaming, Crypto / Web3, AI / ML, Fintech, SaaS / Dev Tools, E-Commerce, Social / Community, Other
- "yearsExperience": Calculate approximate total years of professional experience from work history dates.`,
      messages: [
        {
          role: "user",
          content: `Analyze this CV:\n\n${text}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    }

    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
