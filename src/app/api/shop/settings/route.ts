import { NextResponse } from "next/server";
import { getSiteSettingsQuery } from "@/lib/settings-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSiteSettingsQuery();
  return NextResponse.json({
    standardShippingCents:      s.standardShippingCents,
    expressShippingCents:       s.expressShippingCents,
    freeShippingThresholdCents: s.freeShippingThresholdCents,
    quantityStep:               s.quantityStep,
  });
}
