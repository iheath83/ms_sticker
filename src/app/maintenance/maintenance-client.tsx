"use client";

import { useState } from "react";

interface Props {
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEmail: string;
  maintenancePhone: string;
}

export function MaintenanceClient({
  maintenanceTitle,
  maintenanceMessage,
  maintenanceEmail,
  maintenancePhone,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setName(""); setEmail(""); setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--blue-deep, #081F4D)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 20px",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: "#0B3D91",
                border: "2px solid #fff",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 14,
                color: "#fff",
              }}
            >
              MS
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
              MS Adhésif<span style={{ color: "#DC2626" }}> ◆</span>
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 52px)",
              fontWeight: 900,
              color: "#fff",
              margin: "0 0 16px",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {maintenanceTitle}
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6 }}>
            {maintenanceMessage}
          </p>
        </div>

        {/* Contact info */}
        {(maintenanceEmail || maintenancePhone) && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 40,
            }}
          >
            {maintenanceEmail && (
              <a
                href={`mailto:${maintenanceEmail}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 999,
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                ✉️ {maintenanceEmail}
              </a>
            )}
            {maintenancePhone && (
              <a
                href={`tel:${maintenancePhone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 999,
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                📞 {maintenancePhone}
              </a>
            )}
          </div>
        )}

        {/* Contact form */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "32px",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              margin: "0 0 24px",
            }}
          >
            Nous contacter
          </h2>

          {status === "sent" ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Message envoyé !</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Nous vous répondrons très vite.</div>
              <button
                onClick={() => setStatus("idle")}
                style={{
                  marginTop: 20,
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nom</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean@exemple.fr"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Message</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Votre message…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {status === "error" && (
                <div style={{ color: "#FCA5A5", fontSize: 13 }}>
                  Une erreur est survenue. Réessayez ou écrivez-nous directement par email.
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                style={{
                  padding: "14px 28px",
                  background: "#DC2626",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: status === "sending" ? "not-allowed" : "pointer",
                  opacity: status === "sending" ? 0.7 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {status === "sending" ? "Envoi…" : "Envoyer →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
