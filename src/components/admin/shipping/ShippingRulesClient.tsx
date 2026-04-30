"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, AdminTableWrapper, AdminTableHead,
  AdminEmptyState, StatusBadge, PrimaryBtn, SecondaryBtn, DangerBtn, T,
} from "@/components/admin/admin-ui";
import type { ShippingRuleDB, ShippingRuleCondition, ShippingRuleAction, ShippingConditionGroup } from "@/lib/shipping/types";

// ─── Templates ────────────────────────────────────────────────────────────────

const RULE_TEMPLATES = [
  {
    label: "Livraison offerte dès X €",
    rule: {
      name: "Livraison offerte dès 100 €",
      priority: 100,
      conditionRoot: { id: "root", logic: "AND", conditions: [{ id: "c1", field: "cart.subtotal", operator: "greater_than_or_equal", value: 100 }], groups: [] },
      actions: [{ id: "a1", type: "set_free" }],
    },
  },
  {
    label: "Surcharge Corse",
    rule: {
      name: "Surcharge Corse",
      priority: 50,
      conditionRoot: { id: "root", logic: "AND", conditions: [{ id: "c1", field: "destination.postalCode", operator: "starts_with", value: "20" }], groups: [] },
      actions: [{ id: "a1", type: "add_fixed", value: 12 }],
    },
  },
  {
    label: "Masquer point relais si produit fragile",
    rule: {
      name: "Masquer point relais (produit fragile)",
      priority: 30,
      conditionRoot: { id: "root", logic: "AND", conditions: [{ id: "c1", field: "cart.isFragile", operator: "is_true", value: true }], groups: [] },
      actions: [{ id: "a1", type: "hide_method", value: "Produit fragile incompatible" }],
    },
  },
  {
    label: "Réduction client VIP",
    rule: {
      name: "Livraison offerte VIP dès 50 €",
      priority: 90,
      conditionRoot: { id: "root", logic: "AND", conditions: [
        { id: "c1", field: "customer.tag", operator: "equals", value: "VIP" },
        { id: "c2", field: "cart.subtotal", operator: "greater_than_or_equal", value: 50 },
      ], groups: [] },
      actions: [{ id: "a1", type: "set_free" }],
    },
  },
  {
    label: "Bloquer livraison express après cut-off 12h",
    rule: {
      name: "Pas d'express après 12h",
      priority: 40,
      conditionRoot: { id: "root", logic: "AND", conditions: [{ id: "c1", field: "time.isAfterCutoff", operator: "is_true", value: 12 }], groups: [] },
      actions: [{ id: "a1", type: "hide_method" }],
    },
  },
];

const CONDITION_FIELDS = [
  { value: "cart.subtotal", label: "Sous-total panier (€)" },
  { value: "cart.totalQuantity", label: "Quantité totale" },
  { value: "cart.totalWeight", label: "Poids total (kg)" },
  { value: "cart.isFragile", label: "Produit fragile présent" },
  { value: "cart.isOversized", label: "Produit volumineux présent" },
  { value: "cart.isColdChain", label: "Produit chaîne du froid présent" },
  { value: "cart.isAllDigital", label: "Tous les produits sont digitaux" },
  { value: "cart.hasProductTag", label: "Tag produit présent" },
  { value: "cart.hasCategory", label: "Catégorie produit présente" },
  { value: "destination.country", label: "Pays" },
  { value: "destination.postalCode", label: "Code postal" },
  { value: "customer.isB2B", label: "Client B2B" },
  { value: "customer.tag", label: "Tag client" },
  { value: "customer.orderCount", label: "Nombre de commandes client" },
  { value: "time.isAfterCutoff", label: "Après cut-off (heure en valeur)" },
  { value: "time.isWeekend", label: "Week-end" },
];

