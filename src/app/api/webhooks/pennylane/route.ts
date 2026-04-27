import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Pennylane webhook — notifications de statut des factures.
 *
 * Événements traités :
 *  - invoice.finalized  → mise à jour de pennylaneInvoiceUrl si absent
 *  - invoice.cancelled  → log pour audit
 *  - credit_note.created → log pour audit
 *
 * La signature Pennylane n'est pas encore standardisée en v2 ;
 * on vérifie simplement le Bearer token secret partagé.
 */
export async function POST(req: NextRequest) {
  // ── Auth: shared secret header (mandatory in production) ──────────────────
  const secret = process.env.PENNYLANE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.APP_ENV === "production") {
      console.error("[pennylane-webhook] PENNYLANE_WEBHOOK_SECRET is not set in production");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    console.warn("[pennylane-webhook] PENNYLANE_WEBHOOK_SECRET not set — skipping auth (dev only)");
  } else {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${secret}`) {
      console.warn("[pennylane-webhook] Invalid authorization header — request rejected");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("event" in payload) ||
    !("data" in payload)
  ) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const { event, data } = payload as { event: string; data: Record<string, unknown> };

  console.info("[pennylane-webhook] Received event:", event, JSON.stringify(data));

  try {
    switch (event) {
      case "invoice.finalized": {
        const invoiceId = String(data["id"] ?? "");
        const pdfUrl = String(data["file_url"] ?? data["pdf_url"] ?? "");

        if (invoiceId && pdfUrl) {
          // Back-fill the PDF URL if it wasn't captured at creation time
          await db
            .update(orders)
            .set({ pennylaneInvoiceUrl: pdfUrl, updatedAt: new Date() })
            .where(eq(orders.pennylaneInvoiceId, invoiceId));

          console.info("[pennylane-webhook] Updated invoice PDF URL:", invoiceId, pdfUrl);
        }
        break;
      }

      case "invoice.cancelled": {
        const invoiceId = String(data["id"] ?? "");
        console.warn("[pennylane-webhook] Invoice cancelled:", invoiceId);

        if (invoiceId) {
          const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.pennylaneInvoiceId, invoiceId))
            .limit(1);

          if (order) {
            await db.insert(orderEvents).values({
              orderId: order.id,
              type: "invoice.cancelled",
              actorId: null,
              payload: { invoiceId },
            });
          }
        }
        break;
      }

      case "credit_note.created": {
        const creditNoteId = String(data["id"] ?? "");
        const originalInvoiceId = String(data["invoice_id"] ?? "");
        console.info("[pennylane-webhook] Credit note created:", creditNoteId, "for invoice:", originalInvoiceId);
        break;
      }

      default:
        console.info("[pennylane-webhook] Unhandled event — ignoring:", event);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[pennylane-webhook] Error processing event:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
