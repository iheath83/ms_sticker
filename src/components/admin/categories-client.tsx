"use client";

import Link from "next/link";
import { deleteCategory } from "@/lib/product-catalog-actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  parentId: string | null;
};

export function CategoriesClient({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
    startTransition(async () => {
      await deleteCategory(id);
      router.refresh();
    });
  }

  if (!categories.length) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🏷️</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>Aucune catégorie pour l&apos;instant.</div>
        <Link href="/admin/categories/new" style={{ padding: "10px 20px", borderRadius: 8, background: "#0A0E27", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          + Créer la première catégorie
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            {["Image", "Nom", "Slug", "Statut", "Ordre", ""].map((h) => (
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, i) => (
            <tr key={cat.id} style={{ borderBottom: i < categories.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <td style={{ padding: "12px 16px" }}>
                {cat.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.imageUrl} alt={cat.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid #E5E7EB" }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: "#F3F4F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏷️</div>
                )}
              </td>
              <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "#0A0E27" }}>{cat.name}</td>
              <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#6B7280" }}>{cat.slug}</td>
              <td style={{ padding: "12px 16px" }}>
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: cat.active ? "#D1FAE5" : "#F3F4F6",
                  color: cat.active ? "#065F46" : "#6B7280",
                }}>
                  {cat.active ? "Actif" : "Inactif"}
                </span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7280" }}>{cat.sortOrder}</td>
              <td style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={`/admin/categories/${cat.id}`} style={{ padding: "6px 12px", borderRadius: 6, background: "#0A0E27", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    Éditer
                  </Link>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(cat.id, cat.name)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