const OPERATORS = [
  { value: "equals", label: "égal à" },
  { value: "not_equals", label: "différent de" },
  { value: "greater_than_or_equal", label: "supérieur ou égal à" },
  { value: "less_than", label: "inférieur à" },
  { value: "starts_with", label: "commence par" },
  { value: "contains", label: "contient" },
  { value: "in", label: "dans la liste" },
  { value: "is_true", label: "est vrai" },
  { value: "is_false", label: "est faux" },
];

const ACTION_TYPES = [
  { value: "set_free", label: "Rendre gratuit" },
  { value: "set_price", label: "Définir un prix fixe (€)" },
  { value: "add_fixed", label: "Ajouter un montant fixe (€)" },
  { value: "subtract_fixed", label: "Réduire d'un montant fixe (€)" },
  { value: "add_percent", label: "Ajouter un % de surcharge" },
  { value: "subtract_percent", label: "Réduire d'un %" },
  { value: "hide_method", label: "Masquer la méthode" },
  { value: "hide_all_except", label: "Masquer tout sauf les méthodes ciblées" },
  { value: "rename_method", label: "Renommer la méthode" },
  { value: "add_badge", label: "Ajouter un badge" },
  { value: "add_days", label: "Ajouter des jours au délai" },
  { value: "block_checkout", label: "Bloquer le checkout" },
];

function newCondition(): ShippingRuleCondition {
  return { id: crypto.randomUUID(), field: "cart.subtotal", operator: "greater_than_or_equal", value: 100 };
}

function newAction(): ShippingRuleAction {
  return { id: crypto.randomUUID(), type: "set_free" };
}

function newRoot(): ShippingConditionGroup {
  return { id: crypto.randomUUID(), logic: "AND", conditions: [newCondition()], groups: [] };
}

interface RuleFormState {
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  stopProcessingAfterMatch: boolean;
  combinableWithOtherRules: boolean;
  startsAt: string;
  endsAt: string;
  conditionRoot: ShippingConditionGroup;
  actions: ShippingRuleAction[];
}

const emptyForm: RuleFormState = {
  name: "", description: "", isActive: true, priority: 100,
  stopProcessingAfterMatch: false, combinableWithOtherRules: true,
  startsAt: "", endsAt: "",
  conditionRoot: newRoot(),
  actions: [newAction()],
};

function ruleToFormState(r: ShippingRuleDB): RuleFormState {
  return {
    name: r.name,
    description: r.description ?? "",
    isActive: r.isActive,
    priority: r.priority,
    stopProcessingAfterMatch: r.stopProcessingAfterMatch,
    combinableWithOtherRules: r.combinableWithOtherRules,
    startsAt: r.startsAt ? new Date(r.startsAt).toISOString().slice(0, 16) : "",
    endsAt: r.endsAt ? new Date(r.endsAt).toISOString().slice(0, 16) : "",
    conditionRoot: r.conditionRoot,
    actions: r.actions,
  };
}

