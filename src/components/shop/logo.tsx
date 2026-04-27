interface LogoProps {
  size?: number;
  inverted?: boolean;
}

export function Logo({ size = 36, inverted = false }: LogoProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-archivo), system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: "var(--blue)",
          color: "var(--white)",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-archivo), system-ui, sans-serif",
          fontWeight: 900,
          fontSize: size * 0.45,
          letterSpacing: "-0.04em",
          borderRadius: "var(--r-sm)",
          position: "relative",
          transform: "rotate(-4deg)",
          flexShrink: 0,
        }}
      >
        MS
        <span
          style={{
            position: "absolute",
            inset: -3,
            border: "2px solid var(--red)",
            borderRadius: 8,
            transform: "rotate(4deg)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.9 }}>
        <span
          style={{
            fontSize: 16,
            color: inverted ? "var(--white)" : "var(--ink)",
          }}
        >
          ADHÉSIF
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--red)",
            letterSpacing: "0.2em",
            marginTop: 2,
          }}
        >
          ◆ CO. · FR
        </span>
      </div>
    </div>
  );
}
