"use client";

import { useRef, useState } from "react";

interface Props {
  label?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  entityId?: string;
  hint?: string;
  /** If true, shows a small thumbnail; if false shows a larger preview */
  compact?: boolean;
}

export function AdminImageUpload({
  label,
  value,
  onChange,
  folder = "products",
  entityId = "general",
  hint,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      fd.append("entityId", entityId);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erreur d'upload");
      onChange(json.url!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
          {hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, color: "#9CA3AF" }}>{hint}</span>}
        </label>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Aperçu"
            style={{
              width: compact ? 56 : 96,
              height: compact ? 56 : 96,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              flexShrink: 0,
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px dashed #D1D5DB",
              background: uploading ? "#F9FAFB" : "#fff",
              color: "#374151",
              fontSize: 12,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {uploading ? (
              <>
                <span style={{ fontSize: 14 }}>⏳</span>
                Envoi en cours…
              </>
            ) : (
              <>
                <span style={{ fontSize: 14 }}>📁</span>
                {value ? "Remplacer l'image" : "Choisir une image"}
              </>
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #FCA5A5",
                background: "#FEF2F2",
                color: "#991B1B",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Supprimer
            </button>
          )}
          {error && (
            <div style={{ fontSize: 11, color: "#DC2626" }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Gallery uploader (multiple images) ──────────────────────────────────────

interface GalleryProps {
  label?: string;
  values: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  entityId?: string;
  maxImages?: number;
}

export function AdminGalleryUpload({
  label,
  values,
  onChange,
  folder = "products",
  entityId = "general",
  maxImages = 10,
}: GalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        fd.append("entityId", entityId);
        const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
        const json = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Erreur d'upload");
        newUrls.push(json.url!);
      }
      onChange([...values, ...newUrls].slice(0, maxImages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        {values.map((url, idx) => (
          <div key={idx} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Image ${idx + 1}`}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "none",
                background: "#DC2626",
                color: "#fff",
                fontSize: 10,
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {values.length < maxImages && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                border: "2px dashed #D1D5DB",
                background: "#F9FAFB",
                color: "#9CA3AF",
                fontSize: 22,
                cursor: uploading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title="Ajouter des images"
            >
              {uploading ? "⏳" : "+"}
            </button>
          </>
        )}
      </div>

      {error && <div style={{ fontSize: 11, color: "#DC2626" }}>{error}</div>}
      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
        {values.length}/{maxImages} images · PNG, JPG, WebP, GIF, SVG · max 10 Mo chacune
      </div>
    </div>
  );
}
