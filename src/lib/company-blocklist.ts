import fs from "fs/promises";
import path from "path";

const BLOCKLIST_PATH = path.join(process.cwd(), "data", "user", "blocked-companies.json");

export interface Blocklist {
  version: number;
  updatedAt: string | null;
  companies: string[];
}

const DEFAULT_BLOCKLIST: Blocklist = {
  version: 1,
  updatedAt: null,
  companies: [],
};

export async function readBlocklist(): Promise<Blocklist> {
  try {
    const raw = await fs.readFile(BLOCKLIST_PATH, "utf-8");
    return JSON.parse(raw) as Blocklist;
  } catch {
    return { ...DEFAULT_BLOCKLIST };
  }
}

export async function writeBlocklist(list: Blocklist): Promise<void> {
  await fs.mkdir(path.dirname(BLOCKLIST_PATH), { recursive: true });
  // Tmp file MUST live in the same dir as the target so fs.rename() stays
  // on the same filesystem (rename across mounts fails with EXDEV on Linux).
  const tmp = `${BLOCKLIST_PATH}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2));
  await fs.rename(tmp, BLOCKLIST_PATH);
}

export async function addCompany(
  name: string
): Promise<{ added: boolean; alreadyPresent: boolean }> {
  const trimmed = name.trim();
  const list = await readBlocklist();
  const key = trimmed.toLowerCase();
  const exists = list.companies.some((c) => c.toLowerCase() === key);
  if (exists) return { added: false, alreadyPresent: true };
  list.companies.push(trimmed);
  list.updatedAt = new Date().toISOString();
  await writeBlocklist(list);
  return { added: true, alreadyPresent: false };
}

export async function removeCompany(
  name: string
): Promise<{ removed: boolean }> {
  const key = name.trim().toLowerCase();
  const list = await readBlocklist();
  const before = list.companies.length;
  list.companies = list.companies.filter((c) => c.toLowerCase() !== key);
  if (list.companies.length === before) return { removed: false };
  list.updatedAt = new Date().toISOString();
  await writeBlocklist(list);
  return { removed: true };
}

// Match rule: case-insensitive, whole-word on both sides using \b.
// "Revolut" blocks "Revolut", "Revolut Ltd", "Revolut Bank" (word boundary after token).
// "Revolut" does NOT block "Revolutionary Robotics" (no \b after t if followed by i).
// Edge case: adding a short common word like "Inc" would only match " Inc " / "Inc" as
// a complete token -- it would NOT match inside "Innovative Inc" because "Inc" appears at
// end, which IS a match. Users should avoid adding fragment tokens.
export function isBlocked(companyName: string, blocklist: Blocklist): boolean {
  const name = companyName.trim();
  if (!name) return false;
  for (const entry of blocklist.companies) {
    const escaped = entry.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(name)) return true;
  }
  return false;
}
