import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingZones, shippingZonePostalRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shippingZoneSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = shippingZoneSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { postalRules, ...zoneData } = parsed.data;

    const [updated] = await db
      .update(shippingZones)
      .set({ ...zoneData, updatedAt: new Date() })
      .where(eq(shippingZones.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

    // Replace postal rules if provided
    if (postalRules !== undefined) {
      await db.delete(shippingZonePostalRules).where(eq(shippingZonePostalRules.zoneId, id));
      if (postalRules.length > 0) {
        await db.insert(shippingZonePostalRules).values(
          postalRules.map((r) => ({
            zoneId: id,
            type: r.type,
            value: r.value,
            fromValue: r.fromValue,
            toValue: r.toValue,
          })),
        );
      }
    }

    const rules = await db
      .select()
      .from(shippingZonePostalRules)
      .where(eq(shippingZonePostalRules.zoneId, id));

    return NextResponse.json({ zone: { ...updated, postalRules: rules } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(shippingZones).where(eq(shippingZones.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
