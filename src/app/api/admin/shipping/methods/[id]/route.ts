import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingMethods } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shippingMethodSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = shippingMethodSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const [updated] = await db
      .update(shippingMethods)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(shippingMethods.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ method: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(shippingMethods).where(eq(shippingMethods.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
