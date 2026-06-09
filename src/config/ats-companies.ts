// Companies known to use Greenhouse / Lever / Ashby / Workable.
// Each ATS exposes a public JSON endpoint keyed by slug — we hit them
// directly instead of asking the agent to scrape, which is faster, free,
// and deterministic.
//
// Curate this list over time. Add companies the agent rediscovers often.

export type AtsProvider = "greenhouse" | "lever" | "ashby" | "workable";

export interface AtsCompany {
  slug: string;
  name: string;
  provider: AtsProvider;
  category?: string; // optional hint, used to bias scoring later
}

export const ATS_COMPANIES: AtsCompany[] = [
  // ── Greenhouse ──────────────────────────────────────────────────────────────
  { slug: "stripe", name: "Stripe", provider: "greenhouse", category: "Fintech" },
  { slug: "airbnb", name: "Airbnb", provider: "greenhouse" },
  { slug: "discord", name: "Discord", provider: "greenhouse", category: "Social / Community" },
  { slug: "figma", name: "Figma", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "notion", name: "Notion", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "vercel", name: "Vercel", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "ramp", name: "Ramp", provider: "greenhouse", category: "Fintech" },
  { slug: "anthropic", name: "Anthropic", provider: "greenhouse", category: "AI / ML" },
  { slug: "openai", name: "OpenAI", provider: "greenhouse", category: "AI / ML" },
  { slug: "huggingface", name: "Hugging Face", provider: "greenhouse", category: "AI / ML" },
  { slug: "cloudflare", name: "Cloudflare", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "brex", name: "Brex", provider: "greenhouse", category: "Fintech" },
  { slug: "webflow", name: "Webflow", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "airtable", name: "Airtable", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "amplitude", name: "Amplitude", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "miro", name: "Miro", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "plaid", name: "Plaid", provider: "greenhouse", category: "Fintech" },
  { slug: "intercom", name: "Intercom", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "loom", name: "Loom", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "mixpanel", name: "Mixpanel", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "dbt-labs", name: "dbt Labs", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "grafana", name: "Grafana Labs", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "snyk", name: "Snyk", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "scale-ai", name: "Scale AI", provider: "greenhouse", category: "AI / ML" },
  { slug: "cohere", name: "Cohere", provider: "greenhouse", category: "AI / ML" },
  { slug: "retool", name: "Retool", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "segment", name: "Segment (Twilio)", provider: "greenhouse", category: "SaaS / Dev Tools" },
  { slug: "mercury", name: "Mercury", provider: "greenhouse", category: "Fintech" },
  { slug: "netlify", name: "Netlify", provider: "greenhouse", category: "SaaS / Dev Tools" },

  // ── Lever ───────────────────────────────────────────────────────────────────
  { slug: "shopify", name: "Shopify", provider: "lever", category: "E-Commerce" },
  { slug: "netflix", name: "Netflix", provider: "lever" },
  { slug: "twitch", name: "Twitch", provider: "lever", category: "Social / Community" },
  { slug: "ubisoft", name: "Ubisoft", provider: "lever", category: "Gaming" },
  { slug: "clio", name: "Clio", provider: "lever", category: "SaaS / Dev Tools" },
  { slug: "robinhood", name: "Robinhood", provider: "lever", category: "Fintech" },
  { slug: "typeform", name: "Typeform", provider: "lever", category: "SaaS / Dev Tools" },
  { slug: "close", name: "Close", provider: "lever", category: "SaaS / Dev Tools" },
  { slug: "front", name: "Front", provider: "lever", category: "SaaS / Dev Tools" },

  // ── Ashby ───────────────────────────────────────────────────────────────────
  { slug: "cursor", name: "Cursor", provider: "ashby", category: "AI / ML" },
  { slug: "perplexity", name: "Perplexity", provider: "ashby", category: "AI / ML" },
  { slug: "linear", name: "Linear", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "replit", name: "Replit", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "supabase", name: "Supabase", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "posthog", name: "PostHog", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "raycast", name: "Raycast", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "resend", name: "Resend", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "neon", name: "Neon", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "liveblocks", name: "Liveblocks", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "plain", name: "Plain", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "farcaster", name: "Farcaster", provider: "ashby", category: "Crypto / Web3" },
  { slug: "zed", name: "Zed", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "expo", name: "Expo", provider: "ashby", category: "SaaS / Dev Tools" },
];

/** Build the public listings URL for a given company. */
export function atsListingsUrl(c: AtsCompany): string {
  switch (c.provider) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
    case "workable":
      return `https://apply.workable.com/api/v3/accounts/${c.slug}/jobs`;
  }
}
