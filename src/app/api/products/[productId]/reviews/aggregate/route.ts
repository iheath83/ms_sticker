import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewAggregates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  const [aggregate] = await db
    .select()
    .from(reviewAggregates)
    .where(
      and(
        eq(reviewAggregates.targetType, "product"),
        eq(reviewAggregates.targetId, productId),
      ),
    );

  return NextResponse.json({ aggregate: aggregate ?? null });
}
