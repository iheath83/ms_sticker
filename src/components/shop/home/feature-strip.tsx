import { TruckIcon, ShieldIcon, SparklesIcon, CheckIcon } from "../icons";

const FEATURES = [
  { Icon: TruckIcon, title: "Expédition 48h", sub: "Depuis notre atelier à Lyon" },
  { Icon: ShieldIcon, title: "Garantie qualité", sub: "Vinyle pro · laminé UV" },
  { Icon: SparklesIcon, title: "Épreuve gratuite", sub: "Validation avant impression" },
  { Icon: CheckIcon, title: "Dès 25 pièces", sub: "Pas de minimum caché" },
] as const;

export function FeatureStrip() {
  return (
    <section
      style={{
        background: "var(--ink)",
        color: "var(--white)",
        padding: "40px 0",
        borderTop: "2px solid var(--ink)",
        borderBottom: "2px solid var(--ink)",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 32px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 32,
        }}
      >
        {FEATURES.map(({ Icon, title, sub }) => (
          <div key={title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: "var(--red)",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={22} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 12, color: "var(--grey-400)", marginTop: 3 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
