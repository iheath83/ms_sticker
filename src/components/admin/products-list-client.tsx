"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProduct, duplicateProduct } from "@/lib/product-catalog-actions";
import {
  AdminTableWrapper,
  AdminTableHead,
  AdminEmptyState,
  StatusBadge,
  SecondaryBtn,
  DangerBtn,
  T,
} from "@/components/admin/admin-ui";

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
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: T.textSecondary,
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px 8px 32px",
              borderRadius: T.radius,
              border: `1.5px solid ${T.border}`,
              fontSize: 13,
              width: "100%",
              background: T.surface,
              color: T.textPrimary,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[{ id: "all", label: "Toutes catégories" }, ...categories.map((c) => ({ id: c.id, label: c.name }))].map(
            (c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCat(c.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 99,
                  border: `1.5px solid ${filterCat === c.id ? T.brand : T.border}`,
                  background: filterCat === c.id ? T.brand : T.surface,
                  color: filterCat === c.id ? "#fff" : T.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            ),
          )}
        </div>

        {/* Type chips */}
        <div style={{ display: "flex", gap: 4 }}>
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
                padding: "6px 12px",
                borderRadius: 99,
                border: `1.5px solid ${filterType === t.id ? "#5B21B6" : T.border}`,
                background: filterType === t.id ? "#EDE9FE" : T.surface,
                color: filterType === t.id ? "#5B21B6" : T.textSecondary,
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
      <AdminTableWrapper>
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon="🏷️"
            title="Aucun produit trouvé"
            subtitle="Modifiez les filtres ou créez un nouveau produit."
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <AdminTableHead cols={["", "Produit", "Catégorie", "Type", "Déclinaisons", "Prix unitaire HT", "Statut", ""]} />
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? `1px solid ${T.borderSubtle}` : "none",
                    opacity: p.active ? 1 : 0.55,
                  }}
                  className="admin-table-row"
                >
                  {/* Image */}
                  <td style={{ padding: "12px 12px 12px 16px", width: 56 }}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          borderRadius: T.radiusSm,
                          border: `1.5px solid ${T.border}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          background: T.bg,
                          borderRadius: T.radiusSm,
                          border: `1.5px solid ${T.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                        }}
                      >
                        🏷️
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.textDisabled, fontFamily: "monospace", marginTop: 2 }}>
                      {p.slug}
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                    {p.categoryName ?? <span style={{ color: T.textDisabled }}>—</span>}
                  </td>

                  {/* Type */}
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge
                      label={p.requiresCustomization ? "Personnalisé" : "Impression directe"}
                      variant={p.requiresCustomization ? "danger" : "info"}
                      dot={false}
                    />
                  </td>

                  {/* Variants */}
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: T.brandLight,
                        color: T.brand,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {p.variantCount}
                    </span>
                  </td>

                  {/* Price */}
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
                    {(parseFloat(p.priceMinFormatted.replace(/[^\d,]/g, "").replace(",", ".")) / 50).toFixed(4)} €
                    {p.priceMinFormatted !== p.priceMaxFormatted && (
                      <span style={{ color: T.textSecondary }}>
                        {" – "}
                        {(parseFloat(p.priceMaxFormatted.replace(/[^\d,]/g, "").replace(",", ".")) / 50).toFixed(4)} €
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge
                      label={p.active ? "Actif" : "Inactif"}
                      variant={p.active ? "success" : "neutral"}
                      dot
                    />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Link
                        href={`/admin/products/${p.id}`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: T.radiusSm,
                          background: T.brand,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Éditer
                      </Link>
                      <SecondaryBtn
                        onClick={() => handleDuplicate(p.id)}
                        disabled={isPending}
                        style={{ padding: "6px 10px", fontSize: 13 }}
                      >
                        ⧉
                      </SecondaryBtn>
                      <DangerBtn
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={isPending}
                        style={{ padding: "6px 10px", fontSize: 13 }}
                      >
                        ✕
                      </DangerBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminTableWrapper>
    </div>
  );
}
