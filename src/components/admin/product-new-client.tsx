"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/lib/product-actions";
import { T } from "@/components/admin/admin-ui";

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

const FAMILY_OPTIONS = [
  { value: "sticker", label: "Sticker personnalisé" },
  { value: "label", label: "Étiquette" },
  { value: "pack", label: "Pack de stickers" },
  { value: "accessory", label: "Accessoire" },
  { value: "other", label: "Autre" },
] as const;

export function ProductNewClient({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("");
  const [productFamily, setProductFamily] = useState<"sticker" | "label" | "pack" | "accessory" | "other">("sticker");
  const [status, setStatus] = useState<"draft" | "active">("active");
  const [categoryId, setCategoryId] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      try {
        const product = await createProduct({
          name: name.trim(),
          description: description || null,
          tagline: tagline || null,
          productFamily,
          status,
          reviewsEnabled: true,
          sortOrder: 0,
          ...(categoryId ? { categoryId } : {}),
        });
        if (product) {
          router.push(`/admin/products/${product.id}?tab=configurateur`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.textPrimary, margin: "0 0 8px" }}>Nouveau produit</h1>
        <p style={{ fontSize: 14, color: T.textSecondary, margin: "0 0 32px" }}>
          Créez d'abord le produit, puis configurez ses options sticker dans l'onglet Configurateur.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Nom */}
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Informations générales</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nom du produit *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Stickers personnalisés vinyle"
                  required
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Accroche (tagline)</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ex : Vos stickers imprimés en 48h"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Description (Markdown)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description détaillée du produit…"
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          {/* Famille & statut */}
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Type et statut</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Famille de produit</label>
                <select
                  value={productFamily}
                  onChange={(e) => setProductFamily(e.target.value as typeof productFamily)}
                  style={inputStyle}
                >
                  {FAMILY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  style={inputStyle}
                >
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                </select>
              </div>
              {categories.length > 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Catégorie</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— Aucune catégorie —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, color: T.danger, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              style={{
                padding: "11px 24px",
                borderRadius: T.radiusSm,
                border: "none",
                background: T.brand,
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: pending || !name.trim() ? "not-allowed" : "pointer",
                opacity: pending || !name.trim() ? 0.6 : 1,
              }}
            >
              {pending ? "Création…" : "Créer et configurer →"}
            </button>
            <a
              href="/admin/products"
              style={{ padding: "11px 20px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textSecondary, fontWeight: 600, fontSize: 14, textDecoration: "none" }}
            >
              Annuler
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
