import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingBlackoutDates } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shippingBlackoutDates).orderBy(asc(shippingBlackoutDates.date));
  return NextResponse.json({ blackouts: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const [created] = await db.insert(shippingBlackoutDates).values({
      date: String(body.date ?? ""),
      reason: body.reason ? String(body.reason) : null,
      isRecurring: Boolean(body.isRecurring ?? false),
      affectsMethodIds: (body.affectsMethodIds as string[]) ?? [],
    }).returning();
    return NextResponse.json({ blackout: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
