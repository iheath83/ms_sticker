import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingPickupLocations } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;
    const [updated] = await db.update(shippingPickupLocations).set({ ...body, updatedAt: new Date() }).where(eq(shippingPickupLocations.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ location: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(shippingPickupLocations).where(eq(shippingPickupLocations.id, id));
  return NextResponse.json({ success: true });
}
