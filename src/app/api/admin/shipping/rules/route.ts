import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingRules } from "@/db/schema";
import { asc } from "drizzle-orm";
import { shippingRuleSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shippingRules).orderBy(asc(shippingRules.priority));
  return NextResponse.json({ rules: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = shippingRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const [created] = await db
      .insert(shippingRules)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
        priority: parsed.data.priority,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        conditionRoot: parsed.data.conditionRoot as Record<string, unknown>,
        actions: parsed.data.actions as Record<string, unknown>[],
        stopProcessingAfterMatch: parsed.data.stopProcessingAfterMatch,
        combinableWithOtherRules: parsed.data.combinableWithOtherRules,
      })
      .returning();

    return NextResponse.json({ rule: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
