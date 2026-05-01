"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateProduct, softDeleteProduct } from "@/lib/product-actions";
import { T } from "@/components/admin/admin-ui";
import type { Product } from "@/db/schema";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm,
  fontSize: 14,
  color: T.textPrimary,
  background: "#fff",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 5,
};

const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivé" },
];

type Tab = "general" | "configurateur" | "seo";

interface ProductEditClientProps {
  product: Product;
  categories: { id: string; name: string }[];
  families?: { slug: string; label: string }[];
  stickerConfigTab?: React.ReactNode;
}

export function ProductEditClient({ product, categories, families = [], stickerConfigTab }: ProductEditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "general";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General fields
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [tagline, setTagline] = useState(product.tagline ?? "");
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [productFamily, setProductFamily] = useState(product.productFamily);
  const [status, setStatus] = useState(product.status);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [sku, setSku] = useState(product.sku ?? "");
  const [brand, setBrand] = useState(product.brand);
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [reviewsEnabled, setReviewsEnabled] = useState(product.reviewsEnabled);
  // SEO fields
  const [seoTitle, setSeoTitle] = useState(product.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product.seoDescription ?? "");

  async function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateProduct(product.id, {
          name: name.trim(),
          description: description || null,
          tagline: tagline || null,
          imageUrl: imageUrl || null,
          productFamily: productFamily as "sticker" | "label" | "pack" | "accessory" | "other",
          status: status as "draft" | "active" | "archived",
          ...(categoryId ? { categoryId } : { categoryId: null }),
          sku: sku || null,
          brand: brand || "MS Adhésif",
          sortOrder: parseInt(sortOrder) || 0,
          reviewsEnabled,
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
      }
    });
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${product.name}" ? Cette action peut être annulée depuis la base de données.`)) return;
    startTransition(async () => {
      await softDeleteProduct(product.id);
      router.push("/admin/products");
    });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "general", label: "Général" },
    { id: "configurateur", label: "Configurateur sticker" },
    { id: "seo", label: "SEO & identifiants" },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>
            <a href="/admin/products" style={{ color: T.textSecondary, textDecoration: "none" }}>Produits</a>
            {" / "}
            <span style={{ color: T.textPrimary, fontWeight: 600 }}>{product.name}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.textPrimary }}>{product.name}</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: T.textSecondary }}>
            <code style={{ background: T.bg, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>/products/{product.slug}</code>
            {" "}
            <a href={`/products/${product.slug}`} target="_blank" style={{ color: T.brand, textDecoration: "none", fontSize: 12 }}>↗ Voir en boutique</a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {saved && (
            <span style={{ padding: "10px 16px", background: T.successBg, color: T.success, borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700 }}>
              ✓ Sauvegardé
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={pending}
            style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {pending ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger}`, background: T.dangerBg, color: T.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Supprimer
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, color: T.danger, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `1.5px solid ${T.border}` }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: activeTab === tab.id ? `2.5px solid ${T.brand}` : "2.5px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? T.brand : T.textSecondary,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -1.5,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Général */}
      {activeTab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Informations</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Accroche</label>
                <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description (Markdown)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>URL image principale</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
                {imageUrl && <img src={imageUrl} alt="" style={{ marginTop: 8, maxWidth: 200, borderRadius: 8, border: `1px solid ${T.border}` }} />}
              </div>
            </div>
          </div>

          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Organisation</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Famille</label>
                <select value={productFamily} onChange={(e) => setProductFamily(e.target.value)} style={inputStyle}>
                  {families.length > 0
                    ? families.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)
                    : <option value={product.productFamily}>{product.productFamily}</option>
                  }
                </select>
              </div>
              <div>
                <label style={labelStyle}>Statut</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {categories.length > 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Catégorie</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
                    <option value="">— Aucune —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Ordre d'affichage</label>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={0} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Marque</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={reviewsEnabled} onChange={(e) => setReviewsEnabled(e.target.checked)} />
                Activer les avis clients
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Configurateur sticker */}
      {activeTab === "configurateur" && (
        <div>
          {stickerConfigTab ?? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: T.textSecondary, fontSize: 14 }}>
              Pas de configuration sticker pour ce produit.
            </div>
          )}
        </div>
      )}

      {/* Tab: SEO */}
      {activeTab === "seo" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>SEO</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Titre SEO</label>
                <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Titre pour les moteurs de recherche" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Meta description</label>
                <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} placeholder="Description pour les moteurs de recherche (150-160 caractères)" style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
          </div>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px", marginTop: 16 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Identifiants produit</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>SKU</label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: T.textSecondary }}>
              Slug URL : <code style={{ background: T.bg, padding: "2px 6px", borderRadius: 4 }}>{product.slug}</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
