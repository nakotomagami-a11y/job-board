import type { Job } from "@shared/types/job";
import type { UserProfile } from "@shared/types/profile";

export interface EmailDraft {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: string[]; // file paths
  jobId?: string;
  jobUrl: string;
  recipientReason: string;
}

export interface ComposeInput {
  job: Pick<Job, "id" | "title" | "company" | "url">;
  profile: Pick<UserProfile, "name" | "linkedinUrl" | "websiteUrl" | "githubUrl" | "cvPath">;
  recipient: { email: string; reason: string };
  fromAddress: string;
}

/**
 * Build a short, no-fluff outreach email. Wording matches the user's spec —
 * intentionally not "personalized" by an LLM; templated only.
 */
export function composeEmail(input: ComposeInput): EmailDraft {
  const { job, profile, recipient, fromAddress } = input;
  const role = job.title;
  const company = job.company;

  const links: string[] = [];
  if (profile.linkedinUrl) links.push(`LinkedIn: ${profile.linkedinUrl}`);
  if (profile.websiteUrl) links.push(`Website: ${profile.websiteUrl}`);
  if (profile.githubUrl) links.push(`GitHub: ${profile.githubUrl}`);

  const greeting = "Hi,";
  const opening = `I came across your ${role} opening at ${company} and think I might be a good fit.`;
  const cvLine = profile.cvPath ? "My CV is attached." : "My CV is available on request.";
  const linksBlock = links.length > 0 ? links.join("\n") : "";
  const closing = "Happy to chat if useful.";
  const sig = profile.name ? `Thanks,\n${profile.name}` : "Thanks";

  const body = [
    greeting,
    "",
    opening,
    cvLine,
    "",
    linksBlock,
    linksBlock ? "" : null,
    closing,
    "",
    sig,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const subject = `Re: ${role} at ${company}`;

  const attachments = profile.cvPath ? [profile.cvPath] : [];

  return {
    from: fromAddress,
    to: recipient.email,
    subject,
    body,
    attachments,
    jobId: job.id,
    jobUrl: job.url,
    recipientReason: recipient.reason,
  };
}

/**
 * Build a mailto: URL. Note: mailto cannot attach files — the user attaches
 * the CV in their compose window. We include the CV path in the body so it's
 * easy to drag in.
 */
export function buildMailtoUrl(draft: EmailDraft): string {
  const params = new URLSearchParams();
  params.set("subject", draft.subject);
  let body = draft.body;
  if (draft.attachments.length > 0) {
    body = `${body}\n\n[attach manually: ${draft.attachments.join(", ")}]`;
  }
  params.set("body", body);
  // mailto encoding: spaces → %20, not + (some clients dislike +)
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(draft.to)}?${qs}`;
}
