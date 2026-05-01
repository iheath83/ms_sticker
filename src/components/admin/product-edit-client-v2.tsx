"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProductInfo, createVariant, updateVariant, deleteVariant, reorderVariants } from "@/lib/product-catalog-actions";
import { QUANTITY_TIERS } from "@/lib/pricing";
import type { PricingTier, CustomPreset } from "@/lib/pricing";
import { AdminImageUpload, AdminGalleryUpload } from "@/components/admin/admin-image-upload";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionItem = { slug: string; label: string };

type VariantData = {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  material: string;
  availableFinishes: string[];
  shapes: string[];
  basePriceCents: number;
  minQty: number;
  weightGrams: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  tiers: { minQty: number; discountPct: number }[] | null;
  sizePrices: Record<string, number> | null;
  customPresets: { id: string; label: string; widthMm: number; heightMm: number }[] | null;
  imageUrl: string | null;
  images: string[];
  active: boolean;
  sortOrder: number;
};

type ProductData = {
  id: string;
  name: string;
  slug: string;
  description: string | null | undefined;
  tagline: string | null | undefined;
  features: string[];
  imageUrl: string | null | undefined;
  images: string[];
  categoryId: string | null | undefined;
  requiresCustomization: boolean;
  active: boolean;
  sortOrder: number;
  sku: string | null | undefined;
  gtin: string | null | undefined;
  mpn: string | null | undefined;
  brand: string | undefined;
  reviewsEnabled?: boolean;
};

