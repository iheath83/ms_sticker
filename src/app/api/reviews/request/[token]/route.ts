import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, reviewRequestItems, products } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // The token in the URL IS the tokenHash (we store the hash, link uses the hash directly)
  const hash = token;

  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.tokenHash, hash));

  if (!request) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  if (request.status === "expired" || request.expiresAt < new Date()) {
    return NextResponse.json({ error: "Lien expiré" }, { status: 410 });
  }

  const items = await db
    .select()
    .from(reviewRequestItems)
    .where(eq(reviewRequestItems.reviewRequestId, request.id));

  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  const productRows =
    productIds.length > 0
      ? await db
          .select({ id: products.id, name: products.name, imageUrl: products.imageUrl, slug: products.slug })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  // For multiple products we'd need inArray — keep simple for now
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const itemsWithProduct = items.map((item) => ({
    ...item,
    product: item.productId ? (productMap.get(item.productId) ?? null) : null,
  }));

  // Mark as opened
  if (request.status === "sent") {
    await db
      .update(reviewRequests)
      .set({ status: "opened", firstOpenedAt: new Date(), updatedAt: new Date() })
      .where(eq(reviewRequests.tokenHash, hash));
  }

  return NextResponse.json({ request, items: itemsWithProduct });
}
