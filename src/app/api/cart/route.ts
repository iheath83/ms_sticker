import { getCart } from "@/lib/cart-actions";
import { NextResponse } from "next/server";

export async function GET() {
  const cart = await getCart();
  return NextResponse.json(cart);
}
