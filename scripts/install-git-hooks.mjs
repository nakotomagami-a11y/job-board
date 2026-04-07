#!/usr/bin/env node
/**
 * Installs the project's git pre-commit hook into .git/hooks/pre-commit.
 *
 * Run automatically by the `prepare` script after `npm install`. Idempotent —
 * safely overwrites itself but never replaces a hook the user has customized
 * (we tag the hook with a sentinel comment and bail if it's missing).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SENTINEL = "# job-board pre-commit hook";

const HOOK_BODY = `#!/bin/sh
${SENTINEL}
# Runs eslint on staged JS/TS files. Skip with: git commit --no-verify
set -e

STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(ts|tsx|js|jsx|mjs|cjs)$' || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

# Run eslint only on staged files. --no-warn-ignored prevents noise on ignored paths.
echo "$STAGED" | xargs npx eslint --no-warn-ignored
`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gitDir = path.join(repoRoot, ".git");
const hooksDir = path.join(gitDir, "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

if (!fs.existsSync(gitDir)) {
  // Not a git checkout (e.g. extracted tarball) — nothing to do.
  process.exit(0);
}

fs.mkdirSync(hooksDir, { recursive: true });

if (fs.existsSync(hookPath)) {
  const existing = fs.readFileSync(hookPath, "utf8");
  if (!existing.includes(SENTINEL)) {
    console.error(
      "[install-git-hooks] .git/hooks/pre-commit exists and is not managed by this script — leaving it alone."
    );
    process.exit(0);
  }
}

fs.writeFileSync(hookPath, HOOK_BODY, { mode: 0o755 });
console.log("[install-git-hooks] Installed pre-commit hook.");
