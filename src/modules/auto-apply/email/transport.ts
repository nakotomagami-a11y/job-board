import fs from "fs/promises";
import path from "path";
import type { EmailDraft } from "./compose";

export type EmailTransport = "mailto" | "smtp";

export interface EmailConfig {
  fromAddress: string;
  transport: EmailTransport;
  smtp?: {
    host: string;
    port: number;
    user: string;
    // Path to env var holding the app password — never store the secret in JSON.
    passwordEnv: string;
  };
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  fromAddress: "hello.arturas.miceika@gmail.com",
  transport: "mailto",
};

const EMAIL_CONFIG_PATH = path.join(
  process.cwd(),
  "data",
  "user",
  "auto-apply",
  "email-config.json",
);

export async function loadEmailConfig(): Promise<EmailConfig> {
  try {
    const raw = await fs.readFile(EMAIL_CONFIG_PATH, "utf-8");
    return { ...DEFAULT_EMAIL_CONFIG, ...(JSON.parse(raw) as Partial<EmailConfig>) };
  } catch {
    return DEFAULT_EMAIL_CONFIG;
  }
}

export async function saveEmailConfig(config: EmailConfig): Promise<EmailConfig> {
  await fs.mkdir(path.dirname(EMAIL_CONFIG_PATH), { recursive: true });
  await fs.writeFile(EMAIL_CONFIG_PATH, JSON.stringify(config, null, 2));
  return config;
}

export interface SendResult {
  ok: boolean;
  transport: EmailTransport;
  detail: string;
}

/**
 * Hand off to the user's mail client by opening a mailto: URL via the
 * platform "open" command. The user then reviews and clicks Send in Gmail.
 *
 * Linux: xdg-open. macOS: open. Windows: start.
 */
export async function openMailto(url: string): Promise<SendResult> {
  const { spawn } = await import("child_process");
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", (err) => {
      resolve({ ok: false, transport: "mailto", detail: `failed to open mail client: ${err.message}` });
    });
    child.on("spawn", () => {
      child.unref();
      resolve({ ok: true, transport: "mailto", detail: "opened in default mail handler — review and click Send" });
    });
  });
}

/**
 * SMTP send. Disabled until the user (a) installs nodemailer and (b) sets up
 * a Gmail app password. Throws a clear error if invoked without setup so it
 * cannot silently fail.
 */
export async function sendViaSmtp(
  _draft: EmailDraft,
  _config: EmailConfig,
): Promise<SendResult> {
  throw new Error(
    "SMTP transport not yet wired. To enable: " +
      "(1) `npm install nodemailer`, " +
      "(2) generate a Gmail app password (myaccount.google.com → Security → App passwords), " +
      "(3) export it as the env var named in email-config.json (default GMAIL_APP_PASSWORD), " +
      "(4) update email-config.json: { transport: 'smtp', smtp: { host: 'smtp.gmail.com', port: 465, user: 'hello.arturas.miceika@gmail.com', passwordEnv: 'GMAIL_APP_PASSWORD' } }",
  );
}
