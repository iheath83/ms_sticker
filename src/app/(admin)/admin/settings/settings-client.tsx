"use client";

import { useState, useTransition } from "react";
import { updateSiteSettings } from "@/lib/settings-actions";
import { AdminImageUpload } from "@/components/admin/admin-image-upload";
import type { SiteSettings } from "@/db/schema";

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  fontSize: 13,
  color: "#0A0E27",
  background: "#fff",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 20,
};

export function SettingsClient({ settings }: { settings: SiteSettings }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl ?? null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(settings.maintenanceEnabled);
  const [title,        setTitle]        = useState(settings.maintenanceTitle);
  const [message,      setMessage]      = useState(settings.maintenanceMessage);
  const [email,        setEmail]        = useState(settings.maintenanceEmail);
  const [phone,        setPhone]        = useState(settings.maintenancePhone);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [stdShipping,  setStdShipping]  = useState(String((settings.standardShippingCents ?? 490) / 100));
  const [exprShipping, setExprShipping] = useState(String((settings.expressShippingCents ?? 990) / 100));
  const [freeThreshold, setFreeThreshold] = useState(String((settings.freeShippingThresholdCents ?? 5000) / 100));
  const [qtyStep, setQtyStep] = useState(String(settings.quantityStep ?? 25));
  const [enableProductionDownload, setEnableProductionDownload] = useState(
    settings.enableProductionDownload ?? false,
  );

  function handleSave() {
    startTransition(async () => {
      await updateSiteSettings({
        logoUrl,
        maintenanceEnabled,
        maintenanceTitle:   title,
        maintenanceMessage: message,
        maintenanceEmail:   email,
        maintenancePhone:   phone,
        contactEmail,
        standardShippingCents:      Math.round(parseFloat(stdShipping) * 100) || 490,
        expressShippingCents:       Math.round(parseFloat(exprShipping) * 100) || 990,
        freeShippingThresholdCents: Math.round(parseFloat(freeThreshold) * 100) || 5000,
        quantityStep:               parseInt(qtyStep, 10) || 25,
        enableProductionDownload,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: "0 0 6px" }}>
          Paramètres du site
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          Gérez le mode maintenance et les informations de contact.
        </p>
      </div>

      {/* Logo */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>
          Logo du site
        </h2>
        <AdminImageUpload
          label="Image du logo"
          hint="PNG ou SVG transparent recommandé"
          value={logoUrl}
          onChange={setLogoUrl}
          folder="logo"
          entityId="site"
        />
        {logoUrl && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#F0F4FF", borderRadius: 8, fontSize: 12, color: "#374151" }}>
            Aperçu : <img src={logoUrl} alt="Logo" style={{ height: 40, verticalAlign: "middle", marginLeft: 8 }} />
          </div>
        )}
      </div>

      {/* Maintenance toggle */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: maintenanceEnabled ? 24 : 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0A0E27", marginBottom: 4 }}>
              Mode maintenance
            </div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              Affiche la page "Coming Soon" aux visiteurs. Vous conservez l&apos;accès au site.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMaintenanceEnabled((v) => !v)}
            style={{
              width: 52,
              height: 28,
              borderRadius: 999,
              border: "none",
              background: maintenanceEnabled ? "#DC2626" : "#D1D5DB",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 4,
                left: maintenanceEnabled ? 28 : 4,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>

        {maintenanceEnabled && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#991B1B",
              fontWeight: 600,
            }}
          >
            ⚠️ Le mode maintenance est <strong>actif</strong> — les visiteurs voient la page Coming Soon.
          </div>
        )}
      </div>

      {/* Page content */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>
          Contenu de la page
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Bientôt disponible" />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Notre site est en cours de mise à jour…"
            />
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>
          Coordonnées de contact
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="hello@msadhesif.fr" />
          </div>
          <div>
            <label style={labelStyle}>Téléphone (optionnel)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+33 6 00 00 00 00" />
          </div>
        </div>
      </div>

      {/* Contact form email */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 8px" }}>
          Formulaire de contact
        </h2>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px" }}>
          Adresse email qui reçoit les messages envoyés depuis le formulaire de contact du site.
        </p>
        <div>
          <label style={labelStyle}>Email de réception</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={inputStyle}
            placeholder="hello@msadhesif.fr"
          />
        </div>
      </div>

      {/* Livraison */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 8px" }}>
          Livraison
        </h2>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px" }}>
          Tarifs de livraison et seuil de gratuité (en €).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Livraison standard (€)</label>
            <input type="number" step="0.01" min="0" value={stdShipping} onChange={(e) => setStdShipping(e.target.value)} style={inputStyle} placeholder="4.90" />
          </div>
          <div>
            <label style={labelStyle}>Livraison express (€)</label>
            <input type="number" step="0.01" min="0" value={exprShipping} onChange={(e) => setExprShipping(e.target.value)} style={inputStyle} placeholder="9.90" />
          </div>
          <div>
            <label style={labelStyle}>Seuil livraison gratuite (€)</label>
            <input type="number" step="1" min="0" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} style={inputStyle} placeholder="50" />
          </div>
          <div>
            <label style={labelStyle}>Pas de quantité (ex : 25)</label>
            <input type="number" step="1" min="1" value={qtyStep} onChange={(e) => setQtyStep(e.target.value)} style={inputStyle} placeholder="25" />
          </div>
        </div>
      </div>

      {/* Production download (debug / QA) */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enableProductionDownload ? 16 : 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0A0E27", marginBottom: 4 }}>
              Téléchargement du fichier de production (QA)
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", maxWidth: 480 }}>
              Ajoute un bouton « Télécharger le PDF de production » dans l&apos;éditeur visuel.
              Le PDF est généré en 300 dpi, sans fond, avec un cut contour spot magenta CMJN
              (épaisseur 0,2 mm) à la taille exacte choisie. À activer pour tester les
              sorties d&apos;impression sans passer commande.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnableProductionDownload((v) => !v)}
            aria-label="Activer le téléchargement du fichier de production"
            style={{
              width: 52,
              height: 28,
              borderRadius: 999,
              border: "none",
              background: enableProductionDownload ? "#0B3D91" : "#D1D5DB",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 4,
                left: enableProductionDownload ? 28 : 4,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
        {enableProductionDownload && (
          <div
            style={{
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#1D4ED8",
              fontWeight: 600,
            }}
          >
            ℹ️ Le bouton de téléchargement est <strong>actif</strong> dans l&apos;éditeur pour tous les visiteurs.
            Pensez à le désactiver une fois les tests terminés.
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: "12px 28px",
            background: "#0B3D91",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
            ✓ Enregistré
          </span>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};
