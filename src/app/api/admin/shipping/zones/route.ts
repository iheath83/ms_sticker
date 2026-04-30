import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingZones, shippingZonePostalRules } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { shippingZoneSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const zones = await db.select().from(shippingZones).orderBy(asc(shippingZones.name));
  const postalRules = await db.select().from(shippingZonePostalRules);

  const result = zones.map((z) => ({
    ...z,
    postalRules: postalRules.filter((r) => r.zoneId === z.id),
  }));

  return NextResponse.json({ zones: result });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = shippingZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { postalRules, ...zoneData } = parsed.data;

    const zones = await db
      .insert(shippingZones)
      .values({
        name: zoneData.name,
        description: zoneData.description,
        countries: zoneData.countries,
        regions: zoneData.regions,
        cities: zoneData.cities,
        geoRadius: zoneData.geoRadius ?? null,
        isActive: zoneData.isActive,
      })
      .returning();

    const zone = zones[0];
    if (!zone) return NextResponse.json({ error: "Erreur création zone" }, { status: 500 });

    if (postalRules && postalRules.length > 0) {
      await db.insert(shippingZonePostalRules).values(
        postalRules.map((r) => ({
          zoneId: zone.id,
          type: r.type,
          value: r.value,
          fromValue: r.fromValue,
          toValue: r.toValue,
        })),
      );
    }

    const rules = await db
      .select()
      .from(shippingZonePostalRules)
      .where(eq(shippingZonePostalRules.zoneId, zone.id));

    return NextResponse.json({ zone: { ...zone, postalRules: rules } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
