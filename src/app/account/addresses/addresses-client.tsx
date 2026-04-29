"use client";

import { useState } from "react";
import {
  saveAddress,
  deleteAddress,
  setDefaultAddress,
  type SavedAddress,
} from "@/lib/address-actions";

interface Props {
  initialAddresses: SavedAddress[];
}

interface AddressForm {
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  phone: string;
}

const empty: AddressForm = {
  label: "", firstName: "", lastName: "",
  line1: "", line2: "", postalCode: "", city: "", phone: "",
};

export default function AddressesClient({ initialAddresses }: Props) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  function upd(key: keyof AddressForm, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.line1 || !form.postalCode || !form.city) {
      setError("Adresse, code postal et ville sont requis.");
      return;
    }
    if (!/^\d{5}$/.test(form.postalCode)) {
      setError("Code postal invalide (5 chiffres).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveAddress({
      label: form.label || undefined,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      line1: form.line1,
      line2: form.line2 || undefined,
      postalCode: form.postalCode,
      city: form.city,
      countryCode: "FR",
      phone: form.phone || undefined,
      isDefault: addresses.length === 0,
    });
    if (!res.ok) { setError(res.error); setSaving(false); return; }
    const reload = await import("@/lib/address-actions").then((m) => m.getUserAddresses());
    setAddresses(reload);
    setForm(empty);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
  }

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    await setDefaultAddress(id);
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id }))
    );
    setSettingDefaultId(null);
  }

  return (
    <div>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 6 }}>◆ MON ESPACE</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0 }}>Mes adresses</h1>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setForm(empty); setError(null); }}
          style={{
            padding: "12px 20px", background: showForm ? "var(--grey-200)" : "#DC2626",
            color: showForm ? "var(--ink)" : "#fff", border: "2px solid var(--ink)",
            borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "var(--font-archivo), monospace",
          }}
        >
          {showForm ? "Annuler" : "+ Ajouter une adresse"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1.5px solid var(--grey-200)", borderRadius: 12,
          padding: 24, marginBottom: 24,
        }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800 }}>Nouvelle adresse</h3>

          {error && (
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#991B1B" }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              { key: "label", label: "Libellé (ex : Maison)", span: 2 },
              { key: "firstName", label: "Prénom" },
              { key: "lastName", label: "Nom" },
              { key: "line1", label: "Adresse", span: 2, placeholder: "12 rue Victor Hugo" },
              { key: "line2", label: "Complément", span: 2, placeholder: "Appartement, bâtiment…" },
              { key: "postalCode", label: "Code postal" },
              { key: "city", label: "Ville" },
              { key: "phone", label: "Téléphone", span: 2 },
            ] as { key: keyof AddressForm; label: string; span?: number; placeholder?: string }[]).map(({ key, label, span, placeholder }) => (
              <div key={key} style={{ gridColumn: span === 2 ? "1 / -1" : "auto" }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 6, display: "block" }}>
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => upd(key, e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: "100%", padding: "12px 14px",
                    border: "1.5px solid var(--grey-200)", borderRadius: 8,
                    fontFamily: "var(--font-archivo), monospace", fontSize: 13,
                    background: "#fff", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: "14px 28px", background: saving ? "var(--grey-400)" : "#DC2626",
                color: "#fff", border: "2px solid var(--ink)", borderRadius: 8,
                fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "var(--font-archivo), monospace",
              }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 ? (
        <div style={{
          background: "#fff", border: "1.5px dashed var(--grey-200)", borderRadius: 12,
          padding: 40, textAlign: "center", color: "var(--grey-600)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Aucune adresse enregistrée</div>
          <div style={{ fontSize: 13 }}>Ajoutez une adresse pour accélérer vos prochaines commandes.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              style={{
                background: "#fff",
                border: `1.5px solid ${addr.isDefault ? "#DC2626" : "var(--grey-200)"}`,
                borderRadius: 12, padding: 20, display: "flex",
                justifyContent: "space-between", alignItems: "flex-start", gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{addr.label ?? "Adresse"}</span>
                  {addr.isDefault && (
                    <span style={{ fontSize: 10, background: "#FEF2F2", color: "#DC2626", padding: "2px 7px", borderRadius: 4, border: "1px solid #DC2626", fontWeight: 700 }}>
                      Adresse par défaut
                    </span>
                  )}
                </div>
                {(addr.firstName || addr.lastName) && (
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "var(--grey-600)", lineHeight: 1.6 }}>
                  {addr.line1}
                  {addr.line2 && <><br />{addr.line2}</>}
                  <br />
                  {addr.postalCode} {addr.city}
                  {addr.phone && <><br />{addr.phone}</>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                {!addr.isDefault && (
                  <button
                    onClick={() => void handleSetDefault(addr.id)}
                    disabled={settingDefaultId === addr.id}
                    style={{
                      padding: "7px 12px", background: "transparent", border: "1px solid var(--grey-200)",
                      borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      color: "var(--grey-600)", fontFamily: "var(--font-archivo), monospace", whiteSpace: "nowrap",
                    }}
                  >
                    {settingDefaultId === addr.id ? "…" : "Définir par défaut"}
                  </button>
                )}
                <button
                  onClick={() => void handleDelete(addr.id)}
                  disabled={deletingId === addr.id}
                  style={{
                    padding: "7px 12px", background: "transparent", border: "1px solid #FCA5A5",
                    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    color: "#991B1B", fontFamily: "var(--font-archivo), monospace",
                  }}
                >
                  {deletingId === addr.id ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
