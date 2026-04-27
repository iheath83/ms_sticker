"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProduct, duplicateProduct } from "@/lib/product-catalog-actions";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
  requiresCustomization: boolean;
  categoryId: string | null;
  categoryName: string | null;
  variantCount: number;
  priceMinFormatted: string;
  priceMaxFormatted: string;
};

type Category = { id: string; name: string };

export function ProductsListClient({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && p.categoryId !== filterCat) return false;
    if (filterType === "custom" && !p.requiresCustomization) return false;
    if (filterType === "direct" && p.requiresCustomization) return false;
    return true;
  });

  function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer le produit "${name}" ?`)) return;
    startTransition(async () => {
      await deleteProduct(id);
      router.refresh();
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const res = await duplicateProduct(id);
      if (res.ok) router.push(`/admin/products/${res.data.id}`);
      else alert(res.error);
    });
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, flex: "1 1 200px", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "all", label: "Toutes catégories" }, ...categories.map((c) => ({ id: c.id, label: c.name }))].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCat(c.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: `1px solid ${filterCat === c.id ? "#0A0E27" : "#E5E7EB"}`,
                background: filterCat === c.id ? "#0A0E27" : "#fff",
                color: filterCat === c.id ? "#fff" : "#374151",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "all", label: "Tous" },
            { id: "custom", label: "Personnalisés" },
            { id: "direct", label: "Impression directe" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterType(t.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: `1px solid ${filterType === t.id ? "#DC2626" : "#E5E7EB"}`,
                background: filterType === t.id ? "#DC2626" : "#fff",
                color: filterType === t.id ? "#fff" : "#374151",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 32px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>
            Aucun produit trouvé.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["", "Nom", "Catégorie", "Type", "Déclinaisons", "Prix", "Statut", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", opacity: p.active ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 16px" }}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #E5E7EB" }} />
                    ) : (
                      <div style={{ width: 44, height: 44, background: "#F3F4F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏷️</div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0A0E27" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace", marginTop: 2 }}>{p.slug}</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                    {p.categoryName ?? <span style={{ color: "#D1D5DB" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: p.requiresCustomization ? "#FEE2E2" : "#EFF6FF",
                      color: p.requiresCustomization ? "#991B1B" : "#1D4ED8",
                    }}>
                      {p.requiresCustomization ? "Personnalisé" : "Impression directe"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151", textAlign: "center" }}>
                    <span style={{ fontWeight: 700 }}>{p.variantCount}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 4 }}>variant{p.variantCount > 1 ? "s" : ""}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#0A0E27", fontFamily: "monospace", fontWeight: 700 }}>
                    {p.priceMinFormatted}
                    {p.priceMinFormatted !== p.priceMaxFormatted && ` – ${p.priceMaxFormatted}`}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: p.active ? "#D1FAE5" : "#F3F4F6",
                      color: p.active ? "#065F46" : "#6B7280",
                    }}>
                      {p.active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link
                        href={`/admin/products/${p.id}`}
                        style={{ padding: "6px 12px", borderRadius: 6, background: "#0A0E27", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
                      >
                        Éditer
                      </Link>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDuplicate(p.id)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        title="Dupliquer"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(p.id, p.name)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
