import Link from "next/link";
import { StickerPreview } from "../sticker-preview";
import { ArrowIcon } from "../icons";

const FLOATING_STICKERS = [
  { top: "8%", left: "3%", shape: "die-cut" as const, color: "red" as const, rot: -20, size: 100, label: "OK" },
  { top: "15%", right: "-2%", shape: "circle" as const, color: "white" as const, rot: 15, size: 80, label: "100%" },
  { bottom: "8%", left: "8%", shape: "square" as const, color: "yellow" as const, rot: 10, size: 70, label: "GO" },
  { top: "55%", left: "45%", shape: "die-cut" as const, color: "white" as const, rot: -8, size: 60, label: "★" },
];

export function HeroSection() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, var(--blue-deep) 0%, var(--blue) 100%)",
        color: "var(--white)",
        padding: "80px 0 120px",
        position: "relative",
        overflow: "hidden",
        borderBottom: "2px solid var(--ink)",
      }}
    >
      {/* Blueprint grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      {/* Floating stickers */}
      {FLOATING_STICKERS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "top" in s ? s.top : undefined,
            left: "left" in s ? s.left : undefined,
            right: "right" in s ? s.right : undefined,
            bottom: "bottom" in s ? s.bottom : undefined,
            width: s.size,
            height: s.size,
            transform: `rotate(${s.rot}deg)`,
            opacity: 0.18,
            filter: "drop-shadow(3px 3px 0 rgba(0,0,0,0.2))",
            pointerEvents: "none",
          }}
        >
          <StickerPreview shape={s.shape} color={s.color} label={s.label} />
        </div>
      ))}

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 32px",
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 60,
          alignItems: "center",
        }}
      >
        {/* Left: copy */}
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "var(--red)",
              border: "1.5px solid var(--white)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, background: "var(--white)", borderRadius: "50%" }} />
            Nouveau · Pailletés disponibles
          </div>

          <h1
            style={{
              fontSize: 88,
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
              marginBottom: 24,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 900,
            }}
          >
            Imprimez
            <br />
            vos <em style={{ color: "var(--red)", fontStyle: "italic" }}>stickers</em>
            <br />
            comme un
            <br />
            pro.
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.5,
              maxWidth: 480,
              color: "rgba(255,255,255,0.85)",
              marginBottom: 32,
            }}
          >
            Vinyle laminé résistant eau & UV. Commandez en ligne, épreuve numérique gratuite,
            livraison en 48h partout en France.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link
              href="/custom-stickers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "18px 28px",
                background: "var(--red)",
                color: "var(--white)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r)",
                fontFamily: "var(--font-archivo), monospace",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
            >
              Configurer mon sticker <ArrowIcon />
            </Link>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "18px 28px",
                background: "transparent",
                color: "var(--white)",
                border: "2px solid var(--white)",
                borderRadius: "var(--r)",
                fontFamily: "var(--font-archivo), monospace",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Voir le nuancier
            </button>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 48,
              marginTop: 56,
              paddingTop: 32,
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {[
              { value: "29 625", label: "Clients satisfaits" },
              { value: "4,9/5", label: "Note moyenne", red: true },
              { value: "48H", label: "Délai d'expédition" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  style={{
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontSize: 36,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                  }}
                >
                  {stat.value.includes("/") ? (
                    <>
                      {stat.value.split("/")[0]}
                      <span style={{ fontSize: 16, color: "var(--red)" }}>/{stat.value.split("/")[1]}</span>
                    </>
                  ) : (
                    stat.value
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: featured sticker */}
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            minHeight: 500,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "10%",
              background: "radial-gradient(circle, rgba(220,38,38,0.3) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            style={{
              width: 400,
              height: 400,
              transform: "rotate(-8deg)",
              filter: "drop-shadow(10px 14px 0 rgba(0,0,0,0.3))",
              position: "relative",
              zIndex: 2,
            }}
          >
            <StickerPreview shape="die-cut" color="red" label="MS" material="holographic" />
          </div>

          {/* Specs card */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 0,
              background: "var(--white)",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r)",
              padding: "14px 18px",
              width: 200,
              boxShadow: "6px 6px 0 0 var(--red)",
              zIndex: 3,
              transform: "rotate(3deg)",
            }}
          >
            <div
              style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--red)", fontWeight: 700 }}
            >
              ◆ FICHE TECHNIQUE
            </div>
            <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              {[
                { k: "Forme", v: "Die cut" },
                { k: "Taille", v: "7×7 cm" },
                { k: "Finition", v: "Holo" },
              ].map(({ k, v }) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
