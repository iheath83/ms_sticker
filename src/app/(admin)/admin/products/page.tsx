import Link from "next/link";
import { getAdminProducts, getCategories } from "@/lib/product-catalog-actions";
import { ProductsListClient } from "@/components/admin/products-list-client";

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function AdminProductsPage() {
  const [prods, cats] = await Promise.all([getAdminProducts(), getCategories()]);

  const serialized = prods.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    active: p.active,
    sortOrder: p.sortOrder,
    requiresCustomization: p.requiresCustomization,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    variantCount: p.variants.length,
    priceMin: p.variants.length
      ? Math.min(...p.variants.map((v) => v.basePriceCents))
      : p.basePriceCents,
    priceMax: p.variants.length
      ? Math.max(...p.variants.map((v) => v.basePriceCents))
      : p.basePriceCents,
    priceMinFormatted: euros(
      p.variants.length ? Math.min(...p.variants.map((v) => v.basePriceCents)) : p.basePriceCents,
    ),
    priceMaxFormatted: euros(
      p.variants.length ? Math.max(...p.variants.map((v) => v.basePriceCents)) : p.basePriceCents,
    ),
  }));

  return (
    <main style={{ padding: "32px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em", margin: 0 }}>
            Produits
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>{prods.length} produit{prods.length > 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/admin/products/migrate"
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
          >
            Migrer vers variantes
          </Link>
          <Link
            href="/admin/products/new"
            style={{ padding: "10px 20px", borderRadius: 8, background: "#0A0E27", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            + Nouveau produit
          </Link>
        </div>
      </div>

      <ProductsListClient
        products={serialized}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
