import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";

// SendCloud parcel status codes → order status mapping
// https://sendcloud.dev/docs/shipping/parcel-statuses
const STATUS_MAP: Record<number, { orderStatus: string | null; eventType: string; label: string }> = {
  1:   { orderStatus: null,       eventType: "sendcloud.status_update", label: "En attente de collecte" },
  3:   { orderStatus: "shipped",  eventType: "order.shipped",           label: "Colis remis au transporteur" },
  11:  { orderStatus: "shipped",  eventType: "sendcloud.status_update", label: "En transit" },
  12:  { orderStatus: "shipped",  eventType: "sendcloud.status_update", label: "En livraison" },
  80:  { orderStatus: "shipped",  eventType: "sendcloud.status_update", label: "Tentative de livraison" },
  91:  { orderStatus: "delivered",eventType: "order.delivered",         label: "Livré" },
  93:  { orderStatus: null,       eventType: "sendcloud.status_update", label: "Retourné à l'expéditeur" },
  1000:{ orderStatus: null,       eventType: "sendcloud.status_update", label: "Annulé" },
};

/**
 * Verify the SendCloud webhook HMAC-SHA256 signature.
 * SendCloud signs the raw body with the integration's secret key.
 * Header: X-Sendcloud-Signature (hex-encoded HMAC-SHA256)
 */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── Signature verification ─────────────────────────────────────────────────
  const webhookSecret = process.env.SENDCLOUD_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get("x-sendcloud-signature");
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      console.warn("[sendcloud-webhook] Invalid signature — request rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.APP_ENV === "production") {
    console.error("[sendcloud-webhook] SENDCLOUD_WEBHOOK_SECRET is not set in production");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // SendCloud sends an array of parcel updates
  const parcels = Array.isArray(body) ? body : [(body as Record<string, unknown>)?.parcel ?? body];

  for (const item of parcels) {
    const parcel = (item as Record<string, unknown>)?.parcel ?? item as Record<string, unknown>;
    const parcelTyped = parcel as {
      id?: unknown;
      status?: { id?: unknown } | unknown;
      status_id?: unknown;
      tracking_number?: unknown;
    };
    const parcelId = String(parcelTyped?.id ?? "");
    const statusId = typeof parcelTyped?.status === "object" && parcelTyped.status !== null
      ? Number((parcelTyped.status as Record<string, unknown>)?.id ?? 0)
      : Number(parcelTyped?.status_id ?? 0);
    const trackingNumber = typeof parcelTyped?.tracking_number === "string" ? parcelTyped.tracking_number : null;

    if (!parcelId) continue;

    // Find the order by sendcloud_parcel_id
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.sendcloudParcelId, parcelId))
      .limit(1);

    if (!order) continue;

    const mapped = STATUS_MAP[statusId];
    const eventLabel = mapped?.label ?? `Statut ${statusId}`;
    const eventType = mapped?.eventType ?? "sendcloud.status_update";

    // Update tracking + optionally status
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (trackingNumber) updates.trackingNumber = trackingNumber;

    if (mapped?.orderStatus && mapped.orderStatus !== order.status) {
      updates.status = mapped.orderStatus;
    }

    await db.update(orders).set(updates).where(eq(orders.id, order.id));

    await db.insert(orderEvents).values({
      orderId: order.id,
      type: eventType,
      payload: {
        sendcloudParcelId: parcelId,
        statusId,
        label: eventLabel,
        trackingNumber,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({ received: true });
}
