"use client";

import Link from "next/link";
import { StickerPreview, type StickerColor, type StickerMaterial, type StickerShape } from "../sticker-preview";
import { ArrowIcon } from "../icons";

const CATEGORIES: Array<{
  name: string;
  shape: StickerShape;
  color: StickerColor;
  label: string;
  from: string;
  rot: number;
  material: StickerMaterial;
}> = [
  { name: "Die Cut", shape: "die-cut", color: "white", label: "MS", from: "12", rot: -8, material: "vinyl" },
  { name: "Ronds", shape: "circle", color: "blue", label: "ROND", from: "10", rot: 4, material: "vinyl" },
  { name: "Carrés", shape: "square", color: "red", label: '2"×2"', from: "10", rot: -4, material: "vinyl" },
  { name: "Holographiques", shape: "die-cut", color: "white", label: "HOLO", from: "22", rot: 6, material: "holographic" },
  { name: "Pailletés", shape: "circle", color: "red", label: "✦", from: "18", rot: -6, material: "glitter" },
  { name: "Transparents", shape: "die-cut", color: "blue", label: "CLR", from: "14", rot: 3, material: "vinyl" },
  { name: "Étiquettes", shape: "square", color: "white", label: "ROLL", from: "24", rot: -2, material: "vinyl" },
  { name: "Magnets", shape: "circle", color: "yellow", label: "MAG", from: "26", rot: 5, material: "vinyl" },
];

export function CategoriesSection() {
  return (
    <section style={{ padding: "80px 0 40px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "var(--red)",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              ◆ 01 / CATALOGUE
            </div>
            <h2
              style={{
                fontSize: 48,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                fontWeight: 800,
              }}
            >
              Parcourez par catégorie
            </h2>
          </div>
          <Link
            href="/custom-stickers"
            style={{
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--blue)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Tout voir <ArrowIcon size={14} />
          </Link>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
        >
          {CATEGORIES.map((c, i) => (
            <Link
              key={c.name}
              href="/custom-stickers"
              style={{
                display: "block",
                background:
                  i === 0 ? "var(--red)" : i === 3 ? "var(--blue)" : "var(--white)",
                color: i === 0 || i === 3 ? "var(--white)" : "var(--ink)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                padding: 24,
                textAlign: "center",
                textDecoration: "none",
                cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translate(-3px, -3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 0 var(--ink)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "";
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <div
                style={{
                  height: 140,
                  display: "grid",
                  placeItems: "center",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 110,
                    height: 110,
                    transform: `rotate(${c.rot}deg)`,
                  }}
                >
                  <StickerPreview
                    shape={c.shape}
                    color={c.color}
                    label={c.label}
                    material={c.material}
                  />
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, letterSpacing: "0.05em" }}>
                dès {c.from}€
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
