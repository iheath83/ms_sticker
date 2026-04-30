import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  const cookieKey = `review_helpful_${reviewId}`;
  const cookie = req.cookies.get(cookieKey);

  if (cookie) {
    return NextResponse.json({ error: "Déjà voté" }, { status: 409 });
  }

  let helpful = true;
  try {
    const body = await req.json();
    helpful = body.helpful !== false;
  } catch {
    // default helpful=true
  }

  const [row] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.id, reviewId));
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (helpful) {
    await db.update(reviews).set({ helpfulCount: sql`${reviews.helpfulCount} + 1` }).where(eq(reviews.id, reviewId));
  } else {
    await db.update(reviews).set({ notHelpfulCount: sql`${reviews.notHelpfulCount} + 1` }).where(eq(reviews.id, reviewId));
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieKey, "1", { maxAge: 60 * 60 * 24 * 30, path: "/" });
  return response;
}
