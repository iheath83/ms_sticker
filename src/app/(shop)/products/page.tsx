export const dynamic = "force-dynamic";

import { getActiveProductsWithVariants, getActiveCategories } from "@/lib/products";
import { ProductCard } from "@/components/shop/product-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nos produits — MS Adhésif",
  description:
    "Stickers vinyle, holographiques, pailletés, transparents et kraft. Impression haute qualité, livraison rapide.",
};

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const [allProducts, allCategories] = await Promise.all([
    getActiveProductsWithVariants(),
    getActiveCategories(),
  ]);

  const filtered = category
    ? allProducts.filter((p) => p.category?.slug === category)
    : allProducts;

  return (
    <main style={{ background: "var(--cream)", minHeight: "100vh" }}>
      {/* Page header */}
      <section
        style={{
          background: "var(--white)",
          borderBottom: "2px solid var(--ink)",
          padding: "48px 0 40px",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--red)", fontWeight: 700, marginBottom: 12 }}>
            ◆ CATALOGUE
          </div>
          <h1
            style={{
              fontSize: 56,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            Nos produits
          </h1>
          <p style={{ fontSize: 16, color: "var(--grey-600)", maxWidth: 540, marginBottom: allCategories.length > 0 ? 24 : 0 }}>
            Stickers découpés sur mesure, impression numérique HD. Choisissez votre matière,
            configurez en ligne, recevez en 5 jours.
          </p>

          {/* Category pills */}
          {allCategories.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="/products"
                style={{
                  padding: "8px 18px",
                  borderRadius: 24,
                  border: `1.5px solid ${!category ? "var(--ink)" : "var(--grey-200)"}`,
                  background: !category ? "var(--ink)" : "transparent",
                  color: !category ? "#fff" : "var(--grey-600)",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Tous
              </a>
              {allCategories.map((cat) => (
                <a
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 24,
                    border: `1.5px solid ${category === cat.slug ? "var(--red)" : "var(--grey-200)"}`,
                    background: category === cat.slug ? "var(--red)" : "transparent",
                    color: category === cat.slug ? "#fff" : "var(--grey-600)",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {cat.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Product grid */}
      <section style={{ padding: "60px 0" }}>
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {filtered.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "80px 32px", color: "var(--grey-400)" }}>
              Aucun produit dans cette catégorie.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
