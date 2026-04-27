"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "ms_cookie_consent";

type Consent = { essential: true; analytics: boolean; decidedAt: string } | null;

function getStoredConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

function storeConsent(analytics: boolean) {
  const consent: Consent = {
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  // Set a short-lived cookie so server-side code can read consent if needed
  document.cookie = `${CONSENT_KEY}=${analytics ? "all" : "essential"}; max-age=31536000; path=/; SameSite=Lax`;
  return consent;
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) setShow(true);

    // Allow the politique-cookies page to open the banner
    function handleOpen() {
      setShow(true);
      setShowDetails(true);
    }
    document.getElementById("open-cookie-settings")?.addEventListener("click", handleOpen);
    return () => {
      document.getElementById("open-cookie-settings")?.removeEventListener("click", handleOpen);
    };
  }, []);

  if (!show) return null;

  function acceptAll() {
    storeConsent(true);
    setShow(false);
  }

  function acceptEssential() {
    storeConsent(false);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(680px, calc(100vw - 32px))",
        background: "#0A0E27",
        color: "#F9FAFB",
        borderRadius: 12,
        padding: "20px 24px",
        zIndex: 9999,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🍪</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
            <strong>Ce site utilise des cookies.</strong> Les cookies essentiels sont nécessaires
            au fonctionnement du site. Les cookies analytics (opt-in) nous aident à améliorer
            votre expérience.{" "}
            <Link href="/politique-cookies" style={{ color: "#F87171" }}>
              En savoir plus
            </Link>
          </p>

          {showDetails && (
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "12px 16px",
                margin: "12px 0",
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <strong>Cookies essentiels</strong>
                  <div style={{ color: "#9CA3AF", fontSize: 12 }}>Session, panier — toujours actifs</div>
                </div>
                <span style={{
                  background: "#166534", color: "#DCFCE7",
                  padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700
                }}>
                  Toujours actifs
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Analytics</strong>
                  <div style={{ color: "#9CA3AF", fontSize: 12 }}>Google Analytics — mesure d&apos;audience</div>
                </div>
                <span style={{ color: "#9CA3AF", fontSize: 12 }}>Opt-in</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={acceptAll}
              style={{
                background: "#DC2626", color: "#fff", border: "none",
                padding: "9px 20px", borderRadius: 6, fontSize: 13,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Tout accepter
            </button>
            <button
              onClick={acceptEssential}
              style={{
                background: "transparent", color: "#F9FAFB",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "9px 20px", borderRadius: 6, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Essentiels uniquement
            </button>
            {!showDetails && (
              <button
                onClick={() => setShowDetails(true)}
                style={{
                  background: "transparent", color: "#9CA3AF",
                  border: "none", padding: "9px 0", fontSize: 12,
                  cursor: "pointer", textDecoration: "underline",
                }}
              >
                Personnaliser
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
