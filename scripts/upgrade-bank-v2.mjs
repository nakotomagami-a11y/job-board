#!/usr/bin/env node
// One-shot migration: adds EEO + common-question fields and extends existing
// entry variants for workAuthorization / visaSponsorship / previouslyInterviewed.
// Safe to run multiple times (idempotent).

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK_PATH = path.join(ROOT, 'data', 'user', 'answer-bank.json');

const NOW = new Date().toISOString();

// New fields to add if not already present
const NEW_FIELDS = {
  preferredPronouns: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: ['Preferred Pronouns', 'Pronouns', 'What are your pronouns?'],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  locationCity: {
    value: 'Vilnius',
    type: 'shortText',
    questionVariants: ['Location (City)', 'City', 'Current City'],
    source: 'profile',
    createdAt: NOW,
    usedCount: 0,
  },
  currentCompany: {
    value: 'XBorg',
    type: 'shortText',
    questionVariants: [
      'Current or most recent company?',
      'Current Company',
      'Most Recent Employer',
      "Company you're working for",
    ],
    source: 'profile',
    createdAt: NOW,
    usedCount: 0,
  },
  hearAboutJob: {
    value: 'Found role through job-board aggregator',
    type: 'shortText',
    questionVariants: [
      'How did you hear about this job?',
      'Where did you first hear about this role?',
      'How did you find us?',
      'Source of application',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  hybridOfficeWillingness: {
    value: 'No — remote only',
    type: 'yesNoExplanation',
    questionVariants: [
      'Are you willing to work from our office?',
      'Office hybrid willingness',
      'Are you open to in-office work?',
      'Are you willing to work from our office location 3 days per week?',
      'We work under a hybrid in-office model. Are you willing to work from our office location 3 days per week?',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  previouslyWorkedHere: {
    value: 'No',
    type: 'yesNoExplanation',
    questionVariants: [
      'Have you previously worked for this company?',
      'Have you previously worked here?',
      'Are you a former employee?',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  marketingOptIn: {
    value: 'No',
    type: 'yesNoExplanation',
    questionVariants: [
      'Please email me about future job openings',
      'Subscribe to future opportunities',
      'Future job notifications',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  consentDataProcessing: {
    value: 'Yes',
    type: 'yesNoExplanation',
    questionVariants: [
      'I consent to have my personal information retained',
      'I agree to the privacy policy',
      'I consent to data processing',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoGender: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'Gender',
      'What is your gender?',
      'What gender identity do you most closely identify with?',
      'Gender Identity',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoEthnicity: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'Are you Hispanic/Latino?',
      'Race/Ethnicity',
      'How would you describe your racial/ethnic background?',
      'Ethnicity',
      'Race',
      'What is your race or ethnicity?',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoVeteran: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'Veteran Status',
      'Are you a veteran?',
      'Are you a veteran or active member of the United States Armed Forces?',
      'Military service',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoDisability: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'Disability Status',
      'Do you have a disability?',
      'Do you have a disability or chronic condition',
      'Disability disclosure',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoSexualOrientation: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'What sexual orientation do you most closely identify with?',
      'Sexual orientation',
      'LGBTQ+ identification',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoAgeRange: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: ['What age range do you fall within?', 'Age', 'Age range', 'Date of Birth'],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
  eeoTransgender: {
    value: 'Decline to answer',
    type: 'shortText',
    questionVariants: [
      'Are you a person of transgender experience?',
      'Transgender',
      'Gender modality',
    ],
    source: 'default',
    createdAt: NOW,
    usedCount: 0,
  },
};

// Additional variants to append to existing entries (deduped)
const EXTRA_VARIANTS = {
  workAuthorization: [
    "Do you currently have legal authorization to work in the country in which the job you're applying for is located?",
    'Are you authorised to work in the country in which this role is located?',
    'Do you have legal work authorization?',
    'Authorized to work?',
  ],
  visaSponsorship: [
    "Will you now or in the future require employment visa sponsorship to work in the country in which the job you're applying for is located?",
    'Will you require sponsorship now or in the future?',
    'Will you need US work authorization sponsorship in the future?',
  ],
  previouslyInterviewed: [
    'Have you previously worked for this company?',
    'Have you applied to this company before?',
  ],
};

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

let bank;
try {
  bank = JSON.parse(await fs.readFile(BANK_PATH, 'utf-8'));
} catch {
  console.error(`Could not read ${BANK_PATH} — run from the project root after copying data/user.example/ → data/user/`);
  process.exit(1);
}

let addedFields = 0;
let skippedFields = 0;
let addedVariants = 0;

// Add new fields
for (const [key, field] of Object.entries(NEW_FIELDS)) {
  if (bank.fields[key]) {
    skippedFields++;
    console.log(`  skip (exists): ${key}`);
  } else {
    bank.fields[key] = field;
    addedFields++;
    console.log(`  added: ${key}`);
  }
}

// Append missing variants to existing entries
for (const [key, variants] of Object.entries(EXTRA_VARIANTS)) {
  const field = bank.fields[key];
  if (!field) {
    console.log(`  skip variants for "${key}" — key not in bank`);
    continue;
  }
  for (const variant of variants) {
    const normNew = normalize(variant);
    const exists = field.questionVariants.some((v) => normalize(v) === normNew);
    if (!exists) {
      field.questionVariants.push(variant);
      addedVariants++;
      console.log(`  variant added to ${key}: "${variant}"`);
    }
  }
}

bank.updatedAt = NOW;

// Atomic write
const tmp = `${BANK_PATH}.tmp`;
await fs.writeFile(tmp, JSON.stringify(bank, null, 2));
await fs.rename(tmp, BANK_PATH);

console.log(`\nDone. Fields added: ${addedFields}, skipped: ${skippedFields}, variants added: ${addedVariants}`);
