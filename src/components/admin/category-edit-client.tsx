"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCategory, updateCategory } from "@/lib/category-actions";
import { AdminImageUpload } from "@/components/admin/admin-image-upload";

type CategoryData = {
  id: string;
  name: string;
  slug: string;
  description: string | null | undefined;
  imageUrl: string | null | undefined;
  parentId: string | null | undefined;
  sortOrder: number;
  active: boolean;
};

type Parent = { id: string; name: string };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

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
};

export function CategoryEditClient({
  category,
  parents,
}: {
  category: CategoryData | null;
  parents: Parent[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isNew = !category;

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(category?.imageUrl ?? null);
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [active, setActive] = useState(category?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (isNew) setSlug(slugify(v));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const input = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl || null,
        parentId: parentId || null,
        sortOrder: parseInt(sortOrder) || 0,
        active,
      };
      try {
        if (isNew) {
          await createCategory(input);
          router.push("/admin/categories");
        } else {
          await updateCategory(category.id, input);
          setSuccess(true);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
      }
    });
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 640 }}>
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/categories" style={{ color: "#6B7280", textDecoration: "underline" }}>Catégories</Link>
        {" / "}
        <span>{isNew ? "Nouvelle catégorie" : category.name}</span>
      </div>

      <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em", margin: "0 0 32px" }}>
        {isNew ? "Nouvelle catégorie" : `Éditer · ${category.name}`}
      </h1>

      {error && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 20 }}>{error}</div>}
      {success && <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", marginBottom: 20 }}>Catégorie mise à jour.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>Général</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nom</label>
              <input value={name} onChange={(e) => handleNameChange(e.target.value)} style={inputStyle} placeholder="Ex : Stickers vinyle" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Slug (URL)</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="stickers-vinyle" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Catégorie parente</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={inputStyle}>
                <option value="">— Aucune (catégorie racine) —</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Ordre d'affichage</label>
                <input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>Image</h2>
          <AdminImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            folder="categories"
            entityId={category?.id ?? "new"}
            hint="Recommandé : 800×600px minimum"
          />
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>Statut</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <div onClick={() => setActive(!active)} style={{ width: 44, height: 24, borderRadius: 12, background: active ? "#22C55E" : "#D1D5DB", position: "relative", cursor: "pointer", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: active ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: active ? "#065F46" : "#6B7280" }}>
              {active ? "Catégorie active (visible)" : "Catégorie désactivée"}
            </span>
          </label>
        </section>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={isPending || !name.trim() || !slug.trim()}
            style={{ padding: "12px 28px", borderRadius: 8, border: "none", background: "#0A0E27", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? "Sauvegarde…" : isNew ? "Créer la catégorie" : "Sauvegarder"}
          </button>
          <Link href="/admin/categories" style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            Annuler
          </Link>
        </div>
      </div>
    </main>
  );
}
