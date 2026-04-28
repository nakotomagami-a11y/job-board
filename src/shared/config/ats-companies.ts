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
  // Greenhouse — large list, mostly mid/late-stage tech
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

  // Lever
  { slug: "shopify", name: "Shopify", provider: "lever", category: "E-Commerce" },
  { slug: "netflix", name: "Netflix", provider: "lever" },
  { slug: "twitch", name: "Twitch", provider: "lever", category: "Social / Community" },
  { slug: "ubisoft", name: "Ubisoft", provider: "lever", category: "Gaming" },
  { slug: "clio", name: "Clio", provider: "lever", category: "SaaS / Dev Tools" },

  // Ashby
  { slug: "cursor", name: "Cursor", provider: "ashby", category: "AI / ML" },
  { slug: "perplexity", name: "Perplexity", provider: "ashby", category: "AI / ML" },
  { slug: "linear", name: "Linear", provider: "ashby", category: "SaaS / Dev Tools" },
  { slug: "replit", name: "Replit", provider: "ashby", category: "SaaS / Dev Tools" },
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
