#!/usr/bin/env node
// Interactive CLI for the auto-apply pause-and-ask flow.
// Watches session files in data/user/auto-apply/sessions/ and prompts you
// when a session is awaiting answers or awaiting submit confirmation.
//
// Usage:
//   node scripts/auto-apply-cli.mjs           # watch all sessions
//   node scripts/auto-apply-cli.mjs <id>      # bind to a single session

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { spawn } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

const ROOT = process.cwd();
const SESSIONS_DIR = path.join(ROOT, "data", "user", "auto-apply", "sessions");
const ANSWER_BANK_PATH = path.join(ROOT, "data", "user", "answer-bank.json");
const EMAIL_DRAFTS_DIR = path.join(ROOT, "data", "user", "auto-apply", "email-drafts");
const POLL_MS = 500;

const rl = readline.createInterface({ input, output });

async function ask(q) {
  return (await rl.question(q)).trim();
}

async function readJsonOrNull(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

async function writeJsonAtomic(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fs.rename(tmp, p);
}

async function listSessions() {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const out = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
      const s = await readJsonOrNull(path.join(SESSIONS_DIR, f));
      if (s) out.push(s);
    }
    return out;
  } catch {
    return [];
  }
}

function sessionFile(id) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

async function loadAnswerBank() {
  const bank = await readJsonOrNull(ANSWER_BANK_PATH);
  if (bank && bank.version === 1) return bank;
  return { version: 1, entries: [], normalizations: [], updatedAt: new Date(0).toISOString() };
}

async function saveAnswerBank(bank) {
  await writeJsonAtomic(ANSWER_BANK_PATH, { ...bank, updatedAt: new Date().toISOString() });
}

