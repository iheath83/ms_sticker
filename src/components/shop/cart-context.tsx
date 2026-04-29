"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useTransition,
  type ReactNode,
} from "react";
import type { Cart, AddToCartInput, AddToCartResult } from "@/lib/cart-types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ShopSettings {
  standardShippingCents: number;
  expressShippingCents: number;
  freeShippingThresholdCents: number;
  quantityStep: number;
}

const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  standardShippingCents: 490,
  expressShippingCents: 990,
  freeShippingThresholdCents: 5000,
  quantityStep: 25,
};

interface CartContextValue {
  cart: Cart;
  shopSettings: ShopSettings;
  cartOpen: boolean;
  isPending: boolean;
  addToCart: (input: AddToCartInput) => Promise<Result<AddToCartResult>>;
  updateQty: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  setCartOpen: (open: boolean) => void;
}

const EMPTY_CART: Cart = {
  orderId: "",
  items: [],
  subtotalCents: 0,
  taxAmountCents: 0,
  shippingCents: 0,
  discountCents: 0,
  discountCode: null,
  totalCents: 0,
  itemCount: 0,
};

const CartContext = createContext<CartContextValue | null>(null);

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Cart API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [cartOpen, setCartOpen] = useState(false);
  const [addPending, setAddPending] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    void apiFetch<Cart>("/api/cart").then(setCart).catch(console.error);
    void apiFetch<ShopSettings>("/api/shop/settings").then(setShopSettings).catch(console.error);
  }, []);

  async function refreshCart() {
    const updated = await apiFetch<Cart>("/api/cart");
    setCart(updated);
  }

  async function addToCart(input: AddToCartInput): Promise<Result<AddToCartResult>> {
    setAddPending(true);
    try {
      const result = await apiFetch<Result<AddToCartResult>>("/api/cart/items", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (result.ok) {
        setCart(result.data.cart);
        setCartOpen(true);
      }
      return result;
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      setAddPending(false);
    }
  }

  function updateQty(itemId: string, qty: number): Promise<void> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await apiFetch<Result<Cart>>(`/api/cart/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: qty }),
        });
        if (result.ok) setCart(result.data);
        resolve();
      });
    });
  }

  function removeItem(itemId: string): Promise<void> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await apiFetch<Result<Cart>>(`/api/cart/items/${itemId}`, {
          method: "DELETE",
        });
        if (result.ok) setCart(result.data);
        resolve();
      });
    });
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        shopSettings,
        cartOpen,
        isPending: addPending,
        addToCart,
        updateQty,
        removeItem,
        refreshCart,
        setCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
