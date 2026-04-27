"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { migrateProductsToVariants } from "@/lib/product-catalog-actions";

export default function MigratePage() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ migrated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleMigrate() {
    if (!confirm("Migrer tous les produits existants vers le nouveau système de variantes ? Cette opération est sans danger (elle ne modifie pas les données existantes, elle crée seulement les variantes manquantes).")) return;
    setError(null);
    startTransition(async () => {
      const res = await migrateProductsToVariants();
      if (res.ok) setResult(res.data);
      else setError(res.error);
    });
  }

  return (
    <main style={{ padding: "32px 40px", maxWidth: 560 }}>
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/products" style={{ color: "#6B7280", textDecoration: "underline" }}>Produits</Link>
        {" / "}
        <span>Migration vers variantes</span>
      </div>

      <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: "0 0 16px" }}>
        Migration des produits
      </h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.6 }}>
        Cette opération crée une variante de base pour chaque produit existant qui n&apos;en a pas encore,
        en reprenant les données actuelles (matière, prix, dimensions, finitions, tarifs dégressifs).
        Les produits déjà migrés sont ignorés.
      </p>

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 20 }}>
          Erreur : {error}
        </div>
      )}

      {result ? (
        <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#065F46", marginBottom: 8 }}>Migration terminée !</div>
          <div style={{ fontSize: 14, color: "#047857" }}>
            <strong>{result.migrated}</strong> produit{result.migrated > 1 ? "s" : ""} migrés
            {result.skipped > 0 && `, ${result.skipped} ignorés (déjà migrés)`}
          </div>
          <Link
            href="/admin/products"
            style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", borderRadius: 8, background: "#065F46", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            Voir les produits →
          </Link>
        </div>
      ) : (
        <button
          onClick={handleMigrate}
          disabled={isPending}
          style={{
            padding: "14px 28px",
            borderRadius: 8,
            border: "none",
            background: isPending ? "#9CA3AF" : "#0A0E27",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Migration en cours…" : "Lancer la migration"}
        </button>
      )}
    </main>
  );
}
