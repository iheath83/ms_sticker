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
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const data = parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = data as any as ShippingQuoteContext;
    ctx.now = data.now ? new Date(data.now) : new Date();

    const isAdmin = req.headers.get("x-shipping-debug") === "true";
    const result = await computeShippingQuote(ctx, { debug: isAdmin });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[shipping/quote]", err);
    return NextResponse.json(
      { success: false, errors: ["Erreur interne du moteur d'expédition."] },
      { status: 500 },
    );
  }
}
