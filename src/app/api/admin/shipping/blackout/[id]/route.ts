import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shippingBlackoutDates } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(shippingBlackoutDates).where(eq(shippingBlackoutDates.id, id));
  return NextResponse.json({ success: true });
}
