"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, AdminTableWrapper, AdminTableHead,
  AdminEmptyState, StatusBadge, PrimaryBtn, SecondaryBtn, DangerBtn, T,
} from "@/components/admin/admin-ui";
import { postalCodeMatchesRules } from "@/lib/shipping/postal-codes";
import type { PostalCodeRule } from "@/lib/shipping/types";

interface ZoneRow {
  id: string;
  name: string;
  description: string | null;
  countries: string[];
  regions: string[];
  cities: string[];
  isActive: boolean;
  postalRules: Array<{ id: string; type: string; value: string; fromValue?: string | null; toValue?: string | null }>;
}

interface ZoneFormState {
  name: string;
  description: string;
  countries: string;
  regions: string;
  cities: string;
  isActive: boolean;
  postalRulesText: string;
}

const emptyForm: ZoneFormState = {
  name: "", description: "", countries: "FR", regions: "", cities: "",
  isActive: true, postalRulesText: "",
};

function parsePostalRulesText(text: string): PostalCodeRule[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line, i) => {
    if (line.startsWith("!")) return { id: String(i), type: "exclude" as const, value: line.slice(1).trim() } satisfies PostalCodeRule;
    if (line.includes("-")) {
      const parts = line.split("-").map((s) => s.trim());
      const from = parts[0] ?? line;
      const to = parts[1] ?? line;
      return { id: String(i), type: "range" as const, value: from, fromValue: from, toValue: to } satisfies PostalCodeRule;
    }
    if (line.endsWith("*")) return { id: String(i), type: "prefix" as const, value: line.slice(0, -1) } satisfies PostalCodeRule;
    return { id: String(i), type: "exact" as const, value: line } satisfies PostalCodeRule;
  });
}

function postalRulesToText(rules: ZoneRow["postalRules"]): string {
  return rules.map((r) => {
    if (r.type === "exclude") return `!${r.value}`;
    if (r.type === "prefix") return `${r.value}*`;
    if (r.type === "range") return `${r.fromValue ?? r.value}-${r.toValue ?? r.value}`;
    return r.value;
  }).join("\n");
}

