/**
 * Tiny in-memory rate limiter for API routes.
 *
 * Fixed window per (key, bucket). Designed for a local/dev single-user app —
 * not horizontally scalable, not persisted. Good enough to stop runaway
 * loops or accidental hammering of expensive endpoints.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Bucket name (route identifier). */
  bucket: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

function getClientKey(req: Request): string {
  // Try common forwarded headers first; fall back to a fixed key.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "local";
}

export function rateLimit(req: Request, opts: RateLimitOptions): RateLimitResult {
  const key = `${opts.bucket}:${getClientKey(req)}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}

/** Sweep expired buckets. Call occasionally to prevent unbounded growth. */
export function sweepRateLimitBuckets(): void {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}
