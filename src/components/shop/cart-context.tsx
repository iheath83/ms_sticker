"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useTransition,
  type ReactNode,
} from "react";
import {
  getCart,
  addToCart as addToCartAction,
  updateCartItemQty,
  removeCartItem,
  type Cart,
  type AddToCartInput,
} from "@/lib/cart-actions";

interface CartContextValue {
  cart: Cart;
  cartOpen: boolean;
  isPending: boolean;
  addToCart: (input: AddToCartInput) => Promise<void>;
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
  totalCents: 0,
  itemCount: 0,
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load cart from DB on mount
  useEffect(() => {
    getCart().then(setCart).catch(console.error);
  }, []);

  async function refreshCart() {
    const updated = await getCart();
    setCart(updated);
  }

  async function addToCart(input: AddToCartInput) {
    startTransition(async () => {
      const result = await addToCartAction(input);
      if (result.ok) {
        setCart(result.data.cart);
        setCartOpen(true);
      }
    });
  }

  async function updateQty(itemId: string, qty: number) {
    startTransition(async () => {
      const result = await updateCartItemQty(itemId, qty);
      if (result.ok) setCart(result.data);
    });
  }

  async function removeItem(itemId: string) {
    startTransition(async () => {
      const result = await removeCartItem(itemId);
      if (result.ok) setCart(result.data);
    });
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        cartOpen,
        isPending,
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
