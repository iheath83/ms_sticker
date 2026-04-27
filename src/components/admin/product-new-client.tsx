"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProduct } from "@/lib/product-catalog-actions";

const ALL_MATERIALS = [
  { id: "vinyl", label: "Vinyle" },
  { id: "holographic", label: "Holographique" },
  { id: "glitter", label: "Pailleté" },
  { id: "transparent", label: "Transparent" },
  { id: "kraft", label: "Kraft" },
];

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

export function ProductNewClient({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [requiresCustomization, setRequiresCustomization] = useState(true);
  const [material, setMaterial] = useState("vinyl");
  const [basePrice, setBasePrice] = useState("5.99");
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createProduct({
        name: name.trim(),
        categoryId: categoryId || null,
        requiresCustomization,
        material,
        basePriceCents: Math.round(parseFloat(basePrice) * 100) || 599,
      });
      if (res.ok) {
        router.push(`/admin/products/${res.data.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 560 }}>
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/products" style={{ color: "#6B7280", textDecoration: "underline" }}>Produits</Link>
        {" / "}
        <span>Nouveau produit</span>
      </div>

      <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
        Nouveau produit
      </h1>
      <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 32 }}>
        Renseignez les informations de base. Vous pourrez ajouter les déclinaisons, images et tarifs détaillés dans l&apos;éditeur.
      </p>

      {error && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 20 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "24px" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nom du produit *</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Stickers vinyle personnalisés"
            style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Catégorie</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
            <option value="">— Sans catégorie —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>Type de produit *</label>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => setRequiresCustomization(true)}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 8,
                border: `2px solid ${requiresCustomization ? "#DC2626" : "#E5E7EB"}`,
                background: requiresCustomization ? "#FEF2F2" : "#F9FAFB",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: requiresCustomization ? "#991B1B" : "#374151" }}>Personnalisé</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Upload fichier + BAT requis</div>
            </button>
            <button
              type="button"
              onClick={() => setRequiresCustomization(false)}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 8,
                border: `2px solid ${!requiresCustomization ? "#1D4ED8" : "#E5E7EB"}`,
                background: !requiresCustomization ? "#EFF6FF" : "#F9FAFB",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: !requiresCustomization ? "#1D4ED8" : "#374151" }}>Impression directe</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Pas de fichier, pas de BAT</div>
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Matière principale</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ALL_MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMaterial(m.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `2px solid ${material === m.id ? "#0A0E27" : "#E5E7EB"}`,
                  background: material === m.id ? "#0A0E27" : "#F9FAFB",
                  color: material === m.id ? "#fff" : "#374151",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Prix de base (€ pour 50 unités 5×5cm)</label>
          <div style={{ position: "relative", maxWidth: 180 }}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              style={{ ...inputStyle, paddingRight: 28 }}
            />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF" }}>€</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          style={{ padding: "12px 28px", borderRadius: 8, border: "none", background: "#0A0E27", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPending || !name.trim() ? "not-allowed" : "pointer", opacity: isPending || !name.trim() ? 0.6 : 1 }}
        >
          {isPending ? "Création…" : "Créer le produit →"}
        </button>
        <Link href="/admin/products" style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Annuler
        </Link>
      </div>
    </main>
  );
}
