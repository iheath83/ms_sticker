import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, reviewEmailPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // token in URL is the tokenHash directly
  const hash = token;

  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.tokenHash, hash));

  if (!request) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  const email = request.customerEmail;

  await db
    .insert(reviewEmailPreferences)
    .values({
      customerEmail: email,
      customerId: request.customerId ?? null,
      optedOut: true,
      optedOutAt: new Date(),
    })
    .onConflictDoUpdate({
      target: reviewEmailPreferences.customerEmail,
      set: { optedOut: true, optedOutAt: new Date(), updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
