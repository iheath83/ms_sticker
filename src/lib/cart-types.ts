// Cart domain types — no "use server", safe to import in both client and server modules

export interface CartItemFile {
  id: string;
  key: string;
  filename: string | null;
  mimeType: string | null;
}

export interface CartItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  shape: string;
  finish: string;
  material: string;
  options: Record<string, boolean>;
  unitPriceCents: number;
  lineTotalCents: number;
  customizationNote?: string | undefined;
  file: CartItemFile | null;
}

export interface Cart {
  orderId: string;
  items: CartItem[];
  subtotalCents: number;
  taxAmountCents: number;
  shippingCents: number;
  discountCents: number;
  discountCode: string | null;
  totalCents: number;
  itemCount: number;
}

export interface AddToCartResult {
  cart: Cart;
  itemId: string;
  orderId: string;
}

export interface AddToCartInput {
  productId?: string | undefined;
  productName: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  shape: string;
  finish: string;
  material: string;
  basePriceCents: number;
  options: Record<string, boolean>;
  customizationNote?: string | undefined;
  /** For non-customizable products: bypass shape/area/material multipliers from computePrice */
  directUnitPriceCents?: number | undefined;
}
