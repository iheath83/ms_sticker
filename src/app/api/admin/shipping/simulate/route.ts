import { NextRequest, NextResponse } from "next/server";
import { computeShippingQuote } from "@/lib/shipping/engine";
import { shippingQuoteContextSchema } from "@/lib/shipping/validators";
import type { ShippingQuoteContext } from "@/lib/shipping/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = shippingQuoteContextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = data as any as ShippingQuoteContext;
    ctx.now = data.now ? new Date(data.now) : new Date();

    // Admin simulator always receives debug logs
    const result = await computeShippingQuote(ctx, { debug: true });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[shipping/simulate]", err);
    return NextResponse.json({ error: "Erreur interne du simulateur." }, { status: 500 });
  }
}
