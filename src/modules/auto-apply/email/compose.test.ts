import { describe, it, expect } from "vitest";
import { buildMailtoUrl, composeEmail } from "./compose";

const baseJob = {
  id: "j1",
  title: "Senior React Engineer",
  company: "Acme",
  url: "https://acme.com/jobs/j1",
};

describe("composeEmail", () => {
  it("produces a short, no-fluff email matching the template", () => {
    const draft = composeEmail({
      job: baseJob,
      profile: {
        name: "Arturas",
        linkedinUrl: "https://linkedin.com/in/arturas",
        websiteUrl: "https://arturas.dev",
        cvPath: "/home/me/cv.pdf",
      },
      recipient: { email: "careers@acme.com", reason: "from JD" },
      fromAddress: "hello.arturas.miceika@gmail.com",
    });
    expect(draft.subject).toBe("Re: Senior React Engineer at Acme");
    expect(draft.to).toBe("careers@acme.com");
    expect(draft.from).toBe("hello.arturas.miceika@gmail.com");
    expect(draft.body).toContain("Senior React Engineer");
    expect(draft.body).toContain("Acme");
    expect(draft.body).toContain("LinkedIn: https://linkedin.com/in/arturas");
    expect(draft.body).toContain("Website: https://arturas.dev");
    expect(draft.body).toContain("My CV is attached");
    expect(draft.attachments).toEqual(["/home/me/cv.pdf"]);
  });

  it("omits CV-attached line if no CV path", () => {
    const draft = composeEmail({
      job: baseJob,
      profile: { name: "Arturas" },
      recipient: { email: "careers@acme.com", reason: "common pattern" },
      fromAddress: "hello.arturas.miceika@gmail.com",
    });
    expect(draft.body).toContain("My CV is available on request");
    expect(draft.attachments).toEqual([]);
  });
});

describe("buildMailtoUrl", () => {
  it("builds a valid mailto with subject and body", () => {
    const draft = composeEmail({
      job: baseJob,
      profile: { name: "Arturas", linkedinUrl: "https://linkedin.com/in/arturas" },
      recipient: { email: "careers@acme.com", reason: "" },
      fromAddress: "hello.arturas.miceika@gmail.com",
    });
    const url = buildMailtoUrl(draft);
    expect(url.startsWith("mailto:careers%40acme.com?")).toBe(true);
    expect(url).toContain("subject=");
    expect(url).toContain("body=");
    expect(url).not.toContain("+"); // spaces encoded as %20, not +
  });

  it("notes manual attachment in body when CV path present", () => {
    const draft = composeEmail({
      job: baseJob,
      profile: { name: "Arturas", cvPath: "/home/me/cv.pdf" },
      recipient: { email: "careers@acme.com", reason: "" },
      fromAddress: "hello.arturas.miceika@gmail.com",
    });
    const url = buildMailtoUrl(draft);
    expect(decodeURIComponent(url)).toContain("[attach manually: /home/me/cv.pdf]");
  });
});
