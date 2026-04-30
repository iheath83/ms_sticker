import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shippingRuleSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = shippingRuleSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.startsAt !== undefined) {
      updateData.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
    }
    if (parsed.data.endsAt !== undefined) {
      updateData.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    }

    const [updated] = await db
      .update(shippingRules)
      .set(updateData)
      .where(eq(shippingRules.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ rule: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(shippingRules).where(eq(shippingRules.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
