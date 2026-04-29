"use client";

import { useState } from "react";
import Link from "next/link";
import type { PageSection } from "@/lib/page-sections";

// ── Contact form (embedded) ───────────────────────────────────────────────────

function ContactFormEmbed({ title, subtitle }: { title: string; subtitle: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setState(res.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <section id="contact" style={{ background: "#F8F9FB", borderTop: "2px solid #ECEEF2", padding: "64px 32px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: 28, color: "#0A0E27", margin: "0 0 8px" }}>{title}</h2>
        {subtitle && <p style={{ fontFamily: "var(--font-archivo)", fontSize: 15, color: "#4B5563", margin: "0 0 32px" }}>{subtitle}</p>}

        {state === "ok" ? (
          <div style={{ padding: "20px 24px", background: "#ECFDF5", border: "2px solid #10B981", borderRadius: 10, fontFamily: "var(--font-archivo)", fontWeight: 700, color: "#065F46" }}>
            ✓ Message envoyé ! Nous vous répondrons sous 24h.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Prénom / Nom *</label>
                <input style={inputStyle} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jean Dupont" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@entreprise.fr" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+33 6 00 00 00 00" />
            </div>
            <div>
              <label style={labelStyle}>Votre message *</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Décrivez votre projet, les quantités souhaitées, vos délais..."
              />
            </div>
            {state === "error" && (
              <div style={{ padding: "12px 16px", background: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 8, fontFamily: "var(--font-archivo)", fontSize: 13, color: "#991B1B" }}>
                Une erreur est survenue. Veuillez réessayer.
              </div>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              style={{ background: "#0A0E27", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 8, fontFamily: "var(--font-archivo)", fontWeight: 700, fontSize: 14, cursor: "pointer", alignSelf: "flex-start" }}
            >
              {state === "sending" ? "Envoi en cours…" : "Envoyer ma demande →"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-archivo)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#9BA3AF",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-archivo)",
  fontSize: 14,
  border: "1.5px solid #ECEEF2",
  borderRadius: 8,
  padding: "10px 12px",
  width: "100%",
  boxSizing: "border-box",
  color: "#0A0E27",
  outline: "none",
};

// ── FAQ accordion ─────────────────────────────────────────────────────────────

function FaqAccordion({ items }: { items: { id: string; question: string; answer: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} style={{ border: "1.5px solid #ECEEF2", borderRadius: 10, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === item.id ? null : item.id)}
            style={{
              width: "100%",
              background: open === item.id ? "#F8F9FB" : "#fff",
              border: "none",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              fontFamily: "var(--font-archivo)",
              fontWeight: 700,
              fontSize: 15,
              color: "#0A0E27",
              textAlign: "left",
            }}
          >
            <span>{item.question}</span>
            <span style={{ fontSize: 18, color: "#9BA3AF", flexShrink: 0 }}>{open === item.id ? "−" : "+"}</span>
          </button>
          {open === item.id && (
            <div style={{ padding: "0 20px 16px", fontFamily: "var(--font-archivo)", fontSize: 14, color: "#4B5563", lineHeight: 1.7 }}>
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderSection(section: PageSection) {
  switch (section.type) {
    case "hero": {
      const bgMap = { ink: "#0A0E27", white: "#FFFFFF", red: "#E8391E" };
      const fgMap = { ink: "#FFFFFF", white: "#0A0E27", red: "#FFFFFF" };
      const bg = bgMap[section.bgColor];
      const fg = fgMap[section.bgColor];
      return (
        <section key={section.id} style={{ background: bg, padding: "80px 32px", textAlign: "center" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: "clamp(28px, 5vw, 52px)", color: fg, margin: "0 0 20px", lineHeight: 1.1 }}>
              {section.title}
            </h1>
            {section.subtitle && (
              <p style={{ fontFamily: "var(--font-archivo)", fontSize: "clamp(14px, 2vw, 18px)", color: fg, opacity: 0.8, margin: "0 0 36px", lineHeight: 1.6 }}>
                {section.subtitle}
              </p>
            )}
            {section.ctaLabel && section.ctaHref && (
              <Link
                href={section.ctaHref}
                style={{
                  display: "inline-block",
                  background: section.bgColor === "white" ? "#0A0E27" : "#FFFFFF",
                  color: section.bgColor === "white" ? "#FFFFFF" : "#0A0E27",
                  padding: "14px 32px",
                  borderRadius: 8,
                  fontFamily: "var(--font-archivo)",
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                  border: "2px solid transparent",
                }}
              >
                {section.ctaLabel} →
              </Link>
            )}
          </div>
        </section>
      );
    }

    case "richtext":
      return (
        <section key={section.id} style={{ padding: "64px 32px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: section.align }}>
            {section.title && (
              <h2 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: 32, color: "#0A0E27", margin: "0 0 20px" }}>
                {section.title}
              </h2>
            )}
            <div
              style={{ fontFamily: "var(--font-archivo)", fontSize: 16, color: "#4B5563", lineHeight: 1.8, whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, "<br/>") }}
            />
          </div>
        </section>
      );

    case "faq":
      return (
        <section key={section.id} style={{ padding: "64px 32px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {section.title && (
              <h2 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: 32, color: "#0A0E27", margin: "0 0 32px" }}>
                {section.title}
              </h2>
            )}
            <FaqAccordion items={section.items} />
          </div>
        </section>
      );

    case "features": {
      const colMap: Record<number, string> = { 2: "1fr 1fr", 3: "1fr 1fr 1fr", 4: "1fr 1fr 1fr 1fr" };
      return (
        <section key={section.id} style={{ padding: "64px 32px", background: "#F8F9FB", borderTop: "2px solid #ECEEF2", borderBottom: "2px solid #ECEEF2" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {section.title && (
              <h2 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: 32, color: "#0A0E27", margin: "0 0 40px", textAlign: "center" }}>
                {section.title}
              </h2>
            )}
            <div style={{ display: "grid", gridTemplateColumns: colMap[section.columns] ?? colMap[3], gap: 24 }}>
              {section.items.map((item) => (
                <div key={item.id} style={{ background: "#fff", border: "1.5px solid #ECEEF2", borderRadius: 12, padding: "24px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                  <div style={{ fontFamily: "var(--font-archivo)", fontWeight: 700, fontSize: 16, color: "#0A0E27", marginBottom: 8 }}>{item.title}</div>
                  <div style={{ fontFamily: "var(--font-archivo)", fontSize: 14, color: "#4B5563", lineHeight: 1.6 }}>{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "cta_banner": {
      const variantMap = {
        dark:  { bg: "#0A0E27", fg: "#fff",    btnBg: "#E8391E", btnFg: "#fff" },
        light: { bg: "#F8F9FB", fg: "#0A0E27", btnBg: "#0A0E27", btnFg: "#fff" },
        red:   { bg: "#E8391E", fg: "#fff",    btnBg: "#0A0E27", btnFg: "#fff" },
      };
      const v = variantMap[section.variant];
      return (
        <section key={section.id} style={{ background: v.bg, padding: "64px 32px", textAlign: "center" }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-archivo)", fontWeight: 900, fontSize: 32, color: v.fg, margin: "0 0 12px" }}>{section.title}</h2>
            {section.subtitle && <p style={{ fontFamily: "var(--font-archivo)", fontSize: 16, color: v.fg, opacity: 0.8, margin: "0 0 28px" }}>{section.subtitle}</p>}
            {section.buttonLabel && (
              <Link
                href={section.buttonHref}
                style={{ display: "inline-block", background: v.btnBg, color: v.btnFg, padding: "14px 32px", borderRadius: 8, fontFamily: "var(--font-archivo)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
              >
                {section.buttonLabel} →
              </Link>
            )}
          </div>
        </section>
      );
    }

    case "contact_form":
      return <ContactFormEmbed key={section.id} title={section.title} subtitle={section.subtitle} />;

    case "separator": {
      const spMap = { sm: 32, md: 64, lg: 96 };
      return <div key={section.id} style={{ height: spMap[section.spacing] }} />;
    }

    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function PageRenderer({ sections }: { sections: PageSection[] }) {
  return (
    <div>
      {sections.map((s) => renderSection(s))}
    </div>
  );
}
