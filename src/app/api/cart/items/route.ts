import { addToCart } from "@/lib/cart-actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await addToCart(body);
  return NextResponse.json(result);
}
