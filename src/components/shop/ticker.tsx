export function Ticker() {
  const items = [
    "Livraison gratuite dès 50€",
    "Épreuve numérique offerte",
    "Fabriqué en France",
    "Expédition en 48h",
    "Devis gratuit sous 1h",
    "Vinyle laminé pro · résiste à l'eau",
    "Livraison gratuite dès 50€",
    "Épreuve numérique offerte",
    "Fabriqué en France",
    "Expédition en 48h",
  ];

  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--white)",
        fontFamily: "var(--font-archivo), ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "8px 0",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      <div className="ticker-track">
        {items.map((item, i) => (
          <span key={i} style={{ margin: "0 32px" }}>
            <span style={{ color: "var(--red)", marginRight: 12 }}>◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
