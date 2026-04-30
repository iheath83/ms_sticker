import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingTimeSlots } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(shippingTimeSlots).where(eq(shippingTimeSlots.id, id));
  return NextResponse.json({ success: true });
}
