"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOptionValue,
  updateOptionValue,
  deleteOptionValue,
} from "@/lib/product-catalog-actions";
import type { ProductOptionValue } from "@/db/schema";

type Tab = "shape" | "finish" | "material";

const TAB_CONFIG: Record<Tab, { label: string; addLabel: string; hint: string }> = {
  shape: { label: "Formes de découpe", addLabel: "Nouvelle forme", hint: "Ex : die-cut, kiss-cut, cercle…" },
  finish: { label: "Types de lamination", addLabel: "Nouvelle finition", hint: "Ex : brillant, mat, UV laminé…" },
  material: { label: "Matières", addLabel: "Nouvelle matière", hint: "Ex : vinyle, holographique, kraft…" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddOptionForm({
  type,
  hint,
  onAdded,
}: {
  type: Tab;
  hint: string;
  onAdded: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleLabelChange(v: string) {
    setLabel(v);
    if (!slug || slug === slugify(label)) setSlug(slugify(v));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await createOptionValue({
        type,
        slug: slug.trim(),
        label: label.trim(),
        description: description.trim() || null,
        active: true,
        sortOrder: 99,
      });
      if (res.ok) {
        setLabel(""); setSlug(""); setDescription("");
        setOpen(false);
        onAdded();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12,
          padding: "9px 18px",
          borderRadius: 8,
          border: "2px dashed #D1D5DB",
          background: "#F9FAFB",
          color: "#374151",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          width: "100%",
        }}
      >
        + Ajouter
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, padding: "16px 20px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10 }}>
      {error && <div style={{ background: "#FEE2E2", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#991B1B", marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
            Libellé
          </label>
          <input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder={hint}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
            Slug (URL)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
            placeholder="ex: die-cut"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
          Description (optionnel)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description courte…"
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!label.trim() || !slug.trim() || isPending}
          style={{
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: label && slug ? "#0A0E27" : "#E5E7EB",
            color: label && slug ? "#fff" : "#9CA3AF",
            fontSize: 13,
            fontWeight: 700,
            cursor: label && slug && !isPending ? "pointer" : "not-allowed",
          }}
        >
          {isPending ? "Ajout…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: 13, cursor: "pointer" }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Option row ───────────────────────────────────────────────────────────────

function OptionRow({
  option,
  onRefresh,
  isFirst,
  isLast,
}: {
  option: ProductOptionValue;
  onRefresh: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(option.sortOrder));

  function handleToggleActive() {
    startTransition(async () => {
      await updateOptionValue(option.id, { active: !option.active });
      onRefresh();
    });
  }

  function handleMove(direction: "up" | "down") {
    const newSort = direction === "up" ? option.sortOrder - 1 : option.sortOrder + 1;
    startTransition(async () => {
      await updateOptionValue(option.id, { sortOrder: newSort });
      onRefresh();
    });
  }

  function handleSave() {
    startTransition(async () => {
      await updateOptionValue(option.id, {
        label: label.trim(),
        description: description.trim() || null,
        sortOrder: parseInt(sortOrder) || 0,
      });
      setEditing(false);
      onRefresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer "${option.label}" ?`)) return;
    startTransition(async () => {
      await deleteOptionValue(option.id);
      onRefresh();
    });
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "28px 1fr auto auto auto",
      alignItems: "center",
      gap: 10,
      padding: "12px 16px",
      background: "#fff",
      borderBottom: "1px solid #F3F4F6",
      opacity: isPending ? 0.6 : 1,
    }}>
      {/* Sort buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button
          type="button"
          onClick={() => handleMove("up")}
          disabled={isFirst || isPending}
          style={{ padding: "1px 5px", fontSize: 10, border: "1px solid #E5E7EB", borderRadius: 3, background: "#F9FAFB", color: isFirst ? "#D1D5DB" : "#374151", cursor: isFirst ? "default" : "pointer" }}
        >▲</button>
        <button
          type="button"
          onClick={() => handleMove("down")}
          disabled={isLast || isPending}
          style={{ padding: "1px 5px", fontSize: 10, border: "1px solid #E5E7EB", borderRadius: 3, background: "#F9FAFB", color: isLast ? "#D1D5DB" : "#374151", cursor: isLast ? "default" : "pointer" }}
        >▼</button>
      </div>

      {/* Label / edit */}
      <div>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} placeholder="Libellé" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, fontSize: 11, color: "#6B7280" }} placeholder="Description (optionnel)" />
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ ...inputStyle, fontSize: 11, width: 80 }} />
          </div>
        ) : (
          <div>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0A0E27" }}>{option.label}</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{option.slug}</span>
            {option.description && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{option.description}</div>}
          </div>
        )}
      </div>

      {/* Active toggle */}
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={isPending}
        style={{
          padding: "4px 10px",
          borderRadius: 20,
          border: "none",
          background: option.active ? "#D1FAE5" : "#F3F4F6",
          color: option.active ? "#065F46" : "#9CA3AF",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {option.active ? "Actif" : "Inactif"}
      </button>

      {/* Edit / Save */}
      {editing ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#0A0E27", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {isPending ? "…" : "OK"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setLabel(option.label); setDescription(option.description ?? ""); }}
            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: 12, cursor: "pointer" }}
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Modifier
        </button>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 12, cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Options tab panel ────────────────────────────────────────────────────────

function OptionsPanel({
  type,
  options,
  onRefresh,
}: {
  type: Tab;
  options: ProductOptionValue[];
  onRefresh: () => void;
}) {
  const config = TAB_CONFIG[type];

  return (
    <div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        {options.length} option{options.length > 1 ? "s" : ""} configurée{options.length > 1 ? "s" : ""}
      </div>

      {options.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13, background: "#F9FAFB", borderRadius: 8, border: "1px dashed #E5E7EB" }}>
          Aucune option. Ajoutez-en une ci-dessous.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto auto auto", gap: 10, padding: "8px 16px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <span />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Libellé / Slug</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Statut</span>
            <span />
            <span />
          </div>
          {options.map((opt, i) => (
            <OptionRow
              key={opt.id}
              option={opt}
              onRefresh={onRefresh}
              isFirst={i === 0}
              isLast={i === options.length - 1}
            />
          ))}
        </div>
      )}

      <AddOptionForm type={type} hint={config.hint} onAdded={onRefresh} />
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function OptionsClient({
  shapes: initialShapes,
  finishes: initialFinishes,
  materials: initialMaterials,
}: {
  shapes: ProductOptionValue[];
  finishes: ProductOptionValue[];
  materials: ProductOptionValue[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("shape");

  const data: Record<Tab, ProductOptionValue[]> = {
    shape: initialShapes,
    finish: initialFinishes,
    material: initialMaterials,
  };

  function refresh() {
    router.refresh();
  }

  return (
    <main style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: "0 0 6px" }}>
          Options produit
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          Gérez les formes de découpe, types de lamination et matières disponibles pour vos déclinaisons.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #E5E7EB" }}>
        {(Object.entries(TAB_CONFIG) as [Tab, typeof TAB_CONFIG[Tab]][]).map(([id, conf]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === id ? "2px solid #0A0E27" : "2px solid transparent",
              marginBottom: -2,
              background: "none",
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === id ? "#0A0E27" : "#6B7280",
              cursor: "pointer",
            }}
          >
            {conf.label}
            <span style={{
              marginLeft: 8,
              padding: "1px 7px",
              borderRadius: 20,
              fontSize: 11,
              background: activeTab === id ? "#0A0E27" : "#F3F4F6",
              color: activeTab === id ? "#fff" : "#6B7280",
              fontWeight: 700,
            }}>
              {data[id].length}
            </span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div style={{ maxWidth: 700 }}>
        <OptionsPanel
          type={activeTab}
          options={data[activeTab]}
          onRefresh={refresh}
        />
      </div>
    </main>
  );
}
