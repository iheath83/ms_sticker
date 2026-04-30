"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, AdminTableWrapper, AdminTableHead,
  AdminEmptyState, StatusBadge, PrimaryBtn, SecondaryBtn, DangerBtn, T,
} from "@/components/admin/admin-ui";
import type { ShippingPickupLocation } from "@/db/schema";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

interface PickupFormState {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  instructions: string;
  daysAvailable: number[];
  prepDelayDays: number;
  slotCapacity: number;
  isActive: boolean;
  hours: Record<string, string>;
}

const emptyForm: PickupFormState = {
  name: "", addressLine1: "", addressLine2: "", city: "", postalCode: "",
  countryCode: "FR", phone: "", instructions: "",
  daysAvailable: [1, 2, 3, 4, 5],
  prepDelayDays: 1, slotCapacity: 0, isActive: true,
  hours: { "1": "09:00-18:00", "2": "09:00-18:00", "3": "09:00-18:00", "4": "09:00-18:00", "5": "09:00-18:00" },
};

export function ShippingPickupClient({ initial }: { initial: ShippingPickupLocation[] }) {
  const [locations, setLocations] = useState<ShippingPickupLocation[]>(initial);
  const [editing, setEditing] = useState<ShippingPickupLocation | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PickupFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() { setForm(emptyForm); setCreating(true); setEditing(null); }

  function openEdit(l: ShippingPickupLocation) {
    setForm({
      name: l.name,
      addressLine1: l.addressLine1 ?? "",
      addressLine2: l.addressLine2 ?? "",
      city: l.city ?? "",
      postalCode: l.postalCode ?? "",
      countryCode: l.countryCode,
      phone: l.phone ?? "",
      instructions: l.instructions ?? "",
      daysAvailable: (l.daysAvailable as number[]) ?? [1, 2, 3, 4, 5],
      prepDelayDays: l.prepDelayDays,
      slotCapacity: l.slotCapacity,
      isActive: l.isActive,
      hours: (l.hoursJson as Record<string, string>) ?? {},
    });
    setEditing(l);
    setCreating(false);
  }

  function closeForm() { setCreating(false); setEditing(null); }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name: form.name,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      postalCode: form.postalCode || null,
      countryCode: form.countryCode,
      phone: form.phone || null,
      instructions: form.instructions || null,
      daysAvailable: form.daysAvailable,
      prepDelayDays: form.prepDelayDays,
      slotCapacity: form.slotCapacity,
      isActive: form.isActive,
      hoursJson: form.hours,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/admin/shipping/pickup/${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { location?: ShippingPickupLocation };
        if (data.location) setLocations((prev) => prev.map((l) => l.id === editing.id ? data.location! : l));
      } else {
        const res = await fetch("/api/admin/shipping/pickup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { location?: ShippingPickupLocation };
        if (data.location) setLocations((prev) => [...prev, data.location!]);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce point de retrait ?")) return;
    await fetch(`/api/admin/shipping/pickup/${id}`, { method: "DELETE" });
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  const showForm = creating || !!editing;

  return (
    <>
      <AdminTopbar title="Points de retrait" subtitle={`${locations.length} point${locations.length > 1 ? "s" : ""}`}>
        <PrimaryBtn onClick={openCreate}>+ Nouveau point de retrait</PrimaryBtn>
      </AdminTopbar>

      <AdminPage>
        {showForm && (
          <AdminCard style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editing ? "Modifier" : "Nouveau point de retrait"}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Input label="Nom du lieu" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Input label="Téléphone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <Input label="Adresse (ligne 1)" value={form.addressLine1} onChange={(v) => setForm((f) => ({ ...f, addressLine1: v }))} />
              <Input label="Adresse (ligne 2)" value={form.addressLine2} onChange={(v) => setForm((f) => ({ ...f, addressLine2: v }))} />
              <Input label="Code postal" value={form.postalCode} onChange={(v) => setForm((f) => ({ ...f, postalCode: v }))} />
              <Input label="Ville" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
              <Input label="Délai préparation (jours)" value={String(form.prepDelayDays)} onChange={(v) => setForm((f) => ({ ...f, prepDelayDays: parseInt(v, 10) || 1 }))} type="number" />
              <Input label="Capacité par créneau (0 = illimité)" value={String(form.slotCapacity)} onChange={(v) => setForm((f) => ({ ...f, slotCapacity: parseInt(v, 10) || 0 }))} type="number" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Input label="Instructions client" value={form.instructions} onChange={(v) => setForm((f) => ({ ...f, instructions: v }))} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Jours disponibles</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <label key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.daysAvailable.includes(d)}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        daysAvailable: e.target.checked ? [...f.daysAvailable, d] : f.daysAvailable.filter((x) => x !== d),
                      }))}
                    />
                    {DAY_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Horaires par jour (ex: 09:00-18:00)</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {form.daysAvailable.sort().map((d) => (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.textSecondary, width: 30 }}>{DAY_LABELS[d]}</span>
                    <input
                      value={form.hours[String(d)] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [String(d)]: e.target.value } }))}
                      placeholder="09:00-18:00"
                      style={{ padding: "5px 8px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 12, width: 110 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Point de retrait actif
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <PrimaryBtn onClick={() => void handleSave()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</PrimaryBtn>
              <SecondaryBtn onClick={closeForm}>Annuler</SecondaryBtn>
            </div>
          </AdminCard>
        )}

        <AdminCard>
          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Lieu", "Adresse", "Jours", "Délai prépa", "Statut", "Actions"]} />
              <tbody>
                {locations.length === 0 && (
                  <tr><td colSpan={6}><AdminEmptyState title="Aucun point de retrait" subtitle="Créez votre premier point de retrait" /></td></tr>
                )}
                {locations.map((l) => (
                  <tr key={l.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{l.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                      {[l.addressLine1, l.postalCode, l.city].filter(Boolean).join(", ")}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>
                      {((l.daysAvailable as number[]) ?? []).map((d) => DAY_LABELS[d]).join(", ")}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>{l.prepDelayDays} jour{l.prepDelayDays > 1 ? "s" : ""}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge label={l.isActive ? "Actif" : "Inactif"} variant={l.isActive ? "success" : "neutral"} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <SecondaryBtn onClick={() => openEdit(l)}>Modifier</SecondaryBtn>
                        <DangerBtn onClick={() => void handleDelete(l.id)}>Supprimer</DangerBtn>
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

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
  textTransform: "uppercase", color: T.textSecondary, display: "block",
};

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ ...labelStyle, marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}
