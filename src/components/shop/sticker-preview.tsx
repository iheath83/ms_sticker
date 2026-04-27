"use client";

export type StickerShape = "die-cut" | "circle" | "square" | "rectangle";
export type StickerColor = "red" | "blue" | "white" | "yellow";
export type StickerMaterial = "vinyl" | "holographic" | "glitter" | "transparent" | "kraft";

interface StickerPreviewProps {
  shape?: StickerShape;
  color?: StickerColor;
  material?: StickerMaterial;
  label?: string;
  small?: boolean;
}

function colorHex(color: StickerColor): string {
  switch (color) {
    case "red":
      return "#DC2626";
    case "blue":
      return "#0B3D91";
    case "yellow":
      return "#FFD60A";
    case "white":
      return "#0A0E27";
  }
}

export function StickerPreview({
  shape = "die-cut",
  color = "red",
  material = "vinyl",
  label = "MS",
  small = false,
}: StickerPreviewProps) {
  const dim = small ? 50 : 220;
  const fill = colorHex(color);
  const isHolo = material === "holographic";
  const isGlitter = material === "glitter";
  const isKraft = material === "kraft";
  const kraftFill = "#c8a96e";
  const holoId = `holo-${shape}-${color}-${dim}`;
  const strokeW = small ? 2 : 6;

  function buildShape(fillColor: string) {
    if (shape === "circle") {
      return (
        <circle cx={dim / 2} cy={dim / 2} r={dim * 0.42} fill={fillColor} stroke="#fff" strokeWidth={strokeW} />
      );
    }
    if (shape === "square") {
      return (
        <rect
          x={dim * 0.12}
          y={dim * 0.12}
          width={dim * 0.76}
          height={dim * 0.76}
          rx={dim * 0.04}
          fill={fillColor}
          stroke="#fff"
          strokeWidth={strokeW}
        />
      );
    }
    if (shape === "rectangle") {
      return (
        <rect
          x={dim * 0.08}
          y={dim * 0.22}
          width={dim * 0.84}
          height={dim * 0.56}
          rx={dim * 0.04}
          fill={fillColor}
          stroke="#fff"
          strokeWidth={strokeW}
        />
      );
    }
    // die-cut — organic blob
    return (
      <path
        d={`M ${dim * 0.2} ${dim * 0.18} Q ${dim * 0.5} ${dim * 0.08} ${dim * 0.82} ${dim * 0.2} Q ${dim * 0.94} ${dim * 0.5} ${dim * 0.84} ${dim * 0.82} Q ${dim * 0.5} ${dim * 0.94} ${dim * 0.18} ${dim * 0.84} Q ${dim * 0.06} ${dim * 0.5} ${dim * 0.2} ${dim * 0.18} Z`}
        fill={fillColor}
        stroke="#fff"
        strokeWidth={strokeW}
      />
    );
  }

  return (
    <svg
      width={small ? 50 : "100%"}
      height={small ? 50 : "100%"}
      viewBox={`0 0 ${dim} ${dim}`}
      style={{
        filter: small
          ? "drop-shadow(1px 1px 0 rgba(0,0,0,0.1))"
          : "drop-shadow(4px 4px 0 rgba(0,0,0,0.15))",
        maxWidth: small ? 50 : dim,
      }}
    >
      {isHolo && (
        <defs>
          <linearGradient id={holoId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9ee5" />
            <stop offset="0.25" stopColor="#a6f0ff" />
            <stop offset="0.5" stopColor="#ffea93" />
            <stop offset="0.75" stopColor="#b3a1ff" />
            <stop offset="1" stopColor="#ff9ee5" />
          </linearGradient>
        </defs>
      )}

      {buildShape(isHolo ? `url(#${holoId})` : isKraft ? kraftFill : fill)}

      {/* Label */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-archivo), Archivo, sans-serif"
        fontWeight="900"
        fontSize={small ? dim * 0.35 : dim * 0.3}
        fill={isHolo ? "#0A0E27" : "#fff"}
        style={{ letterSpacing: "-0.04em" }}
      >
        {label}
      </text>

      {!small && (
        <text
          x="50%"
          y={dim * 0.72}
          textAnchor="middle"
          fontFamily="var(--font-mono), JetBrains Mono, monospace"
          fontWeight="700"
          fontSize={dim * 0.07}
          fill={isHolo ? "#0A0E27" : "#fff"}
          style={{ letterSpacing: "0.15em" }}
        >
          ADHÉSIF · CO
        </text>
      )}

      {/* Glitter flecks */}
      {isGlitter &&
        !small &&
        Array.from({ length: 20 }, (_, i) => (
          <circle
            key={i}
            cx={(((i * 137.5) % 100) / 100) * dim}
            cy={(((i * 97.3) % 100) / 100) * dim}
            r={1 + (i % 3)}
            fill="#fff"
            opacity={0.8}
          />
        ))}
    </svg>
  );
}