const ALL_SIZES = ["2x2", "3x3", "4x4", "5x5", "7x7", "custom"] as const;
const SIZE_LABELS: Record<string, string> = { "2x2": "2×2 cm", "3x3": "3×3 cm", "4x4": "4×4 cm", "5x5": "5×5 cm", "7x7": "7×7 cm", custom: "Sur-mesure" };

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  fontSize: 13,
  color: "#0A0E27",
  background: "#fff",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 16,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>
      {children}
    </h2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function Toggle({ value, onChange, labelOn, labelOff }: { value: boolean; onChange: (v: boolean) => void; labelOn: string; labelOff: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
      <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? "#22C55E" : "#D1D5DB", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
        <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value ? "#065F46" : "#6B7280" }}>{value ? labelOn : labelOff}</span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductEditClientV2({
  product: initialProduct,
  variants: initialVariants,
  categories,
  shapes,
  finishes,
  materials,
}: {
  product: ProductData;
  variants: VariantData[];
  categories: { id: string; name: string }[];
  shapes: OptionItem[];
  finishes: OptionItem[];
  materials: OptionItem[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"general" | "variants" | "preview">("general");
  const [variants, setVariants] = useState<VariantData[]>(initialVariants);

  return (
    <main style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/products" style={{ color: "#6B7280", textDecoration: "underline" }}>Produits</Link>
        {" / "}
        <span>{initialProduct.name}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: 0 }}>
          {initialProduct.name}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: initialProduct.requiresCustomization ? "#FEE2E2" : "#EFF6FF",
            color: initialProduct.requiresCustomization ? "#991B1B" : "#1D4ED8",
          }}>
            {initialProduct.requiresCustomization ? "Personnalisé" : "Impression directe"}
          </span>
          <Link href={`/products/${initialProduct.slug}`} target="_blank" style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Voir sur le site ↗
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #E5E7EB" }}>
        {([
          { id: "general", label: "Général" },
          { id: "variants", label: `Déclinaisons (${variants.length})` },
          { id: "preview", label: "Aperçu" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #0A0E27" : "2px solid transparent",
              marginBottom: -2,
              background: "none",
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === tab.id ? "#0A0E27" : "#6B7280",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <GeneralTab
          product={initialProduct}
          categories={categories}
          variants={variants}
          materials={materials}
          onSaved={() => router.refresh()}
          onGoToVariants={() => setActiveTab("variants")}
        />
      )}
      {activeTab === "variants" && (
        <VariantsTab
          productId={initialProduct.id}
          isDirectProduct={!initialProduct.requiresCustomization}
          variants={variants}
          shapes={shapes}
          finishes={finishes}
          materials={materials}
          onVariantsChange={setVariants}
        />
      )}
      {activeTab === "preview" && (
        <PreviewTab product={initialProduct} variants={variants} />
      )}
    </main>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({
  product,
  categories,
  variants,
  materials,
  onSaved,
  onGoToVariants,
}: {
  product: ProductData;
  categories: { id: string; name: string }[];
  variants: VariantData[];
  materials: OptionItem[];
  onSaved: () => void;
  onGoToVariants: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description ?? "");
  const [tagline, setTagline] = useState(product.tagline ?? "");
  const [features, setFeatures] = useState<string[]>(product.features ?? []);
  const [newFeature, setNewFeature] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl ?? null);
  const [images, setImages] = useState<string[]>(product.images ?? []);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [requiresCustomization, setRequiresCustomization] = useState(product.requiresCustomization);
  const [active, setActive] = useState(product.active);
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [sku, setSku] = useState(product.sku ?? "");
  const [gtin, setGtin] = useState(product.gtin ?? "");
  const [mpn, setMpn] = useState(product.mpn ?? "");
  const [brand, setBrand] = useState(product.brand ?? "MS Adhésif");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProductInfo(product.id, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        tagline: tagline.trim() || null,
        features: features.filter(Boolean),
        imageUrl: imageUrl || null,
        images,
        categoryId: categoryId || null,
        requiresCustomization,
        active,
        sortOrder: parseInt(sortOrder) || 0,
        sku: sku.trim() || null,
        gtin: gtin.trim() || null,
        mpn: mpn.trim() || null,
        brand: brand.trim() || "MS Adhésif",
      });
      if (res.ok) {
        setSuccess(true);
        onSaved();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {error && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 20 }}>{error}</div>}
      {success && <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", marginBottom: 20 }}>Produit mis à jour.</div>}

      <section style={sectionStyle}>
        <SectionTitle>Informations générales</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Nom du produit</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Slug (URL)</FieldLabel>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} />
            </div>
          </div>
          <div>
            <FieldLabel>Catégorie</FieldLabel>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">— Sans catégorie —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Tagline (affiché sur la page produit)</FieldLabel>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Ex : Stickers premium résistants eau & UV" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Description (Markdown)</FieldLabel>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Ordre d'affichage</FieldLabel>
              <input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionTitle>Identifiants produit (Google / SEO)</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <FieldLabel>SKU</FieldLabel>
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ex : STICKER-VINYLE-01 (défaut : slug)" style={{ ...inputStyle, fontFamily: "monospace" }} />
          </div>
          <div>
            <FieldLabel>Marque (brand)</FieldLabel>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="MS Adhésif" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>GTIN (EAN / code-barres)</FieldLabel>
            <input value={gtin} onChange={(e) => setGtin(e.target.value)} placeholder="Ex : 3760000000000" style={{ ...inputStyle, fontFamily: "monospace" }} />
          </div>
          <div>
            <FieldLabel>MPN (réf. fabricant)</FieldLabel>
            <input value={mpn} onChange={(e) => setMpn(e.target.value)} placeholder="Ex : MSADH-001" style={{ ...inputStyle, fontFamily: "monospace" }} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
          Ces champs alimentent le flux Google Merchant Center et le balisage JSON-LD Schema.org. Le GTIN est obligatoire pour les rich results Google Shopping.
        </p>
      </section>

      <section style={sectionStyle}>
        <SectionTitle>Type de produit</SectionTitle>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          {[
            { value: true, label: "Personnalisé", desc: "Upload fichier + BAT requis", color: "#DC2626", bg: "#FEE2E2" },
            { value: false, label: "Impression directe", desc: "Pas de fichier, pas de BAT", color: "#1D4ED8", bg: "#EFF6FF" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setRequiresCustomization(opt.value)}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 8,
                border: `2px solid ${requiresCustomization === opt.value ? opt.color : "#E5E7EB"}`,
                background: requiresCustomization === opt.value ? opt.bg : "#F9FAFB",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: requiresCustomization === opt.value ? opt.color : "#374151" }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          Ce réglage détermine si les clients doivent uploader un fichier et passer par le process BAT.
        </div>
      </section>

      {/* Guide options pour impression directe */}
      {!requiresCustomization && (
        <section style={{ ...sectionStyle, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <SectionTitle>⚙️ Options affichées sur la page produit</SectionTitle>
          <p style={{ fontSize: 13, color: "#1E40AF", marginBottom: 12, lineHeight: 1.6 }}>
            Pour un produit <strong>Impression directe</strong>, les options configurées dans les <strong>Déclinaisons</strong> apparaissent automatiquement comme sélecteurs sur la page produit :
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📐", label: "Tailles", desc: "Ajoutez des Présets de taille (ex : S=50×50mm, M=100×100mm) → un sélecteur de taille s'affiche" },
              { icon: "✂️", label: "Découpe", desc: "Si plusieurs Formes disponibles → un sélecteur de découpe s'affiche (die-cut, rond, carré…)" },
              { icon: "✨", label: "Finitions", desc: "Si plusieurs Finitions disponibles → un sélecteur finition s'affiche (brillant, mat, vernis UV)" },
              { icon: "🎨", label: "Matières", desc: "Plusieurs déclinaisons avec des matières différentes → un sélecteur de matière s'affiche" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #BFDBFE" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0A0E27" }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#1D4ED8", marginTop: 12 }}>
            → Gérez ces options dans l&apos;onglet <strong>Déclinaisons</strong>.
            Le prix unitaire HT que vous saisissez est la base avant multiplicateurs (forme, matière, finition).
          </p>
        </section>
      )}

      {/* Matières disponibles */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionTitle>Matières disponibles</SectionTitle>
          <button
            type="button"
            onClick={onGoToVariants}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Gérer dans Déclinaisons →
          </button>
        </div>
        {variants.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
            Aucune déclinaison. Cliquez sur &quot;Gérer dans Déclinaisons&quot; pour en créer une.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[...new Set(variants.map((v) => v.material))].map((mat) => {
                const count = variants.filter((v) => v.material === mat).length;
                const matLabel = materials.find((m) => m.slug === mat)?.label ?? mat;
                return (
                  <div
                    key={mat}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1.5px solid #E5E7EB",
                      background: "#F9FAFB",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0E27" }}>
                      {matLabel}
                    </span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {count} décl.
                    </span>
                  </div>
                );
              })}
            </div>
            <QuickAddMaterial
              productId={product.id}
              existingMaterials={[...new Set(variants.map((v) => v.material))]}
              materials={materials}
              onAdded={onGoToVariants}
            />
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <SectionTitle>Points forts</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#DC2626", fontWeight: 900, flexShrink: 0 }}>◆</span>
              <input value={f} onChange={(e) => { const n = [...features]; n[i] = e.target.value; setFeatures(n); }} style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="Ajouter un point fort…" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newFeature.trim()) { e.preventDefault(); setFeatures([...features, newFeature.trim()]); setNewFeature(""); } }} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => { if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(""); } }} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>+ Ajouter</button>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionTitle>Images</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AdminImageUpload
            label="Image principale"
            value={imageUrl}
            onChange={setImageUrl}
            folder="products"
            entityId={product.id}
            hint="Recommandé : 800×800px minimum"
          />
          <AdminGalleryUpload
            label="Galerie (photos supplémentaires)"
            values={images}
            onChange={setImages}
            folder="products"
            entityId={`${product.id}/gallery`}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionTitle>Statut</SectionTitle>
        <Toggle value={active} onChange={setActive} labelOn="Produit actif (visible sur le site)" labelOff="Produit désactivé (masqué)" />
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={handleSave} disabled={isPending} style={{ padding: "12px 28px", borderRadius: 8, border: "none", background: "#0A0E27", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Sauvegarde…" : "Sauvegarder les modifications"}
        </button>
        <Link href="/admin/products" style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Retour
        </Link>
      </div>
    </div>
  );
}

