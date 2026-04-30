import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingMethods } from "@/db/schema";
import { asc } from "drizzle-orm";
import { shippingMethodSchema } from "@/lib/shipping/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.displayOrder));
  return NextResponse.json({ methods: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = shippingMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const [created] = await db.insert(shippingMethods).values(parsed.data).returning();
    return NextResponse.json({ method: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