export function ShippingZonesClient({ initial }: { initial: ZoneRow[] }) {
  const [zones, setZones] = useState<ZoneRow[]>(initial);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ZoneFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Postal code tester
  const [testZoneId, setTestZoneId] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(z: ZoneRow) {
    setForm({
      name: z.name,
      description: z.description ?? "",
      countries: z.countries.join(", "),
      regions: z.regions.join(", "),
      cities: z.cities.join(", "),
      isActive: z.isActive,
      postalRulesText: postalRulesToText(z.postalRules),
    });
    setEditing(z);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  function buildPayload() {
    const postalRules = parsePostalRulesText(form.postalRulesText);
    return {
      name: form.name,
      description: form.description || undefined,
      countries: form.countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      regions: form.regions.split(",").map((s) => s.trim()).filter(Boolean),
      cities: form.cities.split(",").map((s) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      postalRules,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = buildPayload();

    try {
      if (editing) {
        const res = await fetch(`/api/admin/shipping/zones/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { zone?: ZoneRow; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setZones((prev) => prev.map((z) => z.id === editing.id ? data.zone! : z));
      } else {
        const res = await fetch("/api/admin/shipping/zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { zone?: ZoneRow; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setZones((prev) => [...prev, data.zone!]);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette zone ?")) return;
    await fetch(`/api/admin/shipping/zones/${id}`, { method: "DELETE" });
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  function testPostalCode(zone: ZoneRow) {
    const rules: PostalCodeRule[] = zone.postalRules.map((r) => {
      const rule: PostalCodeRule = { id: r.id, type: r.type as PostalCodeRule["type"], value: r.value };
      if (r.fromValue) rule.fromValue = r.fromValue;
      if (r.toValue) rule.toValue = r.toValue;
      return rule;
    });
    const countryMatch = zone.countries.length === 0 || zone.countries.includes("FR");
    const matched = rules.length === 0 ? countryMatch : postalCodeMatchesRules(testCode, rules);
    setTestResult(matched ? `✅ "${testCode}" appartient à "${zone.name}"` : `❌ "${testCode}" n'appartient pas à "${zone.name}"`);
  }

  const showForm = creating || !!editing;

  return (
    <>
      <AdminTopbar title="Zones de livraison" subtitle={`${zones.length} zone${zones.length > 1 ? "s" : ""}`}>
        <PrimaryBtn onClick={openCreate}>+ Nouvelle zone</PrimaryBtn>
      </AdminTopbar>

      <AdminPage>
        {showForm && (
          <AdminCard style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: T.textPrimary }}>
              {editing ? "Modifier la zone" : "Nouvelle zone"}
            </div>
            {error && <div style={{ padding: "10px 14px", background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, fontSize: 13, color: T.danger, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InputRow label="Nom de la zone" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <InputRow label="Pays (codes ISO séparés par virgules)" value={form.countries} onChange={(v) => setForm((f) => ({ ...f, countries: v }))} placeholder="FR, BE, CH" />
              <div style={{ gridColumn: "1 / -1" }}>
                <InputRow label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <LabelRow>Codes postaux (une règle par ligne)</LabelRow>
              <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6 }}>
                Formats : <code>75001</code> (exact), <code>75*</code> (préfixe), <code>75000-75999</code> (plage), <code>!20*</code> (exclusion)
              </div>
              <textarea
                value={form.postalRulesText}
                onChange={(e) => setForm((f) => ({ ...f, postalRulesText: e.target.value }))}
                rows={5}
                placeholder={"06*\n83*\n!201*\n!202*"}
                style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Zone active
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <PrimaryBtn onClick={() => void handleSave()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</PrimaryBtn>
              <SecondaryBtn onClick={closeForm}>Annuler</SecondaryBtn>
            </div>
          </AdminCard>
        )}

        {/* Postal code tester */}
        <AdminCard style={{ marginBottom: 24, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: T.textPrimary }}>Testeur de code postal</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={testCode}
              onChange={(e) => { setTestCode(e.target.value); setTestResult(null); }}
              placeholder="Ex: 83480"
              style={{ padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, width: 160 }}
            />
            <select onChange={(e) => setTestZoneId(e.target.value)} style={{ padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13 }}>
              <option value="">Choisir une zone</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <SecondaryBtn onClick={() => {
              const zone = zones.find((z) => z.id === testZoneId);
              if (zone && testCode) testPostalCode(zone);
            }}>Tester</SecondaryBtn>
          </div>
          {testResult && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: testResult.startsWith("✅") ? T.successBg : T.dangerBg, borderRadius: T.radiusSm, fontSize: 13 }}>{testResult}</div>
          )}
        </AdminCard>

        <AdminCard>
          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Zone", "Pays", "Règles codes postaux", "Statut", "Actions"]} />
              <tbody>
                {zones.length === 0 && (
                  <tr><td colSpan={5}><AdminEmptyState title="Aucune zone" subtitle="Créez votre première zone de livraison" /></td></tr>
                )}
                {zones.map((z) => (
                  <tr key={z.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                      {z.name}
                      {z.description && <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 400 }}>{z.description}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>{z.countries.join(", ") || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                      {z.postalRules.length > 0 ? `${z.postalRules.length} règle${z.postalRules.length > 1 ? "s" : ""}` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge label={z.isActive ? "Active" : "Inactive"} variant={z.isActive ? "success" : "neutral"} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <SecondaryBtn onClick={() => openEdit(z)}>Modifier</SecondaryBtn>
                        <DangerBtn onClick={() => void handleDelete(z.id)}>Supprimer</DangerBtn>
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

function InputRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <LabelRow>{label}</LabelRow>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}
