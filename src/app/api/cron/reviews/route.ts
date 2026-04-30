import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, reviewSettings } from "@/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { sendReviewRequestEmail, sendReminderEmail } from "@/lib/reviews/review-email-service";
import { expireOldRequests } from "@/lib/reviews/review-request-service";
import crypto from "crypto";

function generateRawFromHash(_hash: string): string {
  // We can't reverse the hash, so we store a separate raw token or re-generate.
  // Since we stored the hash only, we need a different approach:
  // For cron sends, we build the link from a fresh token stored alongside.
  // For now, use the hash directly as a "public" identifier in the link.
  // The /reviews/request/[token] route hashes the token on each request.
  // So we CANNOT reconstruct the raw token from the hash.
  // Fix: store the raw token encrypted or use the hash as the URL token directly.
  // We'll use the tokenHash as the "token" in URLs (no re-hashing on lookup).
  return _hash;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = {
    expired: 0,
    sent: 0,
    reminded: 0,
    errors: [] as string[],
  };

  // 1. Expire old requests
  try {
    results.expired = await expireOldRequests();
  } catch (err) {
    results.errors.push(`expiration: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Send scheduled emails
  const [settings] = await db.select().from(reviewSettings).where(eq(reviewSettings.id, 1));
  const now = new Date();

  try {
    const scheduled = await db
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.status, "scheduled"), lte(reviewRequests.sendAt, now)));

    for (const request of scheduled) {
      try {
        // Use tokenHash directly as URL token (lookup by hash without re-hashing)
        await sendReviewRequestEmail(request, request.tokenHash);
        await db
          .update(reviewRequests)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(reviewRequests.id, request.id));
        results.sent++;
      } catch (err) {
        results.errors.push(`send ${request.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    results.errors.push(`scheduled: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Send reminders
  if (settings?.remindersEnabled) {
    try {
      const toRemind = await db
        .select()
        .from(reviewRequests)
        .where(
          and(
            inArray(reviewRequests.status, ["sent", "opened"]),
            lte(reviewRequests.nextReminderAt, now),
          ),
        );

      for (const request of toRemind) {
        if (request.reminderCount >= (settings.maxReminderCount ?? 2)) continue;
        try {
          await sendReminderEmail(request, request.tokenHash);
          const nextCount = request.reminderCount + 1;
          const nextAt =
            nextCount < (settings.maxReminderCount ?? 2)
              ? new Date(now.getTime() + (settings.secondReminderDelayDays ?? 7) * 86400_000)
              : null;
          await db
            .update(reviewRequests)
            .set({
              reminderCount: nextCount,
              nextReminderAt: nextAt,
              updatedAt: new Date(),
            })
            .where(eq(reviewRequests.id, request.id));
          results.reminded++;
        } catch (err) {
          results.errors.push(`remind ${request.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      results.errors.push(`reminders: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Set nextReminderAt for newly sent emails
  try {
    const justSent = await db
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.status, "sent"), eq(reviewRequests.reminderCount, 0)));

    for (const request of justSent) {
      if (request.nextReminderAt) continue;
      const nextAt = new Date(
        (request.sentAt ?? now).getTime() + (settings?.firstReminderDelayDays ?? 5) * 86400_000,
      );
      await db
        .update(reviewRequests)
        .set({ nextReminderAt: nextAt, updatedAt: new Date() })
        .where(eq(reviewRequests.id, request.id));
    }
  } catch {
    // non-critical
  }

  return NextResponse.json(results);
}
