import { NextResponse, type NextRequest } from "next/server";
import { getAdminDiscounts, createDiscount } from "@/lib/discount-actions";

export async function GET() {
  try {
    const rows = await getAdminDiscounts();
    return NextResponse.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Parameters<typeof createDiscount>[0];
    const result = await createDiscount(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
