/**
 * One-off migration: reads data/user/apply-pack.json and data/user/profile.json,
 * writes data/user/answer-bank.json with values mapped to the new schema.
 *
 * Run once manually:
 *   node scripts/migrate-apply-pack.mjs
 *
 * Safe to re-run — existing bank entries are never deleted, only added/updated.
 *
 * NOTE: coverLetterTemplate is intentionally NOT migrated. Cover letters are
 * out of scope (user requested no cover letters).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PACK_PATH  = path.join(root, 'data', 'user', 'apply-pack.json');
const PROFILE_PATH = path.join(root, 'data', 'user', 'profile.json');
const BANK_PATH  = path.join(root, 'data', 'user', 'answer-bank.json');
const EXAMPLE_BANK_PATH = path.join(root, 'data', 'user.example', 'answer-bank.json');

// Read JSON file or return null on missing/parse error.
async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function main() {
  const pack    = await readJson(PACK_PATH);
  const profile = await readJson(PROFILE_PATH);

  if (!pack && !profile) {
    console.log('Neither apply-pack.json nor profile.json found — nothing to migrate.');
    console.log(`Copy data/user.example/answer-bank.json to data/user/answer-bank.json to start fresh.`);
    process.exit(0);
  }

  // Load existing bank (or start from example template).
  let bank = await readJson(BANK_PATH);
  if (!bank) {
    bank = await readJson(EXAMPLE_BANK_PATH);
    if (!bank) {
      console.error('Could not load example bank template. Run from the project root.');
      process.exit(1);
    }
    console.log('No existing bank found — starting from example template.');
  } else {
    console.log('Existing bank found — will merge without deleting existing entries.');
  }

  const now = new Date().toISOString();

  function setField(key, value, { source = 'migrated' } = {}) {
    if (!value) return;
    if (bank.fields[key]) {
      // Update value only; preserve existing variants, usedCount, etc.
      bank.fields[key].value = value;
      bank.fields[key].source = source;
    }
    // If the key doesn't exist in the bank, we leave it — the example template
    // already has all expected fields. Novel keys from an unusual apply-pack
    // would need manual addition.
  }

  // ── From profile.json ──────────────────────────────────────────────────────
  if (profile) {
    const fullName = profile.name ?? '';
    const parts    = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName  = parts.slice(1).join(' ');

    setField('email',           profile.email,    { source: 'profile' });
    setField('fullName',        fullName,          { source: 'profile' });
    setField('firstName',       firstName,         { source: 'profile' });
    setField('lastName',        lastName,          { source: 'profile' });
    setField('currentLocation', profile.location,  { source: 'profile' });
  }

  // ── From apply-pack.json ───────────────────────────────────────────────────
  if (pack) {
    // phoneNumber → phone
    setField('phone',                pack.phoneNumber,          { source: 'apply-pack' });
    setField('linkedinUrl',          pack.linkedinUrl,          { source: 'apply-pack' });
    setField('githubUrl',            pack.githubUrl,            { source: 'apply-pack' });
    setField('portfolioUrl',         pack.portfolioUrl,         { source: 'apply-pack' });
    setField('yearsOfReact',         pack.yearsOfReact,         { source: 'apply-pack' });
    setField('yearsOfTypeScript',    pack.yearsOfTypeScript,    { source: 'apply-pack' });
    setField('salaryExpectationUSD', pack.salaryExpectationUSD, { source: 'apply-pack' });
    setField('workAuthorization',    pack.workAuthorization,    { source: 'apply-pack' });
    setField('noticePeriod',         pack.noticePeriod,         { source: 'apply-pack' });
    setField('willingnessToRelocate',pack.willingnessToRelocate,{ source: 'apply-pack' });
    // coverLetterTemplate intentionally NOT migrated — no cover letters.
  }

  bank.updatedAt = now;

  // Atomic write: tmp file then rename.
  const tmp = `${BANK_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(bank, null, 2));
  await fs.rename(tmp, BANK_PATH);

  console.log('\n✅ Migration complete!');
  console.log(`   Written to: ${BANK_PATH}`);

  // Summary of what was set.
  const populated = Object.entries(bank.fields)
    .filter(([, f]) => f.value)
    .map(([k, f]) => `   ${k}: ${f.value.slice(0, 60)}`);
  console.log(`\n   Populated fields (${populated.length}):`);
  populated.forEach((l) => console.log(l));

  const empty = Object.entries(bank.fields)
    .filter(([, f]) => !f.value)
    .map(([k]) => `   ${k}`);
  if (empty.length > 0) {
    console.log(`\n   Empty fields that still need values (${empty.length}):`);
    empty.forEach((l) => console.log(l));
    console.log('\n   These will appear as unansweredQuestions when you run your first draft.');
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
