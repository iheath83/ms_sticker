"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { softDeleteProduct, duplicateProduct } from "@/lib/product-actions";
import { T } from "@/components/admin/admin-ui";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null | undefined;
  imageUrl: string | null | undefined;
  status: string;
  sortOrder: number;
  sku: string | null | undefined;
  createdAt: Date;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Actif", bg: T.successBg, color: T.success },
  draft: { label: "Brouillon", bg: T.warningBg, color: T.warning },
  archived: { label: "Archivé", bg: T.dangerBg, color: T.danger },
};


export function ProductsListClient({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    startTransition(async () => {
      await softDeleteProduct(id);
      router.refresh();
    });
  }

  async function handleDuplicate(id: string) {
    startTransition(async () => {
      const copy = await duplicateProduct(id);
      if (copy) router.push(`/admin/products/${copy.id}`);
    });
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.textPrimary }}>Produits</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textSecondary }}>{products.length} produit{products.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/admin/products/new"
          style={{
            padding: "10px 20px",
            borderRadius: T.radiusSm,
            background: T.brand,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          + Nouveau produit
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "9px 14px",
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radiusSm,
            fontSize: 14,
            background: "#fff",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: T.textSecondary }}>
            {search ? "Aucun produit trouvé." : "Aucun produit. Créez votre premier produit."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${T.border}` }}>
                {["Produit", "Statut", "SKU", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product, i) => {
                const status = STATUS_LABELS[product.status] ?? STATUS_LABELS.active!;
                return (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? `1px solid ${T.borderSubtle}` : "none",
                      background: i % 2 === 0 ? T.surface : "#FAFBFC",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt=""
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: `1px solid ${T.border}` }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                            🏷️
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/admin/products/${product.id}`}
                            style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, textDecoration: "none" }}
                          >
                            {product.name}
                          </Link>
                          {product.tagline && (
                            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 1 }}>{product.tagline}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: "monospace" }}>{product.sku ?? "—"}</span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          style={{ padding: "5px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textSecondary, fontSize: 12, textDecoration: "none" }}
                        >
                          ↗
                        </Link>
                        <Link
                          href={`/admin/products/${product.id}`}
                          style={{ padding: "5px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textPrimary, fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                        >
                          Modifier
                        </Link>
                        <button
                          onClick={() => handleDuplicate(product.id)}
                          disabled={pending}
                          style={{ padding: "5px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textSecondary, fontSize: 12, cursor: "pointer" }}
                        >
                          Dupliquer
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          disabled={pending}
                          style={{ padding: "5px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger}`, background: T.dangerBg, color: T.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
