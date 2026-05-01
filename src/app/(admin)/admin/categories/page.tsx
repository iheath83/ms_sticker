import Link from "next/link";
import { getCategories } from "@/lib/category-actions";
import { CategoriesClient } from "@/components/admin/categories-client";

export default async function AdminCategoriesPage() {
  const cats = await getCategories();

  return (
    <main style={{ padding: "32px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em", margin: 0 }}>
            Catégories
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>{cats.length} catégorie{cats.length > 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/admin/categories/new"
          style={{ padding: "10px 20px", borderRadius: 8, background: "#0A0E27", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          + Nouvelle catégorie
        </Link>
      </div>

      <CategoriesClient categories={cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        active: c.active,
        sortOrder: c.sortOrder,
        parentId: c.parentId,
      }))} />
    </main>
  );
}
