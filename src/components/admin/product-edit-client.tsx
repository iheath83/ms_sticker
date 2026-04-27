"use client";

import { useState, useTransition } from "react";
import { QUANTITY_TIERS } from "@/lib/pricing";
import type { PricingTier, CustomPreset } from "@/lib/pricing";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateProduct } from "@/lib/admin-actions";

const ALL_SHAPES = ["die-cut", "circle", "square", "rectangle", "kiss-cut"] as const;
const SHAPE_LABELS: Record<string, string> = { "die-cut": "Die-cut", circle: "Cercle", square: "Carré", rectangle: "Rectangle", "kiss-cut": "Kiss-cut" };

const ALL_FINISHES = ["gloss", "matte", "uv-laminated"] as const;
const FINISH_LABELS: Record<string, string> = { gloss: "Brillant (Gloss)", matte: "Mat", "uv-laminated": "UV laminé" };

const ALL_SIZES = ["2x2", "3x3", "4x4", "5x5", "7x7", "custom"] as const;
const SIZE_LABELS: Record<string, string> = { "2x2": "2×2 cm", "3x3": "3×3 cm", "4x4": "4×4 cm", "5x5": "5×5 cm", "7x7": "7×7 cm", custom: "Sur-mesure" };

const ALL_MATERIALS = ["vinyl", "holographic", "glitter", "transparent", "kraft"] as const;
const MATERIAL_LABELS: Record<string, string> = { vinyl: "Vinyle", holographic: "Holographique", glitter: "Pailleté", transparent: "Transparent", kraft: "Kraft" };

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  options: unknown;
  basePriceCents: number;
  minQty: number;
  material: string;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  shapes: string[];
  active: boolean;
  sortOrder: number;
};

