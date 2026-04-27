"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./logo";
import { Ticker } from "./ticker";
import { CartIcon, SearchIcon, ChevronDownIcon } from "./icons";
import { useCart } from "./cart-context";
import { useSession } from "@/lib/auth-client";
import type { Product } from "@/db/schema";

interface HeaderProps {
  products?: Product[];
}

export function Header({ products = [] }: HeaderProps) {
  const [productsOpen, setProductsOpen] = useState(false);
  const { cart, setCartOpen } = useCart();
  const { data: session } = useSession();
  const cartCount = cart.itemCount;

  return (
    <>
      <Ticker />
      <header
        style={{
          background: "var(--white)",
          borderBottom: "2px solid var(--ink)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            gap: 48,
          }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <Logo />
          </Link>

          <nav style={{ display: "flex", gap: 28, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
            <Link
              href="/"
              style={{ padding: "6px 2px", borderBottom: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            >
              Accueil
            </Link>

            <div
              style={{ position: "relative" }}
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <Link
                href="/products"
                style={{
                  padding: "6px 2px",
                  borderBottom: "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
              >
                Produits <ChevronDownIcon size={12} />
              </Link>

              {productsOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: -16,
                    background: "var(--white)",
                    border: "2px solid var(--ink)",
                    borderRadius: "var(--r)",
                    padding: 8,
                    minWidth: 220,
                    zIndex: 50,
                    boxShadow: "6px 6px 0 0 var(--ink)",
                  }}
                >
                  <Link
                    href="/products"
                    style={{
                      display: "block",
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "var(--grey-400)",
                      textTransform: "uppercase",
                      borderBottom: "1px solid var(--grey-100)",
                      marginBottom: 4,
                    }}
                  >
                    Voir tous les produits →
                  </Link>
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        fontSize: 13,
                        borderRadius: 6,
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--grey-50)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span>{p.name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--grey-400)",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {Math.round(p.basePriceCents / 100)} €
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <a
              href="#"
              style={{ padding: "6px 2px", borderBottom: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            >
              Devis pro
            </a>
            <a
              href="#"
              style={{ padding: "6px 2px", borderBottom: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            >
              Nuancier
            </a>
            <a
              href="#"
              style={{ padding: "6px 2px", borderBottom: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            >
              FAQ
            </a>
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--grey-50)",
                border: "1px solid var(--grey-200)",
                borderRadius: "var(--r)",
                padding: "8px 12px",
                width: 200,
                fontSize: 12,
                color: "var(--grey-600)",
                cursor: "pointer",
              }}
            >
              <SearchIcon /> Chercher un produit
              <kbd
                style={{
                  marginLeft: "auto",
                  background: "var(--white)",
                  border: "1px solid var(--grey-200)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                ⌘K
              </kbd>
            </div>

            {/* Auth button */}
            {session ? (
              <Link
                href="/account"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 16px",
                  border: "1.5px solid var(--grey-200)",
                  borderRadius: "var(--r)",
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--blue)",
                    color: "var(--white)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {(session.user.name ?? session.user.email ?? "?")[0]?.toUpperCase()}
                </span>
                Mon compte
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: "9px 16px",
                  border: "1.5px solid var(--grey-200)",
                  borderRadius: "var(--r)",
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                Connexion
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--ink)",
                color: "var(--white)",
                border: "none",
                padding: "10px 16px",
                borderRadius: "var(--r)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--font-mono), monospace",
                cursor: "pointer",
              }}
            >
              <CartIcon /> Panier{" "}
              <span
                style={{
                  background: "var(--red)",
                  color: "var(--white)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
