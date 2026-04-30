import { getAdminProducts, getCategories } from "@/lib/product-catalog-actions";
import { ProductsListClient } from "@/components/admin/products-list-client";
import { AdminTopbar, AdminPage, PrimaryBtn, SecondaryBtn } from "@/components/admin/admin-ui";

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
    <>
      <AdminTopbar title="Produits" subtitle={`${prods.length} produit${prods.length > 1 ? "s" : ""}`}>
        <SecondaryBtn href="/admin/products/migrate" style={{ fontSize: 12 }}>
          Migrer variantes
        </SecondaryBtn>
        <PrimaryBtn href="/admin/products/new">
          + Nouveau produit
        </PrimaryBtn>
      </AdminTopbar>

      <AdminPage>
        <ProductsListClient
          products={serialized}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        />
      </AdminPage>
    </>
  );
}
