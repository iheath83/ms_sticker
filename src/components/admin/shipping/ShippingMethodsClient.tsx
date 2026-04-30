"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, AdminTableWrapper, AdminTableHead,
  AdminEmptyState, StatusBadge, PrimaryBtn, SecondaryBtn, DangerBtn, T,
} from "@/components/admin/admin-ui";
import type { ShippingMethod } from "@/db/schema";

const METHOD_TYPE_LABELS: Record<string, string> = {
  carrier: "Transporteur",
  local_delivery: "Livraison locale",
  pickup: "Retrait",
  relay_point: "Point relais",
  custom: "Personnalisé",
  freight: "Fret",
};

interface MethodFormState {
  name: string;
  publicName: string;
  description: string;
  type: string;
  isActive: boolean;
  isDefault: boolean;
  basePriceCents: number;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  displayOrder: number;
  supportsTracking: boolean;
  supportsRelayPoint: boolean;
  supportsPickup: boolean;
  supportsDeliveryDate: boolean;
  supportsTimeSlot: boolean;
}

const emptyForm: MethodFormState = {
  name: "", publicName: "", description: "", type: "carrier",
  isActive: true, isDefault: false, basePriceCents: 490,
  minDeliveryDays: "", maxDeliveryDays: "", displayOrder: 0,
  supportsTracking: false, supportsRelayPoint: false,
  supportsPickup: false, supportsDeliveryDate: false, supportsTimeSlot: false,
};

export function ShippingMethodsClient({ initial }: { initial: ShippingMethod[] }) {
  const [methods, setMethods] = useState<ShippingMethod[]>(initial);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MethodFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(m: ShippingMethod) {
    setForm({
      name: m.name,
      publicName: m.publicName,
      description: m.description ?? "",
      type: m.type,
      isActive: m.isActive,
      isDefault: m.isDefault,
      basePriceCents: m.basePriceCents,
      minDeliveryDays: m.minDeliveryDays?.toString() ?? "",
      maxDeliveryDays: m.maxDeliveryDays?.toString() ?? "",
      displayOrder: m.displayOrder,
      supportsTracking: m.supportsTracking,
      supportsRelayPoint: m.supportsRelayPoint,
      supportsPickup: m.supportsPickup,
      supportsDeliveryDate: m.supportsDeliveryDate,
      supportsTimeSlot: m.supportsTimeSlot,
    });
    setEditing(m);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      minDeliveryDays: form.minDeliveryDays ? parseInt(form.minDeliveryDays, 10) : null,
      maxDeliveryDays: form.maxDeliveryDays ? parseInt(form.maxDeliveryDays, 10) : null,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/admin/shipping/methods/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { method?: ShippingMethod; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setMethods((prev) => prev.map((m) => m.id === editing.id ? data.method! : m));
      } else {
        const res = await fetch("/api/admin/shipping/methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { method?: ShippingMethod; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setMethods((prev) => [...prev, data.method!]);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette méthode ?")) return;
    await fetch(`/api/admin/shipping/methods/${id}`, { method: "DELETE" });
    setMethods((prev) => prev.filter((m) => m.id !== id));
  }

  async function toggleActive(m: ShippingMethod) {
    const res = await fetch(`/api/admin/shipping/methods/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    const data = await res.json() as { method?: ShippingMethod };
    if (data.method) setMethods((prev) => prev.map((x) => x.id === m.id ? data.method! : x));
  }

  const showForm = creating || !!editing;

  return (
    <>
      <AdminTopbar title="Méthodes de livraison" subtitle={`${methods.length} méthode${methods.length > 1 ? "s" : ""}`}>
        <PrimaryBtn onClick={openCreate}>+ Nouvelle méthode</PrimaryBtn>
      </AdminTopbar>

      <AdminPage>
        {showForm && (
          <AdminCard style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: T.textPrimary }}>
              {editing ? "Modifier la méthode" : "Nouvelle méthode"}
            </div>
            {error && <div style={{ padding: "10px 14px", background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, fontSize: 13, color: T.danger, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InputRow label="Nom interne" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <InputRow label="Nom affiché client" value={form.publicName} onChange={(v) => setForm((f) => ({ ...f, publicName: v }))} />
              <div style={{ gridColumn: "1 / -1" }}>
                <InputRow label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
              </div>
              <div>
                <LabelRow>Type</LabelRow>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={selectStyle}>
                  {Object.entries(METHOD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <InputRow label="Prix de base (centimes)" value={String(form.basePriceCents)} onChange={(v) => setForm((f) => ({ ...f, basePriceCents: parseInt(v, 10) || 0 }))} type="number" />
              <InputRow label="Délai min (jours)" value={form.minDeliveryDays} onChange={(v) => setForm((f) => ({ ...f, minDeliveryDays: v }))} type="number" />
              <InputRow label="Délai max (jours)" value={form.maxDeliveryDays} onChange={(v) => setForm((f) => ({ ...f, maxDeliveryDays: v }))} type="number" />
              <InputRow label="Ordre d'affichage" value={String(form.displayOrder)} onChange={(v) => setForm((f) => ({ ...f, displayOrder: parseInt(v, 10) || 0 }))} type="number" />
            </div>

            <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
              {[
                ["isActive", "Actif"],
                ["isDefault", "Par défaut"],
                ["supportsTracking", "Suivi colis"],
                ["supportsRelayPoint", "Point relais"],
                ["supportsPickup", "Retrait"],
                ["supportsDeliveryDate", "Date livraison"],
                ["supportsTimeSlot", "Créneau horaire"],
              ].map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={Boolean(form[k as keyof MethodFormState])} onChange={(e) => { const key = k as keyof MethodFormState; setForm((f) => ({ ...f, [key]: e.target.checked })); }} style={{ width: 15, height: 15 }} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <PrimaryBtn onClick={() => void handleSave()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</PrimaryBtn>
              <SecondaryBtn onClick={closeForm}>Annuler</SecondaryBtn>
            </div>
          </AdminCard>
        )}

        <AdminCard>
          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Nom public", "Type", "Prix de base", "Délai", "Ordre", "Statut", "Actions"]} />
              <tbody>
                {methods.length === 0 && (
                  <tr><td colSpan={7}><AdminEmptyState title="Aucune méthode" subtitle="Créez votre première méthode de livraison" /></td></tr>
                )}
                {methods.map((m) => (
                  <tr key={m.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                      {m.publicName}
                      <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 400 }}>{m.name}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>{METHOD_TYPE_LABELS[m.type] ?? m.type}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                      {m.basePriceCents === 0 ? <span style={{ color: T.success }}>OFFERT</span> : `${(m.basePriceCents / 100).toFixed(2)} €`}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                      {m.minDeliveryDays !== null && m.maxDeliveryDays !== null ? `${m.minDeliveryDays}–${m.maxDeliveryDays} j` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>{m.displayOrder}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge label={m.isActive ? "Actif" : "Inactif"} variant={m.isActive ? "success" : "neutral"} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <SecondaryBtn onClick={() => openEdit(m)}>Modifier</SecondaryBtn>
                        <SecondaryBtn onClick={() => void toggleActive(m)}>{m.isActive ? "Désactiver" : "Activer"}</SecondaryBtn>
                        <DangerBtn onClick={() => void handleDelete(m.id)}>Supprimer</DangerBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrapper>
        </AdminCard>
      </AdminPage>
    </>
  );
}

function LabelRow({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textSecondary, display: "block", marginBottom: 6 }}>{children}</label>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, fontSize: 13,
  outline: "none", background: "#fff",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

function InputRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <LabelRow>{label}</LabelRow>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}
