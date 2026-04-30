import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingPickupLocations } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shippingPickupLocations).orderBy(asc(shippingPickupLocations.name));
  return NextResponse.json({ locations: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const [created] = await db.insert(shippingPickupLocations).values({
      name: String(body.name ?? ""),
      addressLine1: body.addressLine1 ? String(body.addressLine1) : null,
      addressLine2: body.addressLine2 ? String(body.addressLine2) : null,
      city: body.city ? String(body.city) : null,
      postalCode: body.postalCode ? String(body.postalCode) : null,
      countryCode: String(body.countryCode ?? "FR"),
      phone: body.phone ? String(body.phone) : null,
      instructions: body.instructions ? String(body.instructions) : null,
      daysAvailable: (body.daysAvailable as number[]) ?? [1, 2, 3, 4, 5],
      prepDelayDays: Number(body.prepDelayDays ?? 1),
      slotCapacity: Number(body.slotCapacity ?? 0),
      isActive: Boolean(body.isActive ?? true),
      hoursJson: (body.hoursJson as Record<string, string>) ?? {},
    }).returning();
    return NextResponse.json({ location: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
