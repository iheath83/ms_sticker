"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./logo";
import { Ticker } from "./ticker";
import { CartIcon, SearchIcon, ChevronDownIcon } from "./icons";
import { useCart } from "./cart-context";
import { useSession } from "@/lib/auth-client";
import type { NavItemWithChildren } from "@/lib/nav-actions";

interface HeaderProps {
  products?: import("@/db/schema").Product[];
  logoUrl?: string | null;
  navTree?: NavItemWithChildren[];
}

// ── Megamenu dropdown ─────────────────────────────────────────────────────────

function MegaDropdown({ node }: { node: NavItemWithChildren }) {
  const children = node.children.filter((c) => c.active);
  if (children.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--white)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--r)",
        padding: 8,
        minWidth: 280,
        zIndex: 50,
        boxShadow: "6px 6px 0 0 var(--ink)",
      }}
    >
      {children.map((child) => (
        <Link
          key={child.id}
          href={child.href}
          target={child.openInNewTab ? "_blank" : undefined}
          rel={child.openInNewTab ? "noopener noreferrer" : undefined}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 6,
            textDecoration: "none",
            color: "var(--ink)",
            transition: "background .12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--grey-50)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {child.icon && (
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{child.icon}</span>
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {child.label}
              {child.badge && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    background: "var(--red)",
                    color: "var(--white)",
                    padding: "2px 5px",
                    borderRadius: 4,
                  }}
                >
                  {child.badge}
                </span>
              )}
            </div>
            {child.description && (
              <div style={{ fontSize: 11, color: "var(--grey-600)", marginTop: 2 }}>
                {child.description}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Dynamic nav item ──────────────────────────────────────────────────────────

function NavNode({ node }: { node: NavItemWithChildren }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.filter((c) => c.active).length > 0;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={node.href}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noopener noreferrer" : undefined}
        style={{
          padding: "6px 2px",
          borderBottom: "2px solid transparent",
          display: "flex",
          alignItems: "center",
          gap: 4,
          transition: "border-color .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
      >
        {node.icon && <span style={{ fontSize: 15 }}>{node.icon}</span>}
        {node.label}
        {hasChildren && <ChevronDownIcon size={12} />}
      </Link>

      {open && hasChildren && <MegaDropdown node={node} />}
    </div>
  );
}

// ── Fallback static nav (used when DB nav is empty) ───────────────────────────

const STATIC_NAV = [
  { label: "Accueil",   href: "/" },
  { label: "Produits",  href: "/products" },
  { label: "Devis pro", href: "#" },
  { label: "Nuancier",  href: "#" },
  { label: "FAQ",       href: "#" },
];

// ── Header ────────────────────────────────────────────────────────────────────

export function Header({ products = [], logoUrl, navTree }: HeaderProps) {
  const { cart, setCartOpen } = useCart();
  const { data: session } = useSession();
  const cartCount = cart.itemCount;

  // If nav is configured in DB, use it; otherwise render static fallback
  const hasDynamicNav = navTree && navTree.length > 0;

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
            <Logo imageUrl={logoUrl} />
          </Link>

          <nav
            style={{
              display: "flex",
              gap: 28,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            {hasDynamicNav
              ? navTree!.filter((n) => n.active).map((node) => (
                  <NavNode key={node.id} node={node} />
                ))
              : STATIC_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{ padding: "6px 2px", borderBottom: "2px solid transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
                  >
                    {item.label}
                  </Link>
                ))}
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
                  fontFamily: "var(--font-archivo), monospace",
                }}
              >
                ⌘K
              </kbd>
            </div>

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
                  fontFamily: "var(--font-archivo), monospace",
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
                  fontFamily: "var(--font-archivo), monospace",
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
                fontFamily: "var(--font-archivo), monospace",
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