export function ShippingRulesClient({ initial }: { initial: ShippingRuleDB[] }) {
  const [rules, setRules] = useState<ShippingRuleDB[]>(initial);
  const [editing, setEditing] = useState<ShippingRuleDB | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(r: ShippingRuleDB) {
    setForm(ruleToFormState(r));
    setEditing(r);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  function applyTemplate(template: typeof RULE_TEMPLATES[0]) {
    setForm((f) => ({
      ...f,
      name: template.rule.name,
      priority: template.rule.priority,
      conditionRoot: template.rule.conditionRoot as ShippingConditionGroup,
      actions: template.rule.actions as ShippingRuleAction[],
    }));
    setShowTemplates(false);
    if (!creating && !editing) {
      setCreating(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/admin/shipping/rules/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { rule?: ShippingRuleDB; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setRules((prev) => prev.map((r) => r.id === editing.id ? data.rule! : r));
      } else {
        const res = await fetch("/api/admin/shipping/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { rule?: ShippingRuleDB; error?: string };
        if (!res.ok) { setError(String(data.error ?? "Erreur")); return; }
        setRules((prev) => [...prev, data.rule!]);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette règle ?")) return;
    await fetch(`/api/admin/shipping/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleActive(r: ShippingRuleDB) {
    const res = await fetch(`/api/admin/shipping/rules/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    const data = await res.json() as { rule?: ShippingRuleDB };
    if (data.rule) setRules((prev) => prev.map((x) => x.id === r.id ? data.rule! : x));
  }

  const showForm = creating || !!editing;

  return (
    <>
      <AdminTopbar title="Règles d'expédition" subtitle={`${rules.length} règle${rules.length > 1 ? "s" : ""}`}>
        <div style={{ display: "flex", gap: 8 }}>
          <SecondaryBtn onClick={() => setShowTemplates((v) => !v)}>Templates</SecondaryBtn>
          <PrimaryBtn onClick={openCreate}>+ Nouvelle règle</PrimaryBtn>
        </div>
      </AdminTopbar>

      <AdminPage>
        {/* Templates panel */}
        {showTemplates && (
          <AdminCard style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Templates de règles prêts à l&apos;emploi</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {RULE_TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => applyTemplate(t)} style={{ padding: "10px 14px", background: T.brandLight, border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 600, color: T.textPrimary }}>
                  {t.label}
                </button>
              ))}
            </div>
          </AdminCard>
        )}

        {/* Rule Builder Form */}
        {showForm && (
          <AdminCard style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editing ? "Modifier la règle" : "Nouvelle règle"}</div>
            {error && <div style={{ padding: "10px 14px", background: T.dangerBg, borderRadius: T.radiusSm, fontSize: 13, color: T.danger, marginBottom: 16 }}>{error}</div>}

            {/* Basic info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 16, marginBottom: 20 }}>
              <InputRow label="Nom de la règle" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <InputRow label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
              <InputRow label="Priorité" value={String(form.priority)} onChange={(v) => setForm((f) => ({ ...f, priority: parseInt(v, 10) || 100 }))} type="number" />
            </div>

            {/* Validity period */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <InputRow label="Valable du (optionnel)" value={form.startsAt} onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))} type="datetime-local" />
              <InputRow label="Jusqu'au (optionnel)" value={form.endsAt} onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))} type="datetime-local" />
            </div>

            {/* CONDITIONS */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span>SI</span>
                <select
                  value={form.conditionRoot.logic}
                  onChange={(e) => setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, logic: e.target.value as "AND" | "OR" } }))}
                  style={{ padding: "4px 8px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 12, fontWeight: 700 }}
                >
                  <option value="AND">TOUTES ces conditions (ET)</option>
                  <option value="OR">L&apos;UNE de ces conditions (OU)</option>
                </select>
                <span>sont remplies :</span>
              </div>

              {form.conditionRoot.conditions.map((cond, idx) => (
                <div key={cond.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={cond.field}
                    onChange={(e) => {
                      const newConds = [...form.conditionRoot.conditions];
                      newConds[idx] = { ...cond, field: e.target.value as ShippingRuleCondition["field"] };
                      setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, conditions: newConds } }));
                    }}
                    style={selectStyle}
                  >
                    {CONDITION_FIELDS.map((cf) => <option key={cf.value} value={cf.value}>{cf.label}</option>)}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => {
                      const newConds = [...form.conditionRoot.conditions];
                      newConds[idx] = { ...cond, operator: e.target.value as ShippingRuleCondition["operator"] };
                      setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, conditions: newConds } }));
                    }}
                    style={{ ...selectStyle, width: 180 }}
                  >
                    {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  <input
                    value={String(cond.value ?? "")}
                    onChange={(e) => {
                      const newConds = [...form.conditionRoot.conditions];
                      const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                      newConds[idx] = { ...cond, value: val };
                      setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, conditions: newConds } }));
                    }}
                    placeholder="Valeur"
                    style={{ ...inputStyle, width: 120 }}
                  />
                  <button onClick={() => {
                    const newConds = form.conditionRoot.conditions.filter((_, i) => i !== idx);
                    setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, conditions: newConds } }));
                  }} style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, cursor: "pointer", color: T.danger, fontSize: 12 }}>✕</button>
                </div>
              ))}
              <SecondaryBtn onClick={() => setForm((f) => ({ ...f, conditionRoot: { ...f.conditionRoot, conditions: [...f.conditionRoot.conditions, newCondition()] } }))}>+ Condition</SecondaryBtn>
            </div>

            {/* ACTIONS */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>ALORS :</div>
              {form.actions.map((action, idx) => (
                <div key={action.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={action.type}
                    onChange={(e) => {
                      const newActions = [...form.actions];
                      newActions[idx] = { ...action, type: e.target.value as ShippingRuleAction["type"] };
                      setForm((f) => ({ ...f, actions: newActions }));
                    }}
                    style={selectStyle}
                  >
                    {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  {!["set_free", "hide_method", "hide_all_except"].includes(action.type) && (
                    <input
                      value={String(action.value ?? "")}
                      onChange={(e) => {
                        const newActions = [...form.actions];
                        const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                        newActions[idx] = { ...action, value: val };
                        setForm((f) => ({ ...f, actions: newActions }));
                      }}
                      placeholder="Valeur (€, %, jours…)"
                      style={{ ...inputStyle, width: 180 }}
                    />
                  )}
                  <button onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }))} style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, cursor: "pointer", color: T.danger, fontSize: 12 }}>✕</button>
                </div>
              ))}
              <SecondaryBtn onClick={() => setForm((f) => ({ ...f, actions: [...f.actions, newAction()] }))}>+ Action</SecondaryBtn>
            </div>

            {/* Options */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                ["isActive", "Règle active"],
                ["stopProcessingAfterMatch", "Arrêter après cette règle"],
                ["combinableWithOtherRules", "Combinable avec d'autres règles"],
              ].map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={Boolean(form[k as keyof RuleFormState])} onChange={(e) => { const key = k as keyof RuleFormState; setForm((f) => ({ ...f, [key]: e.target.checked })); }} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <PrimaryBtn onClick={() => void handleSave()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la règle"}</PrimaryBtn>
              <SecondaryBtn onClick={closeForm}>Annuler</SecondaryBtn>
            </div>
          </AdminCard>
        )}

        {/* Rules list */}
        <AdminCard>
          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Priorité", "Règle", "Conditions", "Actions", "Statut", "Opérations"]} />
              <tbody>
                {rules.length === 0 && (
                  <tr><td colSpan={6}><AdminEmptyState title="Aucune règle" subtitle="Créez votre première règle d'expédition ou utilisez un template" /></td></tr>
                )}
                {rules.sort((a, b) => a.priority - b.priority).map((r) => (
                  <tr key={r.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: T.info, width: 70 }}>#{r.priority}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                      {r.name}
                      {r.description && <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 400 }}>{r.description}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                      {r.conditionRoot.conditions.length} condition{r.conditionRoot.conditions.length > 1 ? "s" : ""} ({r.conditionRoot.logic})
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                      {r.actions.length} action{r.actions.length > 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge label={r.isActive ? "Active" : "Inactive"} variant={r.isActive ? "success" : "neutral"} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <SecondaryBtn onClick={() => openEdit(r)}>Modifier</SecondaryBtn>
                        <SecondaryBtn onClick={() => void toggleActive(r)}>{r.isActive ? "Désactiver" : "Activer"}</SecondaryBtn>
                        <DangerBtn onClick={() => void handleDelete(r.id)}>Supprimer</DangerBtn>
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

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, fontSize: 13, outline: "none", background: "#fff",
  boxSizing: "border-box", flex: 1,
};

const selectStyle: React.CSSProperties = { ...inputStyle, flex: 1 };

function LabelRow({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textSecondary, display: "block", marginBottom: 6 }}>{children}</label>;
}

function InputRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <LabelRow>{label}</LabelRow>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
    </div>
  );
}
