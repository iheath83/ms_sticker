import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { orderFiles, orders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().uuid(),
  itemId: z.string().uuid().optional(), // link to a specific cart item
  key: z.string().min(1),
  filename: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  replace: z.boolean().optional(), // if true, delete old file for this item first
});

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const { orderId, itemId, key, filename, mimeType, replace } = parsed.data;

  // Verify order exists
  const [order] = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  // Access control: admin, or the order's owner, or guest orders (userId null)
  const role = session ? (session.user as { role?: string }).role : null;
  const isOwner = session && order.userId === session.user.id;
  const isGuestOrder = order.userId === null;

  if (role !== "admin" && !isOwner && !isGuestOrder) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // If replacing, delete old file record for this item
  if (replace && itemId) {
    await db
      .delete(orderFiles)
      .where(and(
        eq(orderFiles.orderId, orderId),
        eq(orderFiles.orderItemId, itemId),
        eq(orderFiles.type, "customer_upload"),
      ));
  }

  // Determine next version number
  const existing = await db
    .select({ version: orderFiles.version })
    .from(orderFiles)
    .where(eq(orderFiles.orderId, orderId));

  const nextVersion = existing.length > 0
    ? Math.max(...existing.map((f) => f.version)) + 1
    : 1;

  await db.insert(orderFiles).values({
    orderId,
    orderItemId: itemId ?? null,
    type: "customer_upload",
    version: nextVersion,
    storageKey: key,
    mimeType: mimeType ?? "application/octet-stream",
    originalFilename: filename ?? "fichier-client",
    uploadedById: session?.user.id ?? null,
  });

  return NextResponse.json({ ok: true });
}
