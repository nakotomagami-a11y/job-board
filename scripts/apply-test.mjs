/**
 * Standalone diagnostic: opens a Greenhouse application form, tries to fill
 * every field using the answer bank, and prints a results table.
 *
 * Usage: node scripts/apply-test.mjs
 *
 * Reads data/user/answer-bank.json. Run scripts/migrate-apply-pack.mjs first
 * if you haven't migrated yet.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

chromium.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BROWSER_PROFILE = '/tmp/apply-test-profile';
const URL = 'https://job-boards.greenhouse.io/anthropic/jobs/5223916008';
const SCREENSHOT = '/tmp/apply-test-fullpage.png';

// ── Load answer bank ──────────────────────────────────────────────────────────

const bankPath = path.join(root, 'data', 'user', 'answer-bank.json');
let bank;
try {
  bank = JSON.parse(await fs.readFile(bankPath, 'utf-8'));
} catch {
  console.error(`[test] Could not read ${bankPath}`);
  console.error('Run: node scripts/migrate-apply-pack.mjs');
  process.exit(1);
}

// ── Matcher (mirrors src/lib/answer-bank.ts logic, no TS import in .mjs) ─────

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function tokenize(s) {
  return new Set(normalize(s).split(/\s+/).filter(Boolean));
}

function jaccard(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function matchQuestion(questionText) {
  const normQ = normalize(questionText);
  let best = null;

  for (const [key, field] of Object.entries(bank.fields)) {
    if (normQ === normalize(key)) {
      best = { key, confidence: 1.0, source: 'exact' };
      continue;
    }
    let variantHit = false;
    for (const v of field.questionVariants) {
      if (normQ === normalize(v)) {
        if (!best || 1.0 > best.confidence) best = { key, confidence: 1.0, source: 'variant' };
        variantHit = true;
        break;
      }
    }
    if (variantHit) continue;
    for (const candidate of [key, ...field.questionVariants]) {
      const score = jaccard(questionText, candidate);
      if (score > 0.7) {
        const confidence = 0.7 + ((score - 0.7) / 0.3) * 0.25;
        if (!best || confidence > best.confidence) {
          best = { key, confidence, source: 'fuzzy' };
        }
      }
    }
  }
  return best;
}

// ── Fill helper ───────────────────────────────────────────────────────────────

async function tryFill(page, questionText, value, results) {
  if (!value) {
    results.push({ questionText, matched: null, filled: false, value: '(empty)', confidence: null, source: null });
    return;
  }
  const escapedQ = questionText.replace(/"/g, '\\"');

  // Label-based
  try {
    const loc = page.getByLabel(new RegExp(questionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first();
    if (await loc.count() > 0) {
      const tag = await loc.evaluate(el => el.tagName.toLowerCase());
      if (tag === 'select') {
        await loc.selectOption({ label: value }).catch(() => {});
      } else {
        await loc.fill(value);
      }
      results.push({ questionText, matched: 'label', filled: true, value });
      return;
    }
  } catch { /* try next */ }

  // Placeholder-based
  try {
    const loc = page.locator(`input[placeholder*="${escapedQ}" i], textarea[placeholder*="${escapedQ}" i]`).first();
    if (await loc.count() > 0) {
      await loc.fill(value);
      results.push({ questionText, matched: 'placeholder', filled: true, value });
      return;
    }
  } catch { /* try next */ }

  results.push({ questionText, matched: null, filled: false, value });
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('[test] launching Brave...');
const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
  headless: false,
  executablePath: '/opt/brave.com/brave/brave',
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

console.log('[test] navigating...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
console.log('[test] reached', await page.url());

// Enumerate all labels + placeholders from page
const labelTexts = await page.locator('label').allInnerTexts();
const placeholders = await page.locator('[placeholder]')
  .evaluateAll(els => els.map(el => el.placeholder).filter(Boolean));

const seen = new Set();
const pageQuestions = [];
for (const q of [...labelTexts, ...placeholders]) {
  const t = q.trim();
  if (!t) continue;
  const n = t.toLowerCase();
  if (!seen.has(n)) { seen.add(n); pageQuestions.push(t); }
}

console.log(`[test] found ${pageQuestions.length} question signals on page`);

// Match and fill
const results = [];
const matchSummary = [];

for (const questionText of pageQuestions) {
  const match = matchQuestion(questionText);
  matchSummary.push({
    question: questionText.slice(0, 50),
    key: match?.key ?? '—',
    confidence: match ? match.confidence.toFixed(2) : '0.00',
    source: match?.source ?? 'none',
  });

  if (!match || match.confidence < 0.9) continue; // below auto-fill threshold
  const value = bank.fields[match.key]?.value;
  if (value) {
    await tryFill(page, questionText, value, results);
  }
}

console.log('\n=== MATCH SUMMARY ===');
console.table(matchSummary);

console.log('\n=== FILL RESULTS ===');
console.table(results);
const filledCount = results.filter(r => r.filled).length;
console.log(`\nFilled ${filledCount}/${results.length} attempted fields`);

// Show all labels for diagnostics
const allLabels = await page.locator('label').allInnerTexts();
console.log('\n=== ALL LABELS ON PAGE ===');
console.log(allLabels.filter(t => t.trim().length > 0).slice(0, 30).join('\n'));

await page.screenshot({ path: SCREENSHOT, fullPage: true });
console.log(`\nScreenshot: ${SCREENSHOT}`);

// Print bank summary
console.log('\n=== BANK SUMMARY ===');
const bankRows = Object.entries(bank.fields).map(([key, f]) => ({
  key,
  value: f.value ? f.value.slice(0, 40) : '(empty)',
  type: f.type,
  variants: f.questionVariants.length,
  usedCount: f.usedCount,
}));
console.table(bankRows);

console.log('Keeping window open for 30 seconds for visual inspection...');
await new Promise(r => setTimeout(r, 30000));

await context.close();
console.log('done');