function fingerprint(label, fieldType) {
  const norm = String(label)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${fieldType}::${norm}`;
}

function buildAnswerValue(field, raw) {
  switch (field.fieldType) {
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) return null;
      return { kind: "number", number: n };
    }
    case "checkbox": {
      const v = raw.toLowerCase();
      if (["y", "yes", "true", "1"].includes(v)) return { kind: "boolean", boolean: true };
      if (["n", "no", "false", "0"].includes(v)) return { kind: "boolean", boolean: false };
      return null;
    }
    case "select":
    case "radio": {
      if (!field.options || field.options.length === 0) return { kind: "choice", choice: raw };
      const exact = field.options.find((o) => o === raw);
      if (exact) return { kind: "choice", choice: exact };
      const idx = Number(raw);
      if (Number.isInteger(idx) && idx >= 1 && idx <= field.options.length) {
        return { kind: "choice", choice: field.options[idx - 1] };
      }
      return null;
    }
    case "multiselect":
    case "checkboxGroup": {
      if (!field.options || field.options.length === 0) {
        return { kind: "choices", choices: raw.split(",").map((s) => s.trim()).filter(Boolean) };
      }
      const picks = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((tok) => {
          const idx = Number(tok);
          if (Number.isInteger(idx) && idx >= 1 && idx <= field.options.length) {
            return field.options[idx - 1];
          }
          return field.options.find((o) => o === tok) ?? null;
        });
      if (picks.some((p) => p === null)) return null;
      return { kind: "choices", choices: picks };
    }
    case "file":
      return { kind: "file", assetPath: raw };
    default:
      return { kind: "text", text: raw };
  }
}

async function promptScope() {
  console.log("  scope: [g]lobal  [a]ts  [c]ompany  [o]ne-time (default g)");
  const r = (await ask("  > ")).toLowerCase() || "g";
  if (r.startsWith("a")) return "perAts";
  if (r.startsWith("c")) return "perCompany";
  if (r.startsWith("o")) return "oneTime";
  return "global";
}

async function promptField(field, session) {
  console.log("");
  console.log(`Q: ${field.label}`);
  console.log(`   type=${field.fieldType}${field.required ? " (required)" : ""}${field.intentTag ? ` intent=${field.intentTag}` : ""}`);
  console.log(`   reason: ${field.reason}`);
  if (field.options && field.options.length > 0) {
    console.log("   options:");
    field.options.forEach((o, i) => console.log(`     ${i + 1}. ${o}`));
    console.log("   (enter number or exact text; comma-separate for multi)");
  }
  console.log("   Special: type [skip] to skip this field, [cancel] to cancel the whole application");

  let value = null;
  while (value === null) {
    const raw = await ask("A: ");
    if (raw === "skip") return { skip: true };
    if (raw === "cancel") return { cancel: true };
    value = buildAnswerValue(field, raw);
    if (value === null) {
      console.log("  ! could not parse — try again");
    }
  }
  const scope = await promptScope();
  const saveLine = (await ask("  save to answer bank? [Y/n] ")).toLowerCase();
  const saveToBank = !saveLine.startsWith("n") && scope !== "oneTime";
  let scopeKey;
  if (scope === "perAts") scopeKey = session.ats ?? (await ask("  ats key (e.g. greenhouse): "));
  if (scope === "perCompany") scopeKey = session.company ?? (await ask("  company key: "));

  return { resolved: { fieldId: field.fieldId, value, scope, scopeKey, saveToBank } };
}

async function handleAwaitingAnswers(session) {
  const pending = session.pending;
  if (!pending) return;
  console.log("");
  console.log("=".repeat(72));
  console.log(`session ${session.id} — awaiting answers`);
  console.log(`page: ${pending.pageUrl}`);
  if (pending.screenshotPath) console.log(`screenshot: ${pending.screenshotPath}`);
  console.log(`${pending.fields.length} unknown field(s)`);
  console.log("=".repeat(72));

  const resolved = [];
  for (const field of pending.fields) {
    const r = await promptField(field, session);
    if (r.cancel) {
      const s = await readJsonOrNull(sessionFile(session.id));
      await writeJsonAtomic(sessionFile(session.id), {
        ...s,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
        log: [...(s?.log ?? []), { at: new Date().toISOString(), kind: "warn", message: "cancelled at unknown-field prompt" }],
      });
      console.log("session cancelled.");
      return;
    }
    if (r.skip) continue;
    resolved.push(r.resolved);
  }

  // Persist confirmed answers to the bank.
  if (resolved.some((r) => r.saveToBank)) {
    const bank = await loadAnswerBank();
    const now = new Date().toISOString();
    for (const r of resolved) {
      if (!r.saveToBank) continue;
      const field = pending.fields.find((f) => f.fieldId === r.fieldId);
      if (!field) continue;
      const entry = {
        id: `user:${field.intentTag ?? field.fieldId}:${now}`,
        fingerprint: fingerprint(field.label, field.fieldType),
        intentTag: field.intentTag,
        scope: r.scope,
        scopeKey: r.scopeKey,
        fieldType: field.fieldType,
        value: r.value,
        source: "user",
        createdAt: now,
        updatedAt: now,
        useCount: 0,
      };
      const idx = bank.entries.findIndex(
        (e) =>
          e.intentTag === entry.intentTag &&
          e.fingerprint === entry.fingerprint &&
          e.scope === entry.scope &&
          (e.scopeKey ?? "") === (entry.scopeKey ?? ""),
      );
      if (idx >= 0) bank.entries[idx] = { ...entry, createdAt: bank.entries[idx].createdAt };
      else bank.entries.push(entry);
    }
    await saveAnswerBank(bank);
    console.log(`saved ${resolved.filter((r) => r.saveToBank).length} answer(s) to bank`);
  }

  // Resume the runner.
  const fresh = await readJsonOrNull(sessionFile(session.id));
  await writeJsonAtomic(sessionFile(session.id), {
    ...fresh,
    status: "running",
    pending: undefined,
    resolution: { fields: resolved, resolvedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
    log: [...(fresh?.log ?? []), { at: new Date().toISOString(), kind: "resume", message: `resolved ${resolved.length} field(s)` }],
  });
  console.log("runner resumed.");
}

async function handleAwaitingSubmit(session) {
  const req = session.submitRequest;
  if (!req) return;
  console.log("");
  console.log("=".repeat(72));
  console.log(`session ${session.id} — SUBMIT GATE`);
  console.log(`page: ${req.pageUrl}`);
  if (req.screenshotPath) console.log(`screenshot: ${req.screenshotPath}`);
  console.log(`company: ${session.company ?? "(unknown)"}    ats: ${session.ats ?? "(unknown)"}`);
  console.log("");
  console.log("about to submit with these values:");
  console.log("-".repeat(72));
  for (const f of req.filledFields) {
    console.log(`  ${f.label}`);
    console.log(`    = ${f.displayValue}    (${f.source})`);
  }
  console.log("-".repeat(72));
  console.log("type 'confirm' to submit, 'cancel' to abort. Anything else = cancel.");
  const r = (await ask("> ")).trim().toLowerCase();

  const fresh = await readJsonOrNull(sessionFile(session.id));
  const decision = r === "confirm" ? "confirm" : "cancel";
  await writeJsonAtomic(sessionFile(session.id), {
    ...fresh,
    submitDecision: decision,
    status: decision === "confirm" ? "running" : "cancelled",
    updatedAt: new Date().toISOString(),
    log: [
      ...(fresh?.log ?? []),
      { at: new Date().toISOString(), kind: "submit-decision", message: decision },
    ],
  });
  console.log(`decision recorded: ${decision}`);
}

function buildMailtoUrl(draft) {
  const params = new URLSearchParams();
  params.set("subject", draft.subject);
  let body = draft.body;
  if (draft.attachments?.length > 0) {
    body = `${body}\n\n[attach manually: ${draft.attachments.join(", ")}]`;
  }
  params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(draft.to)}?${qs}`;
}

