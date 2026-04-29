"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signOut } from "@/lib/auth-client";
import { exportUserData, deleteUserAccount } from "@/lib/rgpd-actions";

interface Props {
  user: { name: string; email: string };
}

  type Section = "info" | "password" | "rgpd";

export default function ProfileClient({ user }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("info");

  // ── Info form ──
  const [name, setName] = useState(user.name);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Password form ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── RGPD ──
  const [rgpdLoading, setRgpdLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  async function handleExport() {
    setRgpdLoading(true);
    const res = await exportUserData();
    setRgpdLoading(false);
    if (!res.ok) { alert("Erreur : " + res.error); return; }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mes-donnees-msadhesif.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setRgpdLoading(true);
    const res = await deleteUserAccount();
    if (!res.ok) { setRgpdLoading(false); alert("Erreur : " + res.error); return; }
    await signOut();
    router.push("/");
  }

  async function handleSaveInfo() {
    if (!name.trim()) return;
    setSavingInfo(true);
    setInfoMsg(null);
    try {
      await authClient.updateUser({ name: name.trim() });
      setInfoMsg({ ok: true, text: "Informations mises à jour." });
      router.refresh();
    } catch {
      setInfoMsg({ ok: false, text: "Erreur lors de la mise à jour." });
    }
    setSavingInfo(false);
  }

  async function handleChangePwd() {
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ ok: false, text: "Tous les champs sont requis." });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ ok: false, text: "Le nouveau mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      const res = await authClient.changePassword({
        currentPassword: currentPwd,
        newPassword: newPwd,
        revokeOtherSessions: false,
      });
      if (res.error) {
        setPwdMsg({ ok: false, text: res.error.message ?? "Mot de passe actuel incorrect." });
      } else {
        setPwdMsg({ ok: true, text: "Mot de passe modifié avec succès." });
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      }
    } catch {
      setPwdMsg({ ok: false, text: "Erreur lors de la modification." });
    }
    setSavingPwd(false);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Title */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 6 }}>◆ MON ESPACE</div>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, fontFamily: "var(--font-archivo), system-ui, sans-serif" }}>Mon compte</h1>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--grey-200)", marginBottom: 28, gap: 0 }}>
        {([
          { key: "info" as Section, label: "Informations", icon: "👤" },
          { key: "password" as Section, label: "Mot de passe", icon: "🔒" },
          { key: "rgpd" as Section, label: "Mes données", icon: "🛡️" },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            style={{
              padding: "12px 20px", background: "transparent", border: "none",
              borderBottom: section === key ? "2px solid var(--red)" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "var(--font-archivo), monospace",
              color: section === key ? "var(--red)" : "var(--grey-600)",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* ── Section : informations ── */}
      {section === "info" && (
        <div style={{ background: "var(--white)", border: "1.5px solid var(--grey-200)", borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 24px", fontFamily: "var(--font-archivo), system-ui, sans-serif" }}>
            Informations personnelles
          </h2>

          {infoMsg && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: infoMsg.ok ? "#D1FAE5" : "#FEE2E2",
              border: `1px solid ${infoMsg.ok ? "#6EE7B7" : "#FCA5A5"}`,
              borderRadius: 8, fontSize: 13,
              color: infoMsg.ok ? "#065F46" : "#991B1B",
            }}>
              {infoMsg.ok ? "✅" : "⚠️"} {infoMsg.text}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Adresse email" value={user.email} readOnly />
            <Field
              label="Nom complet"
              value={name}
              onChange={setName}
              placeholder="Jean Dupont"
            />
          </div>

          <button
            onClick={() => void handleSaveInfo()}
            disabled={savingInfo || !name.trim() || name === user.name}
            style={{
              marginTop: 24,
              padding: "14px 28px",
              background: savingInfo || !name.trim() || name === user.name ? "var(--grey-200)" : "var(--red)",
              color: savingInfo || !name.trim() || name === user.name ? "var(--grey-500)" : "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: savingInfo || !name.trim() || name === user.name ? "not-allowed" : "pointer",
              fontFamily: "var(--font-archivo), monospace",
            }}
          >
            {savingInfo ? "Enregistrement…" : "Enregistrer"}
          </button>

          {/* Sign out */}
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px dashed var(--grey-200)" }}>
            <button
              onClick={() => void handleSignOut()}
              style={{
                padding: "10px 20px", background: "transparent",
                border: "1.5px solid var(--grey-200)", borderRadius: 8,
                fontSize: 13, fontWeight: 700, color: "var(--grey-600)",
                cursor: "pointer", fontFamily: "var(--font-archivo), monospace",
              }}
            >
              Se déconnecter →
            </button>
          </div>
        </div>
      )}

      {/* ── Section : mot de passe ── */}
      {section === "password" && (
        <div style={{ background: "var(--white)", border: "1.5px solid var(--grey-200)", borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 24px", fontFamily: "var(--font-archivo), system-ui, sans-serif" }}>
            Modifier le mot de passe
          </h2>

          {pwdMsg && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: pwdMsg.ok ? "#D1FAE5" : "#FEE2E2",
              border: `1px solid ${pwdMsg.ok ? "#6EE7B7" : "#FCA5A5"}`,
              borderRadius: 8, fontSize: 13,
              color: pwdMsg.ok ? "#065F46" : "#991B1B",
            }}>
              {pwdMsg.ok ? "✅" : "⚠️"} {pwdMsg.text}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Mot de passe actuel" value={currentPwd} onChange={setCurrentPwd} type="password" />
            <Field label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} type="password" placeholder="8 caractères minimum" />
            <Field label="Confirmer le nouveau mot de passe" value={confirmPwd} onChange={setConfirmPwd} type="password" />
          </div>

          <button
            onClick={() => void handleChangePwd()}
            disabled={savingPwd}
            style={{
              marginTop: 24,
              padding: "14px 28px",
              background: savingPwd ? "var(--grey-200)" : "var(--red)",
              color: savingPwd ? "var(--grey-500)" : "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: savingPwd ? "not-allowed" : "pointer",
              fontFamily: "var(--font-archivo), monospace",
            }}
          >
            {savingPwd ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </div>
      )}

      {/* RGPD */}
      {section === "rgpd" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>📦 Exporter mes données</h3>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.6 }}>
              Téléchargez une copie de toutes vos données personnelles (compte, adresses, commandes)
              au format JSON — conformément au RGPD, droit à la portabilité.
            </p>
            <button
              onClick={() => void handleExport()}
              disabled={rgpdLoading}
              style={{
                background: "#0A0E27", color: "#fff", border: "none",
                padding: "10px 22px", borderRadius: 6, fontSize: 13,
                fontWeight: 700, cursor: rgpdLoading ? "not-allowed" : "pointer",
              }}
            >
              {rgpdLoading ? "Chargement…" : "Télécharger mes données"}
            </button>
          </div>

          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px", color: "#DC2626" }}>🗑️ Supprimer mon compte</h3>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.6 }}>
              La suppression est irréversible. Vos données personnelles seront anonymisées.
              Vos commandes sont conservées 10 ans pour obligation légale (comptabilité).
            </p>
            {deleteConfirm && (
              <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", margin: "0 0 12px" }}>
                ⚠️ Confirmez-vous la suppression définitive de votre compte ?
              </p>
            )}
            <button
              onClick={() => void handleDelete()}
              disabled={rgpdLoading}
              style={{
                background: deleteConfirm ? "#DC2626" : "transparent",
                color: deleteConfirm ? "#fff" : "#DC2626",
                border: "2px solid #DC2626",
                padding: "10px 22px", borderRadius: 6, fontSize: 13,
                fontWeight: 700, cursor: rgpdLoading ? "not-allowed" : "pointer",
              }}
            >
              {rgpdLoading ? "Suppression…" : deleteConfirm ? "Oui, supprimer définitivement" : "Supprimer mon compte"}
            </button>
            {deleteConfirm && (
              <button
                onClick={() => setDeleteConfirm(false)}
                style={{ marginLeft: 12, background: "transparent", border: "none", fontSize: 13, color: "#6B7280", cursor: "pointer", textDecoration: "underline" }}
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field helper ──

function Field({
  label, value, onChange, type = "text", placeholder, readOnly = false,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 6, display: "block" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px",
          border: `1.5px solid ${readOnly ? "var(--grey-100)" : "var(--grey-200)"}`,
          borderRadius: 8, fontFamily: "var(--font-archivo), monospace", fontSize: 13,
          background: readOnly ? "var(--grey-50)" : "var(--white)",
          color: readOnly ? "var(--grey-500)" : "var(--ink)",
          outline: "none", boxSizing: "border-box",
          cursor: readOnly ? "default" : "text",
        }}
      />
    </div>
  );
}
