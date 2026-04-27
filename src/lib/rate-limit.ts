/**
 * PostgreSQL-based rate limiter — no Redis needed.
 * Uses the rate_limits table defined in schema.ts.
 *
 * Strategy: sliding window using windowStart timestamp.
 * A key is blocked for windowSeconds once maxAttempts is exceeded.
 */

import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ISO string of when the block lifts, only set when allowed=false */
  retryAfter?: string;
}

/**
 * Check and increment the rate limit for a given key.
 *
 * @param key          Unique string (e.g. "login:1.2.3.4")
 * @param maxAttempts  Max requests allowed in the window
 * @param windowSeconds Duration of the sliding window in seconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowSeconds * 1000);

  try {
    const [existing] = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    // Currently blocked
    if (existing?.blockedUntil && existing.blockedUntil > now) {
      return { allowed: false, remaining: 0, retryAfter: existing.blockedUntil.toISOString() };
    }

    // No record or window expired → reset / create
    if (!existing || existing.windowStart < windowCutoff) {
      if (!existing) {
        await db.insert(rateLimits).values({ key, attempts: 1, windowStart: now });
      } else {
        await db
          .update(rateLimits)
          .set({ attempts: 1, windowStart: now, blockedUntil: null })
          .where(eq(rateLimits.key, key));
      }
      return { allowed: true, remaining: maxAttempts - 1 };
    }

    // Within window — increment
    const newAttempts = existing.attempts + 1;

    if (newAttempts > maxAttempts) {
      const blockedUntil = new Date(now.getTime() + windowSeconds * 1000);
      await db
        .update(rateLimits)
        .set({ attempts: newAttempts, blockedUntil })
        .where(eq(rateLimits.key, key));
      return { allowed: false, remaining: 0, retryAfter: blockedUntil.toISOString() };
    }

    await db
      .update(rateLimits)
      .set({ attempts: newAttempts })
      .where(eq(rateLimits.key, key));

    return { allowed: true, remaining: maxAttempts - newAttempts };
  } catch (err) {
    // On DB error, fail open to avoid blocking legitimate users
    console.error("[rate-limit] DB error, failing open:", err);
    return { allowed: true, remaining: maxAttempts };
  }
}
