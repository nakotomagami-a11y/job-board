import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import { SESSIONS_DIR, newSession, readSession, writeSession, appendLog } from "./session";

const TEST_ID = "test-session-xyz";

async function cleanup() {
  try {
    await fs.unlink(path.join(SESSIONS_DIR, `${TEST_ID}.json`));
  } catch {
    // ignore — file may not exist on first run
  }
}

describe("session storage", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("round-trips a session via writeSession/readSession", async () => {
    const s = newSession({ id: TEST_ID, jobUrl: "https://example.com/job/1" });
    await writeSession(s);
    const loaded = await readSession(TEST_ID);
    expect(loaded?.id).toBe(TEST_ID);
    expect(loaded?.status).toBe("init");
    expect(loaded?.log.length).toBe(1);
  });

  it("appendLog produces a new entry without mutating the original", () => {
    const s = newSession({ id: TEST_ID, jobUrl: "https://example.com" });
    const next = appendLog(s, "info", "hello");
    expect(s.log.length).toBe(1);
    expect(next.log.length).toBe(2);
    expect(next.log[1].message).toBe("hello");
  });
});
