import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingTimeSlots } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shippingTimeSlots).orderBy(asc(shippingTimeSlots.startTime));
  return NextResponse.json({ slots: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const [created] = await db.insert(shippingTimeSlots).values({
      label: String(body.label ?? ""),
      startTime: String(body.startTime ?? "09:00"),
      endTime: String(body.endTime ?? "18:00"),
      daysOfWeek: (body.daysOfWeek as number[]) ?? [1, 2, 3, 4, 5],
      maxCapacity: Number(body.maxCapacity ?? 0),
      extraPriceCents: Number(body.extraPriceCents ?? 0),
      isActive: Boolean(body.isActive ?? true),
    }).returning();
    return NextResponse.json({ slot: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