// ─── Quick Add Material ───────────────────────────────────────────────────────

function QuickAddMaterial({
  productId,
  existingMaterials,
  materials,
  onAdded,
}: {
  productId: string;
  existingMaterials: string[];
  materials: OptionItem[];
  onAdded: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  const available = materials.filter((m) => !existingMaterials.includes(m.slug));

  if (available.length === 0) return null;

  function handleAdd() {
    if (!selected) return;
    const mat = materials.find((m) => m.slug === selected);
    startTransition(async () => {
      const res = await createVariant({
        productId,
        name: mat?.label ?? selected,
        sku: null,
        material: selected,
        availableFinishes: ["gloss"],
        shapes: ["die-cut", "circle", "square"],
        basePriceCents: 599,
        minQty: 1,
        weightGrams: 100,
        minWidthMm: 20,
        maxWidthMm: 300,
        minHeightMm: 20,
        maxHeightMm: 300,
        tiers: null,
        sizePrices: null,
        customPresets: null,
        imageUrl: null,
        images: [],
        active: true,
        sortOrder: 99,
      });
      if (res.ok) onAdded();
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          padding: "7px 12px",
          borderRadius: 6,
          border: "1px solid #D1D5DB",
          fontSize: 13,
          color: "#374151",
          background: "#fff",
          outline: "none",
        }}
      >
        <option value="">— Ajouter une matière —</option>
        {available.map((m) => (
          <option key={m.slug} value={m.slug}>{m.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selected || isPending}
        style={{
          padding: "7px 16px",
          borderRadius: 6,
          border: "none",
          background: selected ? "#0A0E27" : "#E5E7EB",
          color: selected ? "#fff" : "#9CA3AF",
          fontSize: 12,
          fontWeight: 700,
          cursor: selected && !isPending ? "pointer" : "not-allowed",
        }}
      >
        {isPending ? "…" : "+ Ajouter"}
      </button>
    </div>
  );
}

// ─── Variants Tab ─────────────────────────────────────────────────────────────

function VariantsTab({
  productId,
  isDirectProduct,
  variants,
  shapes,
  finishes,
  materials,
  onVariantsChange,
}: {
  productId: string;
  isDirectProduct: boolean;
  variants: VariantData[];
  shapes: OptionItem[];
  finishes: OptionItem[];
  materials: OptionItem[];
  onVariantsChange: (v: VariantData[]) => void;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(variants.length === 1 ? variants[0]!.id : null);
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  function handleAddVariant() {
    startTransition(async () => {
      const res = await createVariant({
        productId,
        name: "Nouvelle déclinaison",
        sku: null,
        material: materials[0]?.slug ?? "vinyl",
        availableFinishes: [finishes[0]?.slug ?? "gloss"],
        shapes: shapes.slice(0, 3).map((s) => s.slug),
        basePriceCents: 599,
        minQty: 1,
        weightGrams: 100,
        minWidthMm: 20,
        maxWidthMm: 300,
        minHeightMm: 20,
        maxHeightMm: 300,
        tiers: null,
        sizePrices: null,
        customPresets: null,
        imageUrl: null,
        images: [],
        active: true,
        sortOrder: variants.length,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setGlobalError(res.error);
      }
    });
  }

  function handleDeleteVariant(id: string) {
    if (variants.length <= 1) {
      setGlobalError("Un produit doit avoir au moins une déclinaison.");
      return;
    }
    if (!confirm("Supprimer cette déclinaison ?")) return;
    startTransition(async () => {
      const res = await deleteVariant(id);
      if (res.ok) onVariantsChange(variants.filter((v) => v.id !== id));
      else setGlobalError(res.error);
    });
  }

  function handleMoveVariant(id: string, direction: "up" | "down") {
    const idx = variants.findIndex((v) => v.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === variants.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newOrder = [...variants];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx]!, newOrder[idx]!];
    const reordered = newOrder.map((v, i) => ({ ...v, sortOrder: i }));
    onVariantsChange(reordered);

    startTransition(async () => {
      await reorderVariants(productId, reordered.map((v) => v.id));
    });
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {globalError && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>{globalError}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {variants.map((variant, i) => (
          <VariantEditor
            key={variant.id}
            variant={variant}
            isDirectProduct={isDirectProduct}
            shapes={shapes}
            finishes={finishes}
            materials={materials}
            isExpanded={expandedId === variant.id}
            onToggle={() => setExpandedId(expandedId === variant.id ? null : variant.id)}
            onSaved={(updated) => onVariantsChange(variants.map((v) => (v.id === updated.id ? updated : v)))}
            onDelete={() => handleDeleteVariant(variant.id)}
            onMove={(dir) => handleMoveVariant(variant.id, dir)}
            index={i}
            isFirst={i === 0}
            isLast={i === variants.length - 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddVariant}
        disabled={isPending}
        style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, border: "2px dashed #D1D5DB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}
      >
        {isPending ? "Création…" : "+ Ajouter une déclinaison"}
      </button>
    </div>
  );
}

// ─── Variant editor card ──────────────────────────────────────────────────────

function VariantEditor({
  variant,
  isDirectProduct,
  shapes,
  finishes,
  materials,
  isExpanded,
  onToggle,
  onSaved,
  onDelete,
  onMove,
  index,
  isFirst,
  isLast,
}: {
  variant: VariantData;
  isDirectProduct: boolean;
  shapes: OptionItem[];
  finishes: OptionItem[];
  materials: OptionItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: (v: VariantData) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(variant.name);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [material, setMaterial] = useState(variant.material);
  const [selectedFinishes, setFinishes] = useState<string[]>(variant.availableFinishes);
  const [selectedShapes, setShapes] = useState<string[]>(variant.shapes);
  // basePriceCents = price for 50 units (reference qty). We show/edit as unit price HT.
  const [basePrice, setBasePrice] = useState((variant.basePriceCents / 100 / 50).toFixed(4));
  const [minQty, setMinQty] = useState(String(variant.minQty));
  const [weightGrams, setWeightGrams] = useState(String(variant.weightGrams));
  const [minW, setMinW] = useState(String(variant.minWidthMm));
  const [maxW, setMaxW] = useState(String(variant.maxWidthMm));
  const [minH, setMinH] = useState(String(variant.minHeightMm));
  const [maxH, setMaxH] = useState(String(variant.maxHeightMm));
  // For direct products: explicit toggles for which options to expose
  const [enableFinishChoice, setEnableFinishChoice] = useState(variant.availableFinishes.length > 1);
  const [enableShapeChoice, setEnableShapeChoice] = useState(variant.shapes.length > 1);
  const [enableTiers, setEnableTiers] = useState(variant.tiers != null && variant.tiers.length > 0);
  const [enableSizeChoice, setEnableSizeChoice] = useState(
    (variant.customPresets?.length ?? 0) > 0 || Object.keys(variant.sizePrices ?? {}).length > 0,
  );
  const [tiers, setTiers] = useState<PricingTier[]>(
    variant.tiers?.length
      ? (variant.tiers as PricingTier[])
      : QUANTITY_TIERS.map((t) => ({ minQty: t.minQty, discountPct: t.discountPct })),
  );
  // sizePrices stored as cents for 50 units. We show/edit as unit price HT.
  const [sizePrices, setSizePrices] = useState<Record<string, string>>(() => {
    const sp = variant.sizePrices ?? {};
    return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, (v / 100 / 50).toFixed(4)]));
  });
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(
    (variant.customPresets as CustomPreset[]) ?? [],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(variant.imageUrl ?? null);
  const [images, setImages] = useState<string[]>(variant.images ?? []);
  const [active, setActive] = useState(variant.active);

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      // For direct products: apply toggles before saving
      const finalFinishes = isDirectProduct && !enableFinishChoice
        ? [selectedFinishes[0] ?? "gloss"]
        : selectedFinishes;
      const finalShapes = isDirectProduct && !enableShapeChoice
        ? [selectedShapes[0] ?? "die-cut"]
        : selectedShapes;
      const finalTiers = isDirectProduct && !enableTiers
        ? []
        : tiers.filter((t) => t.minQty > 0).sort((a, b) => a.minQty - b.minQty);

      const input = {
        productId: variant.productId,
        name: name.trim(),
        sku: sku.trim() || null,
        material,
        availableFinishes: finalFinishes,
        shapes: finalShapes,
        basePriceCents: Math.round(parseFloat(basePrice) * 50 * 100) || 1,
        minQty: parseInt(minQty) || 1,
        weightGrams: parseInt(weightGrams) || 100,
        minWidthMm: parseInt(minW) || 20,
        maxWidthMm: parseInt(maxW) || 300,
        minHeightMm: parseInt(minH) || 20,
        maxHeightMm: parseInt(maxH) || 300,
        tiers: finalTiers,
        sizePrices: enableSizeChoice
          ? Object.fromEntries(
              Object.entries(sizePrices)
                .filter(([, v]) => v.trim() !== "" && parseFloat(v) > 0)
                .map(([k, v]) => [k, Math.round(parseFloat(v) * 50 * 100)]),
            )
          : {},
        customPresets: enableSizeChoice
          ? customPresets.filter((p) => p.id && p.label && p.widthMm > 0 && p.heightMm > 0)
          : [],
        imageUrl: imageUrl || null,
        images,
        active,
        sortOrder: variant.sortOrder,
      };
      const res = await updateVariant(variant.id, input);
      if (res.ok) {
        setSuccess(true);
        onSaved({ ...variant, ...input, sku: input.sku });
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* Sort buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px 0 12px" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMove("up"); }}
            disabled={isFirst}
            style={{ padding: "2px 6px", fontSize: 10, border: "1px solid #E5E7EB", borderRadius: 3, background: "#F9FAFB", color: isFirst ? "#D1D5DB" : "#374151", cursor: isFirst ? "default" : "pointer" }}
          >▲</button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMove("down"); }}
            disabled={isLast}
            style={{ padding: "2px 6px", fontSize: 10, border: "1px solid #E5E7EB", borderRadius: 3, background: "#F9FAFB", color: isLast ? "#D1D5DB" : "#374151", cursor: isLast ? "default" : "pointer" }}
          >▼</button>
        </div>
        <div
          onClick={onToggle}
          style={{ flex: 1, padding: "16px 20px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: isExpanded ? "#F9FAFB" : "#fff" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #E5E7EB" }} />
            ) : (
              <div style={{ width: 36, height: 36, background: "#F3F4F6", borderRadius: 6 }} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0A0E27" }}>{name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace", marginTop: 2 }}>
                {sku || "—"} · {materials.find((m) => m.slug === material)?.label ?? material} · {(variant.basePriceCents / 100 / 50).toFixed(4)} €/u HT · {weightGrams}g
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: active ? "#D1FAE5" : "#F3F4F6",
              color: active ? "#065F46" : "#9CA3AF",
            }}>{active ? "Actif" : "Inactif"}</span>
            <span style={{ fontSize: 16, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "20px 24px" }}>
          {error && <div style={{ background: "#FEE2E2", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#991B1B", marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ background: "#D1FAE5", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#065F46", marginBottom: 16 }}>Déclinaison sauvegardée.</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name + SKU */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Nom de la déclinaison</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>SKU</FieldLabel>
                <input value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="Ex : MSA-VIN-GLOSS-001" />
              </div>
            </div>

            {/* Material */}
            <div>
              <FieldLabel>Matière</FieldLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {materials.map((m) => (
                  <button key={m.slug} type="button" onClick={() => setMaterial(m.slug)} style={{ padding: "7px 14px", borderRadius: 8, border: `2px solid ${material === m.slug ? "#0A0E27" : "#E5E7EB"}`, background: material === m.slug ? "#0A0E27" : "#F9FAFB", color: material === m.slug ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Finishes + Shapes */}
            {isDirectProduct ? (
              /* Direct product: show explicit toggles */
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 16px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Options proposées au client</div>

                {/* Finition toggle */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableFinishChoice ? 8 : 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Choix de finition</label>
                    <Toggle value={enableFinishChoice} onChange={setEnableFinishChoice} labelOn="Oui" labelOff="Non" />
                  </div>
                  {enableFinishChoice && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {finishes.map((f) => {
                        const on = selectedFinishes.includes(f.slug);
                        return <button key={f.slug} type="button" onClick={() => setFinishes(on && selectedFinishes.length > 1 ? selectedFinishes.filter((x) => x !== f.slug) : on ? selectedFinishes : [...selectedFinishes, f.slug])} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${on ? "#0A0E27" : "#E5E7EB"}`, background: on ? "#0A0E27" : "#F9FAFB", color: on ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{f.label}</button>;
                      })}
                    </div>
                  )}
                  {!enableFinishChoice && (
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                      Finition fixe : <strong>{finishes.find((f) => f.slug === selectedFinishes[0])?.label ?? selectedFinishes[0] ?? "Brillant"}</strong>
                      <span style={{ marginLeft: 8, fontSize: 11, display: "inline-flex", gap: 4 }}>
                        {finishes.map((f) => (
                          <button key={f.slug} type="button" onClick={() => setFinishes([f.slug])} style={{ padding: "2px 8px", borderRadius: 4, border: `1.5px solid ${selectedFinishes[0] === f.slug ? "#0A0E27" : "#E5E7EB"}`, background: selectedFinishes[0] === f.slug ? "#0A0E27" : "#F9FAFB", color: selectedFinishes[0] === f.slug ? "#fff" : "#374151", fontSize: 11, cursor: "pointer" }}>{f.label}</button>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Shape toggle */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableShapeChoice ? 8 : 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Choix de découpe</label>
                    <Toggle value={enableShapeChoice} onChange={setEnableShapeChoice} labelOn="Oui" labelOff="Non" />
                  </div>
                  {enableShapeChoice && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {shapes.map((s) => {
                        const on = selectedShapes.includes(s.slug);
                        return <button key={s.slug} type="button" onClick={() => setShapes(on && selectedShapes.length > 1 ? selectedShapes.filter((x) => x !== s.slug) : on ? selectedShapes : [...selectedShapes, s.slug])} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${on ? "#0A0E27" : "#E5E7EB"}`, background: on ? "#0A0E27" : "#F9FAFB", color: on ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>;
                      })}
                    </div>
                  )}
                  {!enableShapeChoice && (
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                      Découpe fixe : <strong>{shapes.find((s) => s.slug === selectedShapes[0])?.label ?? selectedShapes[0] ?? "Découpe à la forme"}</strong>
                      <span style={{ marginLeft: 8, fontSize: 11, display: "inline-flex", gap: 4 }}>
                        {shapes.map((s) => (
                          <button key={s.slug} type="button" onClick={() => setShapes([s.slug])} style={{ padding: "2px 8px", borderRadius: 4, border: `1.5px solid ${selectedShapes[0] === s.slug ? "#0A0E27" : "#E5E7EB"}`, background: selectedShapes[0] === s.slug ? "#0A0E27" : "#F9FAFB", color: selectedShapes[0] === s.slug ? "#fff" : "#374151", fontSize: 11, cursor: "pointer" }}>{s.label}</button>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Size toggle */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableSizeChoice ? 10 : 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Choix de taille</label>
                    <Toggle value={enableSizeChoice} onChange={(v) => { setEnableSizeChoice(v); if (v && customPresets.length === 0) setCustomPresets([{ id: "s", label: "S", widthMm: 50, heightMm: 50 }, { id: "m", label: "M", widthMm: 100, heightMm: 100 }]); }} labelOn="Oui" labelOff="Non" />
                  </div>
                  {!enableSizeChoice && (
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Taille unique — pas de sélecteur affiché</div>
                  )}
                  {enableSizeChoice && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 55px 55px 80px 28px", gap: 5 }}>
                        {["Libellé", "ID", "L (mm)", "H (mm)", "Prix HT €", ""].map((h) => (
                          <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</span>
                        ))}
                      </div>
                      {customPresets.map((p, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 55px 55px 80px 28px", gap: 5, alignItems: "center" }}>
                          <input value={p.label} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, label: e.target.value }; setCustomPresets(n); }} style={{ ...inputStyle, fontSize: 12 }} placeholder="Petit / S…" />
                          <input value={p.id} onChange={(e) => { const id = e.target.value.replace(/\s+/g, "-").toLowerCase(); const n = [...customPresets]; const oldId = n[i]!.id; n[i] = { ...n[i]!, id }; setCustomPresets(n); setSizePrices((prev) => { const next = { ...prev }; if (oldId in next) { next[id] = next[oldId]!; delete next[oldId]; } return next; }); }} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11 }} />
                          <input type="number" min="5" value={p.widthMm} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, widthMm: parseInt(e.target.value) || 10 }; setCustomPresets(n); }} style={{ ...inputStyle, fontSize: 12 }} />
                          <input type="number" min="5" value={p.heightMm} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, heightMm: parseInt(e.target.value) || 10 }; setCustomPresets(n); }} style={{ ...inputStyle, fontSize: 12 }} />
                          <div style={{ position: "relative" }}>
                            <input type="number" step="0.01" min="0" placeholder="auto" value={sizePrices[p.id] ?? ""} onChange={(e) => { const v = e.target.value; setSizePrices((prev) => { const next = { ...prev }; if (v === "") delete next[p.id]; else next[p.id] = v; return next; }); }} style={{ ...inputStyle, paddingRight: 20, fontSize: 12 }} />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#9CA3AF" }}>€</span>
                          </div>
                          <button type="button" onClick={() => { setCustomPresets(customPresets.filter((_, j) => j !== i)); setSizePrices((prev) => { const next = { ...prev }; delete next[p.id]; return next; }); }} style={{ padding: "5px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontSize: 11 }}>✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { const id = `taille-${Date.now()}`; setCustomPresets([...customPresets, { id, label: "", widthMm: 50, heightMm: 50 }]); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 700, alignSelf: "flex-start" }}>+ Taille</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Customizable product: standard multi-select */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Finitions disponibles</FieldLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {finishes.map((f) => {
                      const on = selectedFinishes.includes(f.slug);
                      return <button key={f.slug} type="button" onClick={() => setFinishes(on && selectedFinishes.length > 1 ? selectedFinishes.filter((x) => x !== f.slug) : on ? selectedFinishes : [...selectedFinishes, f.slug])} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${on ? "#0A0E27" : "#E5E7EB"}`, background: on ? "#0A0E27" : "#F9FAFB", color: on ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{f.label}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Formes disponibles</FieldLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {shapes.map((s) => {
                      const on = selectedShapes.includes(s.slug);
                      return <button key={s.slug} type="button" onClick={() => setShapes(on && selectedShapes.length > 1 ? selectedShapes.filter((x) => x !== s.slug) : on ? selectedShapes : [...selectedShapes, s.slug])} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${on ? "#0A0E27" : "#E5E7EB"}`, background: on ? "#0A0E27" : "#F9FAFB", color: on ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Pricing + Dimensions */}
            <div style={{ display: "grid", gridTemplateColumns: isDirectProduct ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14 }}>
              <div>
                <FieldLabel>Prix unitaire HT (€)</FieldLabel>
                <div style={{ position: "relative" }}>
                  <input type="number" step="0.0001" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} style={{ ...inputStyle, paddingRight: 24 }} />
                  <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>€</span>
                </div>
                {isDirectProduct && (
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    Prix affiché tel quel sur la page produit, sans multiplicateurs.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>Qté min</FieldLabel>
                <input type="number" min="1" value={minQty} onChange={(e) => setMinQty(e.target.value)} style={inputStyle} />
              </div>
              {!isDirectProduct && (
                <div>
                  <FieldLabel>Poids (g)</FieldLabel>
                  <div style={{ position: "relative" }}>
                    <input type="number" min="1" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} style={{ ...inputStyle, paddingRight: 18 }} />
                    <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>g</span>
                  </div>
                </div>
              )}
            </div>

            {/* Dimension ranges — only for customizable products */}
            {!isDirectProduct && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[["Larg. min (mm)", minW, setMinW], ["Larg. max (mm)", maxW, setMaxW], ["Haut. min (mm)", minH, setMinH], ["Haut. max (mm)", maxH, setMaxH]].map(([lbl, val, fn]) => (
                  <div key={String(lbl)}>
                    <FieldLabel>{String(lbl)}</FieldLabel>
                    <input type="number" value={String(val)} onChange={(e) => (fn as (v: string) => void)(e.target.value)} style={inputStyle} />
                  </div>
                ))}
              </div>
            )}

            {/* Pricing tiers */}
            <div>
              {isDirectProduct ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableTiers ? 12 : 0 }}>
                  <FieldLabel>Remises dégressives par quantité</FieldLabel>
                  <Toggle value={enableTiers} onChange={(v) => { setEnableTiers(v); if (v && tiers.length === 0) setTiers(QUANTITY_TIERS.map((t) => ({ minQty: t.minQty, discountPct: t.discountPct }))); }} labelOn="Actives" labelOff="Inactives" />
                </div>
              ) : (
                <FieldLabel>Tarifs dégressifs</FieldLabel>
              )}
              {(!isDirectProduct || enableTiers) && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 36px", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>Qté min</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>Remise (%)</span>
                      <span />
                    </div>
                    {tiers.map((tier, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 36px", gap: 8, alignItems: "center" }}>
                        <input type="number" min="1" value={tier.minQty} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i]!, minQty: parseInt(e.target.value) || 1 }; setTiers(n); }} style={inputStyle} />
                        <div style={{ position: "relative" }}>
                          <input type="number" min="0" max="99" step="1" value={Math.round(tier.discountPct * 100)} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i]!, discountPct: (parseInt(e.target.value) || 0) / 100 }; setTiers(n); }} style={{ ...inputStyle, paddingRight: 26 }} />
                          <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>%</span>
                        </div>
                        <button type="button" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1} style={{ padding: "6px", borderRadius: 6, border: "1px solid #E5E7EB", background: tiers.length <= 1 ? "#F9FAFB" : "#FEE2E2", color: tiers.length <= 1 ? "#D1D5DB" : "#991B1B", cursor: "pointer", fontSize: 12 }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setTiers([...tiers, { minQty: (tiers[tiers.length - 1]?.minQty ?? 50) * 2, discountPct: 0 }])} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Palier</button>
                    <button type="button" onClick={() => setTiers(QUANTITY_TIERS.map((t) => ({ minQty: t.minQty, discountPct: t.discountPct })))} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer", fontSize: 12 }}>Réinitialiser</button>
                  </div>
                </>
              )}
            </div>

            {/* Size prices + presets — only for customizable products (direct products handle this in the Options panel) */}
            {!isDirectProduct && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableSizeChoice ? 12 : 0 }}>
                  <FieldLabel>Tailles proposées au client</FieldLabel>
                  <Toggle value={enableSizeChoice} onChange={(v) => { setEnableSizeChoice(v); if (v && customPresets.length === 0) setCustomPresets([{ id: "preset-1", label: "", widthMm: 50, heightMm: 50 }]); }} labelOn="Actives" labelOff="Inactives" />
                </div>
                {enableSizeChoice && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                      {ALL_SIZES.filter((s) => s !== "custom").map((s) => (
                        <div key={s}>
                          <label style={{ fontSize: 10, color: "#9CA3AF", display: "block", marginBottom: 4 }}>{SIZE_LABELS[s]}</label>
                          <div style={{ position: "relative" }}>
                            <input type="number" step="0.01" min="0" placeholder="auto" value={sizePrices[s] ?? ""} onChange={(e) => { const v = e.target.value; setSizePrices((prev) => { const n = { ...prev }; if (v === "") delete n[s]; else n[s] = v; return n; }); }} style={{ ...inputStyle, paddingRight: 24, fontSize: 12 }} />
                            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {customPresets.filter((p) => p.id).map((preset) => (
                      <div key={`cp-${preset.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10, marginBottom: 8, alignItems: "end" }}>
                        <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{preset.label || preset.id} ({preset.widthMm}×{preset.heightMm}mm)</div>
                        <div style={{ position: "relative" }}>
                          <input type="number" step="0.01" min="0" placeholder="auto" value={sizePrices[preset.id] ?? ""} onChange={(e) => { const v = e.target.value; setSizePrices((prev) => { const n = { ...prev }; if (v === "") delete n[preset.id]; else n[preset.id] = v; return n; }); }} style={{ ...inputStyle, paddingRight: 24, fontSize: 12 }} />
                          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>€</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12, marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Présets personnalisés</div>
                      {customPresets.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px 70px 32px", gap: 8 }}>
                            {["Libellé", "ID", "L.", "H.", ""].map((h) => <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</span>)}
                          </div>
                          {customPresets.map((p, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px 70px 32px", gap: 8, alignItems: "center" }}>
                              <input value={p.label} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, label: e.target.value }; setCustomPresets(n); }} style={inputStyle} placeholder="Carte postale" />
                              <input value={p.id} onChange={(e) => { const id = e.target.value.replace(/\s+/g, "-").toLowerCase(); const n = [...customPresets]; const oldId = n[i]!.id; n[i] = { ...n[i]!, id }; setCustomPresets(n); setSizePrices((prev) => { const next = { ...prev }; if (oldId in next) { next[id] = next[oldId]!; delete next[oldId]; } return next; }); }} style={{ ...inputStyle, fontFamily: "monospace" }} />
                              <input type="number" min="5" value={p.widthMm} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, widthMm: parseInt(e.target.value) || 10 }; setCustomPresets(n); }} style={inputStyle} />
                              <input type="number" min="5" value={p.heightMm} onChange={(e) => { const n = [...customPresets]; n[i] = { ...n[i]!, heightMm: parseInt(e.target.value) || 10 }; setCustomPresets(n); }} style={inputStyle} />
                              <button type="button" onClick={() => { setCustomPresets(customPresets.filter((_, j) => j !== i)); setSizePrices((prev) => { const next = { ...prev }; delete next[p.id]; return next; }); }} style={{ padding: "6px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontSize: 12 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => setCustomPresets([...customPresets, { id: `preset-${Date.now()}`, label: "", widthMm: 50, heightMm: 50 }])} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Préset</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Variant image */}
            <div>
              <FieldLabel>Image de la déclinaison</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <AdminImageUpload
                  label="Image principale"
                  value={imageUrl}
                  onChange={setImageUrl}
                  folder="variants"
                  entityId={variant.id}
                  compact
                />
                <AdminGalleryUpload
                  label="Galerie"
                  values={images}
                  onChange={setImages}
                  folder="variants"
                  entityId={`${variant.id}/gallery`}
                  maxImages={6}
                />
              </div>
            </div>

            {/* Active */}
            <Toggle value={active} onChange={setActive} labelOn="Déclinaison active" labelOff="Déclinaison désactivée" />

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid #E5E7EB" }}>
              <button onClick={handleSave} disabled={isPending} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#0A0E27", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Sauvegarde…" : "Sauvegarder la déclinaison"}
              </button>
              <button type="button" onClick={onDelete} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview Tab ──────────────────────────────────────────────────────────────

function PreviewTab({ product, variants }: { product: ProductData; variants: VariantData[] }) {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0A0E27", marginBottom: 12 }}>Informations</div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Nom", product.name],
              ["Slug", product.slug],
              ["Type", product.requiresCustomization ? "Personnalisé (BAT)" : "Impression directe"],
              ["Déclinaisons", `${variants.length} déclinaison${variants.length > 1 ? "s" : ""}`],
              ["Statut", product.active ? "Actif" : "Inactif"],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "8px 0", fontWeight: 600, color: "#6B7280", width: 140 }}>{k}</td>
                <td style={{ padding: "8px 0", color: "#0A0E27" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Link
          href={`/products/${product.slug}`}
          target="_blank"
          style={{ padding: "10px 20px", borderRadius: 8, background: "#0A0E27", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          Voir la page produit ↗
        </Link>
      </div>
    </div>
  );
}
