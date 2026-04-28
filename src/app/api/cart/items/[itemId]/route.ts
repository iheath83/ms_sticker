import { updateCartItemQty, removeCartItem } from "@/lib/cart-actions";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ itemId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { itemId } = await params;
  const { quantity } = await req.json() as { quantity: number };
  const result = await updateCartItemQty(itemId, quantity);
  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { itemId } = await params;
  const result = await removeCartItem(itemId);
  return NextResponse.json(result);
}
