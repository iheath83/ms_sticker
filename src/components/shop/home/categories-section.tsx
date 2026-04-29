"use client";

import Link from "next/link";
import { ArrowIcon } from "../icons";
import type { Category } from "@/db/schema";

const ACCENT_BG = ["var(--red)", "var(--blue)"];
const ACCENT_COLOR = "var(--white)";

export function CategoriesSection({ categories }: { categories?: Category[] }) {
  if (!categories || categories.length === 0) return null;

  return (
    <section style={{ padding: "80px 0 40px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "var(--red)",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              ◆ 01 / CATALOGUE
            </div>
            <h2
              style={{
                fontSize: 48,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                fontWeight: 800,
              }}
            >
              Parcourez par catégorie
            </h2>
          </div>
          <Link
            href="/products"
            style={{
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--blue)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Tout voir <ArrowIcon size={14} />
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {categories.map((cat, i) => {
            const isAccent = i === 0 || i === 3;
            const bg = isAccent ? ACCENT_BG[i === 0 ? 0 : 1] : "var(--white)";
            const fg = isAccent ? ACCENT_COLOR : "var(--ink)";
            return (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                style={{
                  display: "block",
                  background: bg,
                  color: fg,
                  border: "2px solid var(--ink)",
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  padding: 24,
                  textAlign: "center",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translate(-3px, -3px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 0 var(--ink)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                <div
                  style={{
                    height: 140,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 12,
                  }}
                >
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      style={{ width: 110, height: 110, objectFit: "contain", borderRadius: "var(--r)" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: "var(--r)",
                        background: isAccent ? "rgba(255,255,255,0.15)" : "var(--grey-100)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 36,
                      }}
                    >
                      🏷️
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {cat.name}
                </div>
                {cat.description && (
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, letterSpacing: "0.05em" }}>
                    {cat.description}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