export function ProductEditClient({ product }: { product: Product }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const opts = (product.options ?? {}) as Record<string, unknown>;
  const initTagline = typeof opts.tagline === "string" ? opts.tagline : "";
  const initFeatures = Array.isArray(opts.features) ? (opts.features as string[]) : [];
  const initTiers: PricingTier[] = Array.isArray(opts.tiers)
    ? (opts.tiers as PricingTier[])
    : QUANTITY_TIERS.map((t) => ({ minQty: t.minQty, discountPct: t.discountPct }));

  const initCustomPresets: CustomPreset[] = Array.isArray(opts.customPresets)
    ? (opts.customPresets as CustomPreset[])
    : [];

  const initSizePrices: Record<string, string> = (() => {
    const raw = opts.sizePrices;
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      return Object.fromEntries(
        Object.entries(raw as Record<string, number>).map(([k, v]) => [k, (v / 100).toFixed(2)])
      );
    }
    return {};
  })();

  const initFinishes: string[] = Array.isArray(opts.availableFinishes)
    ? (opts.availableFinishes as string[])
    : [...ALL_FINISHES];
  const initSizes: string[] = Array.isArray(opts.availableSizes)
    ? (opts.availableSizes as string[])
    : [...ALL_SIZES];
  const initMaterials: string[] = Array.isArray(opts.availableMaterials)
    ? (opts.availableMaterials as string[])
    : [...ALL_MATERIALS];

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [tagline, setTagline] = useState(initTagline);
  const [features, setFeatures] = useState<string[]>(initFeatures);
  const [newFeature, setNewFeature] = useState("");
  const [tiers, setTiers] = useState<PricingTier[]>(initTiers);
  const [finishes, setFinishes] = useState<string[]>(initFinishes);
  const [sizes, setSizes] = useState<string[]>(initSizes);
  const [materials, setMaterials] = useState<string[]>(initMaterials);
  const [minQtyVal, setMinQtyVal] = useState(String(product.minQty ?? 1));
  const [sizePricesVal, setSizePricesVal] = useState<Record<string, string>>(initSizePrices);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(initCustomPresets);
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [basePriceEuros, setBasePriceEuros] = useState((product.basePriceCents / 100).toFixed(2));
  const [minW, setMinW] = useState(String(product.minWidthMm));
  const [maxW, setMaxW] = useState(String(product.maxWidthMm));
  const [minH, setMinH] = useState(String(product.minHeightMm));
  const [maxH, setMaxH] = useState(String(product.maxHeightMm));
  const [shapes, setShapes] = useState<string[]>(product.shapes);
  const [active, setActive] = useState(product.active);
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleShape(s: string) {
    setShapes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProduct({
        id: product.id,
        name: name.trim(),
        description: description.trim() || undefined,
        tagline: tagline.trim() || undefined,
        features: features.filter(Boolean),
        tiers: tiers.filter((t) => t.minQty > 0).sort((a, b) => a.minQty - b.minQty),
        availableFinishes: finishes as ("gloss" | "matte" | "uv-laminated")[],
        availableSizes: sizes as ("2x2" | "3x3" | "4x4" | "5x5" | "7x7" | "custom")[],
        availableMaterials: materials as ("vinyl" | "holographic" | "glitter" | "transparent" | "kraft")[],
        customPresets: customPresets.filter((p) => p.id && p.label && p.widthMm > 0 && p.heightMm > 0),
        sizePrices: Object.fromEntries(
          Object.entries(sizePricesVal)
            .filter(([, v]) => v.trim() !== "" && parseFloat(v) > 0)
            .map(([k, v]) => [k, Math.round(parseFloat(v) * 100)])
        ),
        minQty: parseInt(minQtyVal) || 1,
        imageUrl: imageUrl.trim() || undefined,
        basePriceCents: Math.round(parseFloat(basePriceEuros) * 100),
        minWidthMm: parseInt(minW),
        maxWidthMm: parseInt(maxW),
        minHeightMm: parseInt(minH),
        maxHeightMm: parseInt(maxH),
        shapes: shapes as ("die-cut" | "circle" | "square" | "rectangle" | "kiss-cut")[],
        active,
        sortOrder: parseInt(sortOrder) || 0,
      });
      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 720 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/products" style={{ color: "#6B7280", textDecoration: "underline" }}>
          Produits
        </Link>
        {" / "}
        <span>{product.name}</span>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-archivo), system-ui, sans-serif",
          fontSize: 24,
          fontWeight: 900,
          color: "#0A0E27",
          letterSpacing: "-0.02em",
          margin: "0 0 8px",
        }}
      >
        Éditer · {product.name}
      </h1>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 32 }}>
        Matière : <strong style={{ color: "#374151" }}>{product.material}</strong>
        &nbsp;· Slug non modifiable
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 20 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", marginBottom: 20 }}>
          Produit mis à jour.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Général */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Général</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nom du produit">
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Description longue (interne / SEO)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
            <Field label="Tagline affiché sur la page produit">
              <input
                type="text"
                placeholder="Ex : Stickers premium résistants eau & UV, garantis 3 ans extérieur."
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, display: "block" }}>
                Texte court visible dans l&apos;en-tête de la page produit
              </span>
            </Field>
            <Field label="Image produit (URL)">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={inputStyle}
              />
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Aperçu"
                  style={{ marginTop: 8, width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="Prix de base (€) pour 50 unités 5×5cm">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePriceEuros}
                  onChange={(e) => setBasePriceEuros(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Quantité minimum de commande">
                <input
                  type="number"
                  min="1"
                  value={minQtyVal}
                  onChange={(e) => setMinQtyVal(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Ordre d'affichage">
                <input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Features / bullets */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Points forts — affichés sur la page produit</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#DC2626", fontWeight: 900, flexShrink: 0 }}>◆</span>
                <input
                  value={f}
                  onChange={(e) => {
                    const next = [...features];
                    next[i] = e.target.value;
                    setFeatures(next);
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontSize: 14, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Ajouter un point fort…"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFeature.trim()) {
                    e.preventDefault();
                    setFeatures([...features, newFeature.trim()]);
                    setNewFeature("");
                  }
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newFeature.trim()) {
                    setFeatures([...features, newFeature.trim()]);
                    setNewFeature("");
                  }
                }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 700, flexShrink: 0 }}
              >
                + Ajouter
              </button>
            </div>
          </div>
        </section>

        {/* Dimensions */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Dimensions autorisées (mm)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
            <Field label="Largeur min">
              <input type="number" value={minW} onChange={(e) => setMinW(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Largeur max">
              <input type="number" value={maxW} onChange={(e) => setMaxW(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Hauteur min">
              <input type="number" value={minH} onChange={(e) => setMinH(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Hauteur max">
              <input type="number" value={maxH} onChange={(e) => setMaxH(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </section>

        {/* Prix par taille */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Prix par taille (pour 50 unités)</h2>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, marginTop: 0 }}>
            Si renseigné, ce prix remplace le calcul par surface. Laisser vide = formule automatique depuis le prix de base.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Prix pour les présets personnalisés */}
            {customPresets.filter((p) => p.id).map((preset) => (
              <div key={`cp-${preset.id}`} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                <Field label={`${preset.label || preset.id} (€ TTC)`} hint={`${preset.widthMm}×${preset.heightMm} mm`}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number" step="0.01" min="0" placeholder="auto"
                      value={sizePricesVal[preset.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSizePricesVal((prev) => {
                          const next = { ...prev };
                          if (val === "") delete next[preset.id];
                          else next[preset.id] = val;
                          return next;
                        });
                      }}
                      style={{ ...inputStyle, paddingRight: 28 }}
                    />
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF" }}>€</span>
                  </div>
                </Field>
              </div>
            ))}
            {/* Séparateur */}
            {customPresets.length > 0 && (
              <hr style={{ border: "none", borderTop: "1px solid #E5E7EB", marginBottom: 4 }} />
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {ALL_SIZES.filter((s) => s !== "custom").map((s) => (
              <Field key={s} label={`${SIZE_LABELS[s]} (€ TTC)`}>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="auto"
                    value={sizePricesVal[s] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSizePricesVal((prev) => {
                        const next = { ...prev };
                        if (val === "") delete next[s];
                        else next[s] = val;
                        return next;
                      });
                    }}
                    style={{ ...inputStyle, paddingRight: 28 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF", pointerEvents: "none" }}>€</span>
                </div>
              </Field>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF" }}>
            Le prix affiché dans le configurateur = prix de la taille sélectionnée × remise palier × finition × forme
          </div>
        </section>

        {/* Présets personnalisés */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Présets de taille personnalisés</h2>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, marginTop: 0 }}>
            Ajoutez des tailles spécifiques (ex: 4×6 cm, 10×3 cm…) qui apparaîtront dans le configurateur en plus des présets standards.
          </p>

          {customPresets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 36px", gap: 8 }}>
                {["Libellé affiché", "ID (unique)", "Larg. (mm)", "Haut. (mm)", ""].map((h) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                ))}
              </div>
              {customPresets.map((preset, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 36px", gap: 8, alignItems: "center" }}>
                  <input value={preset.label} placeholder="ex: Carte postale"
                    onChange={(e) => { const n=[...customPresets]; n[i]={...n[i]!,label:e.target.value}; setCustomPresets(n); }}
                    style={inputStyle} />
                  <input value={preset.id} placeholder="ex: postcard"
                    onChange={(e) => { const n=[...customPresets]; n[i]={...n[i]!,id:e.target.value.replace(/\s+/g,"-").toLowerCase()}; setCustomPresets(n); }}
                    style={{...inputStyle,fontFamily:"monospace"}} />
                  <input type="number" min="5" max="500" value={preset.widthMm}
                    onChange={(e) => { const n=[...customPresets]; n[i]={...n[i]!,widthMm:parseInt(e.target.value)||10}; setCustomPresets(n); }}
                    style={inputStyle} />
                  <input type="number" min="5" max="500" value={preset.heightMm}
                    onChange={(e) => { const n=[...customPresets]; n[i]={...n[i]!,heightMm:parseInt(e.target.value)||10}; setCustomPresets(n); }}
                    style={inputStyle} />
                  <button type="button" onClick={() => setCustomPresets(customPresets.filter((_,j)=>j!==i))}
                    style={{ padding:"6px", borderRadius:6, border:"1px solid #E5E7EB", background:"#FEE2E2", color:"#991B1B", cursor:"pointer", fontSize:13, textAlign:"center" }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button"
            onClick={() => setCustomPresets([...customPresets, { id: `preset-${Date.now()}`, label: "", widthMm: 50, heightMm: 50 }])}
            style={{ padding:"8px 16px", borderRadius:6, border:"1px solid #E5E7EB", background:"#F3F4F6", color:"#374151", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            + Ajouter un préset
          </button>

          {customPresets.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF" }}>
              💡 Définissez aussi un prix dans "Prix par taille" en utilisant le même ID pour ce préset.
            </div>
          )}
        </section>

        {/* Finitions disponibles */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Finitions disponibles</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ALL_FINISHES.map((f) => {
              const active = finishes.includes(f);
              return (
                <button key={f} type="button"
                  onClick={() => setFinishes(active && finishes.length > 1 ? finishes.filter((x) => x !== f) : active ? finishes : [...finishes, f])}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`, background: active ? "#0A0E27" : "#F9FAFB", color: active ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {FINISH_LABELS[f]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Tailles disponibles */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Tailles disponibles (présets)</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ALL_SIZES.map((s) => {
              const active = sizes.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => setSizes(active && sizes.length > 1 ? sizes.filter((x) => x !== s) : active ? sizes : [...sizes, s])}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`, background: active ? "#0A0E27" : "#F9FAFB", color: active ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "monospace" }}
                >
                  {SIZE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Matières disponibles */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Matières disponibles</h2>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, marginTop: 0 }}>
            Contrôle quelles matières apparaissent dans le sélecteur sur la page produit
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ALL_MATERIALS.map((m) => {
              const active = materials.includes(m);
              return (
                <button key={m} type="button"
                  onClick={() => setMaterials(active && materials.length > 1 ? materials.filter((x) => x !== m) : active ? materials : [...materials, m])}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`, background: active ? "#0A0E27" : "#F9FAFB", color: active ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {MATERIAL_LABELS[m]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Pricing tiers */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Tarifs dégressifs</h2>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
            Quantité minimale → remise appliquée sur le prix unitaire. Le premier palier doit être à 1 avec 0%.
          </div>

          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Qté min</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Remise (%)</div>
            <div />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tiers.map((tier, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  value={tier.minQty}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[i] = { ...next[i]!, minQty: parseInt(e.target.value) || 1 };
                    setTiers(next);
                  }}
                  style={inputStyle}
                />
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                    value={Math.round(tier.discountPct * 100)}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[i] = { ...next[i]!, discountPct: (parseInt(e.target.value) || 0) / 100 };
                      setTiers(next);
                    }}
                    style={{ ...inputStyle, paddingRight: 28 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF", pointerEvents: "none" }}>%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                  disabled={tiers.length <= 1}
                  style={{ padding: "6px", borderRadius: 6, border: "1px solid #E5E7EB", background: tiers.length <= 1 ? "#F9FAFB" : "#FEE2E2", color: tiers.length <= 1 ? "#D1D5DB" : "#991B1B", cursor: tiers.length <= 1 ? "not-allowed" : "pointer", fontSize: 13, textAlign: "center" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setTiers([...tiers, { minQty: (tiers[tiers.length - 1]?.minQty ?? 0) * 2 || 100, discountPct: 0 }])}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              + Ajouter un palier
            </button>
            <button
              type="button"
              onClick={() => setTiers(QUANTITY_TIERS.map((t) => ({ minQty: t.minQty, discountPct: t.discountPct })))}
              style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer", fontSize: 12 }}
            >
              Réinitialiser (défaut)
            </button>
          </div>
        </section>

        {/* Formes */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Formes disponibles</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ALL_SHAPES.map((s) => {
              const checked = shapes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleShape(s)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `2px solid ${checked ? "#0A0E27" : "#E5E7EB"}`,
                    background: checked ? "#0A0E27" : "#F9FAFB",
                    color: checked ? "#fff" : "#374151",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {SHAPE_LABELS[s] ?? s}
                </button>
              );
            })}
          </div>
          {shapes.length === 0 && (
            <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>
              Au moins une forme requise
            </div>
          )}
        </section>

        {/* Statut */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Statut</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <div
              onClick={() => setActive(!active)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: active ? "#22C55E" : "#D1D5DB",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: active ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.2s",
                }}
              />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: active ? "#065F46" : "#6B7280" }}>
              {active ? "Produit actif (visible sur le site)" : "Produit désactivé (masqué)"}
            </span>
          </label>
        </section>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={isPending || shapes.length === 0}
            style={{
              padding: "12px 28px",
              borderRadius: 8,
              border: "none",
              background: "#0A0E27",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Sauvegarde…" : "Sauvegarder les modifications"}
          </button>
          <Link
            href="/admin/products"
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#374151",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Annuler
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
        {hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, color: "#9CA3AF" }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "20px 24px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 800,
  color: "#0A0E27",
  margin: "0 0 16px 0",
};

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