function renderEml(draft) {
  const headers = [
    `From: ${draft.from}`,
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${draft.body}`;
}

async function openUrl(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

async function multilineEdit(initial, label) {
  console.log(`-- editing ${label} --`);
  console.log("(current value below; press Enter to keep, type new value to replace, type EDIT for multi-line)");
  console.log(initial);
  const r = await ask("> ");
  if (r === "") return initial;
  if (r !== "EDIT") return r;
  console.log("Multi-line mode: end with a single line containing only `.`");
  const lines = [];
  while (true) {
    const line = await ask("");
    if (line === ".") break;
    lines.push(line);
  }
  return lines.join("\n");
}

async function handleAwaitingEmailConfirm(session) {
  const req = session.emailRequest;
  if (!req) return;
  console.log("");
  console.log("=".repeat(72));
  console.log(`session ${session.id} — EMAIL FALLBACK`);
  console.log(`job: ${session.jobUrl}`);
  console.log(`blockers: ${(req.blockers ?? []).map((b) => `${b.kind} (${b.evidence})`).join("; ") || "(none)"}`);
  console.log("=".repeat(72));

  // Pick recipient.
  console.log("\nrecipient candidates:");
  if (req.candidates.length === 0) {
    console.log("  (none discovered — you must enter one manually)");
  } else {
    req.candidates.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.email}    [${c.confidence}]  ${c.reason}`);
    });
  }
  console.log("  m. enter manually");
  console.log("  s. skip email (don't send)");
  console.log("  c. cancel session");

  let recipient = null;
  let recipientReason = "";
  while (recipient === null) {
    const r = (await ask("> ")).toLowerCase();
    if (r === "c") {
      const fresh = await readJsonOrNull(sessionFile(session.id));
      await writeJsonAtomic(sessionFile(session.id), {
        ...fresh,
        status: "cancelled",
        emailDecision: { kind: "cancel" },
        updatedAt: new Date().toISOString(),
        log: [...(fresh?.log ?? []), { at: new Date().toISOString(), kind: "email-decision", message: "cancelled" }],
      });
      console.log("session cancelled.");
      return;
    }
    if (r === "s") {
      const fresh = await readJsonOrNull(sessionFile(session.id));
      await writeJsonAtomic(sessionFile(session.id), {
        ...fresh,
        status: "running",
        emailDecision: { kind: "skip" },
        updatedAt: new Date().toISOString(),
        log: [...(fresh?.log ?? []), { at: new Date().toISOString(), kind: "email-decision", message: "skipped" }],
      });
      console.log("email skipped.");
      return;
    }
    if (r === "m") {
      recipient = await ask("recipient email: ");
      recipientReason = "user-provided";
      break;
    }
    const idx = Number(r);
    if (Number.isInteger(idx) && idx >= 1 && idx <= req.candidates.length) {
      recipient = req.candidates[idx - 1].email;
      recipientReason = req.candidates[idx - 1].reason;
      break;
    }
    console.log("  ! pick a number, or m / s / c");
  }

  // Edit draft.
  const draft = { ...req.draft, to: recipient, recipientReason };
  console.log("\ndraft:");
  console.log(`  From: ${draft.from}`);
  console.log(`  To:   ${draft.to}`);
  console.log(`  Subject: ${draft.subject}`);
  console.log("  ---");
  draft.body.split("\n").forEach((l) => console.log(`  ${l}`));
  if (draft.attachments?.length) console.log(`  attachments: ${draft.attachments.join(", ")}`);
  console.log("");
  console.log("edit? [y/N]");
  const editAns = (await ask("> ")).toLowerCase();
  if (editAns.startsWith("y")) {
    draft.subject = await multilineEdit(draft.subject, "subject");
    draft.body = await multilineEdit(draft.body, "body");
  }

  console.log("\ntype 'send' to open in your mail client, anything else cancels.");
  const decision = (await ask("> ")).trim().toLowerCase();

  if (decision !== "send") {
    const fresh = await readJsonOrNull(sessionFile(session.id));
    await writeJsonAtomic(sessionFile(session.id), {
      ...fresh,
      status: "cancelled",
      emailDecision: { kind: "cancel" },
      updatedAt: new Date().toISOString(),
      log: [...(fresh?.log ?? []), { at: new Date().toISOString(), kind: "email-decision", message: "cancelled at draft review" }],
    });
    console.log("cancelled.");
    return;
  }

  // Persist .eml + record, open mailto.
  await fs.mkdir(EMAIL_DRAFTS_DIR, { recursive: true });
  const emailId = `${session.id}-${Date.now()}`;
  const emlPath = path.join(EMAIL_DRAFTS_DIR, `${emailId}.eml`);
  await fs.writeFile(emlPath, renderEml(draft));
  const mailtoUrl = buildMailtoUrl(draft);
  const opened = await openUrl(mailtoUrl);
  await writeJsonAtomic(path.join(EMAIL_DRAFTS_DIR, `${emailId}.json`), {
    id: emailId,
    status: opened ? "awaiting-confirm" : "error",
    transport: "mailto",
    draft,
    mailtoUrl,
    emlPath,
    error: opened ? undefined : "failed to open mail client",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (opened) {
    console.log(`opened in mail client. Review and click Send in Gmail.`);
    console.log(`draft saved at: ${emlPath}`);
  } else {
    console.log(`could not open mail client. mailto URL:`);
    console.log(mailtoUrl);
    console.log(`draft saved at: ${emlPath}`);
  }

  const fresh = await readJsonOrNull(sessionFile(session.id));
  await writeJsonAtomic(sessionFile(session.id), {
    ...fresh,
    status: "emailed",
    emailDecision: { kind: "send", finalDraft: draft },
    updatedAt: new Date().toISOString(),
    log: [
      ...(fresh?.log ?? []),
      { at: new Date().toISOString(), kind: "email-decision", message: `emailed ${recipient}` },
    ],
  });
}

async function tick(boundId) {
  const sessions = await listSessions();
  const targets = boundId ? sessions.filter((s) => s.id === boundId) : sessions;
  for (const s of targets) {
    if (s.status === "awaiting-answers") {
      await handleAwaitingAnswers(s);
    } else if (s.status === "awaiting-submit" && !s.submitDecision) {
      await handleAwaitingSubmit(s);
    } else if (s.status === "awaiting-email-confirm" && !s.emailDecision) {
      await handleAwaitingEmailConfirm(s);
    }
  }
}

async function main() {
  const boundId = process.argv[2];
  console.log(`auto-apply CLI watching ${boundId ? `session ${boundId}` : "all sessions"}`);
  console.log(`(${SESSIONS_DIR})`);
  console.log("Ctrl+C to exit.");
  // Loop forever.
  while (true) {
    try {
      await tick(boundId);
    } catch (e) {
      console.error("tick error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
