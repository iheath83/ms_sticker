"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "../cart-context";
import { StickerPreview } from "../sticker-preview";
import { CheckIcon } from "../icons";

interface Props {
  orderNum: string;
  totalCents: number;
}

export function ConfirmationClient({ orderNum, totalCents }: Props) {
  const { refreshCart } = useCart();
  const total = totalCents / 100;

  // Refresh cart (now cleared server-side) on mount
  useEffect(() => {
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TIMELINE = [
    { label: "Paiement reçu", sub: "Confirmé par Stripe", done: true, active: true },
    { label: "Bon à tirer (BAT)", sub: "Préparé sous 24h · par email", done: false, active: true },
    { label: "Votre validation", sub: "Approbation du BAT", done: false, active: false },
    { label: "Production", sub: "24-48h ouvrées", done: false, active: false },
    { label: "Expédition & livraison", sub: "Colissimo · 2-3 jours", done: false, active: false },
  ];

  return (
    <main style={{ background: "var(--cream)", padding: "60px 0 80px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px" }}>
        {/* Confetti sticker band */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          {(["red", "blue", "white", "red", "blue"] as const).map((c, i) => (
            <div
              key={i}
              style={{
                width: 48,
                height: 48,
                transform: `rotate(${(i - 2) * 15}deg) translateY(${Math.abs(i - 2) * 8}px)`,
              }}
            >
              <StickerPreview
                shape={i % 2 ? "circle" : "die-cut"}
                color={c}
                label={i === 2 ? "✓" : "MS"}
                material={i === 0 ? "holographic" : "vinyl"}
              />
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--red)",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            ◆ COMMANDE CONFIRMÉE
          </div>
          <h1
            style={{
              fontSize: 64,
              letterSpacing: "-0.03em",
              marginBottom: 16,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 900,
            }}
          >
            Merci !
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "var(--grey-600)",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            Votre paiement pour la commande <b style={{ color: "var(--ink)" }}>{orderNum || "—"}</b> a été reçu.
            Notre équipe prépare votre bon à tirer (BAT) sous 24h. Vous recevrez un email pour le valider.
          </p>
        </div>

        {/* Receipt */}
        <div
          style={{
            background: "var(--white)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--r-lg)",
            padding: 32,
            boxShadow: "6px 6px 0 0 var(--red)",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: "2px dashed var(--grey-200)",
            }}
          >
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--grey-400)" }}>
                REÇU DE COMMANDE
              </div>
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  marginTop: 4,
                }}
              >
                {orderNum}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "var(--grey-600)" }}>
              <div>
                {new Date().toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div style={{ marginTop: 4 }}>MS Adhésif · Lyon · FR</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "var(--grey-600)", paddingBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            Articles confirmés — le récapitulatif complet vous a été envoyé par email.
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 16,
              borderTop: "2px solid var(--ink)",
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total payé</span>
            <span
              style={{
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {total.toFixed(2)} €
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "var(--white)",
            border: "1.5px solid var(--grey-200)",
            borderRadius: "var(--r-lg)",
            padding: 32,
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontSize: 22,
              marginBottom: 24,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
            }}
          >
            Suivi de votre commande
          </h3>
          <div>
            {TIMELINE.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16, paddingBottom: i === TIMELINE.length - 1 ? 0 : 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: s.done ? "var(--red)" : s.active ? "var(--white)" : "var(--grey-100)",
                      border: `2px solid ${s.active ? "var(--red)" : "var(--grey-200)"}`,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {s.done && <CheckIcon size={14} />}
                    {s.active && !s.done && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--red)",
                        }}
                      />
                    )}
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        width: 2,
                        background: s.done ? "var(--red)" : "var(--grey-200)",
                        minHeight: 24,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: s.active || s.done ? "var(--ink)" : "var(--grey-400)",
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--grey-600)", marginTop: 2 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <Link
            href="/"
            onClick={() => refreshCart()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "14px 24px",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r)",
              background: "var(--white)",
              fontFamily: "var(--font-mono), monospace",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/custom-stickers"
            onClick={() => refreshCart()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "14px 24px",
              background: "var(--red)",
              color: "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r)",
              fontFamily: "var(--font-mono), monospace",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Commander d&apos;autres stickers
          </Link>
        </div>
      </div>
    </main>
  );
}
