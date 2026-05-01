"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProductFamily, updateProductFamily, deleteProductFamily } from "@/lib/product-family-actions";
import { AdminTopbar, AdminCard, T } from "@/components/admin/admin-ui";
import type { ProductFamily } from "@/db/schema";

const iS: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 14, color: T.textPrimary, background: "#fff", boxSizing: "border-box",
};
const lS: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: T.textSecondary,
  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4,
};

type FamilyForm = { slug: string; label: string; description: string; icon: string; active: boolean; sortOrder: number };
const EMPTY: FamilyForm = { slug: "", label: "", description: "", icon: "", active: true, sortOrder: 0 };

function FamilyFormFields({ form, setForm, isEdit }: {
  form: FamilyForm;
  setForm: (fn: (f: FamilyForm) => FamilyForm) => void;
  isEdit?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {!isEdit && (
        <div>
          <label style={lS}>Slug (identifiant)</label>
          <input style={iS} value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
            placeholder="sticker_vinyle" />
        </div>
      )}
      <div>
        <label style={lS}>Nom affiché</label>
        <input style={iS} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Sticker vinyle" />
      </div>
      <div style={{ gridColumn: isEdit ? "span 1" : "span 2" }}>
        <label style={lS}>Description (optionnel)</label>
        <input style={iS} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div>
        <label style={lS}>Icône (emoji)</label>
        <input style={{ ...iS, maxWidth: 80 }} value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🏷️" />
      </div>
      <div>
        <label style={lS}>Ordre d'affichage</label>
        <input type="number" style={iS} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
      </div>
      {isEdit && (
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Actif
          </label>
        </div>
      )}
    </div>
  );
}

export function ProductFamiliesClient({ families }: { families: ProductFamily[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<FamilyForm>(EMPTY);
  const [editForm, setEditForm] = useState<FamilyForm>(EMPTY);

  function startEdit(fam: ProductFamily) {
    setEditingId(fam.id);
    setEditForm({ slug: fam.slug, label: fam.label, description: fam.description ?? "", icon: fam.icon ?? "", active: fam.active, sortOrder: fam.sortOrder });
  }

  function handleAdd() {
    startTransition(async () => {
      await createProductFamily({
        ...addForm,
        description: addForm.description || null,
        icon: addForm.icon || null,
      });
      router.refresh(); setAdding(false); setAddForm(EMPTY);
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    startTransition(async () => {
      await updateProductFamily(editingId, {
        ...editForm,
        description: editForm.description || null,
        icon: editForm.icon || null,
      });
      router.refresh(); setEditingId(null);
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Supprimer la famille "${label}" ? Les produits associés ne seront pas supprimés.`)) return;
    startTransition(async () => { await deleteProductFamily(id); router.refresh(); });
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <AdminTopbar title="Familles de produit" subtitle="Catégorisez vos produits (sticker, étiquette, pack…)">
        <button
          onClick={() => { setAdding(true); setAddForm(EMPTY); }}
          style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Nouvelle famille
        </button>
      </AdminTopbar>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {adding && (
          <AdminCard style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: "uppercase" }}>
              Nouvelle famille
            </h3>
            <FamilyFormFields form={addForm} setForm={setAddForm} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={handleAdd}
                disabled={pending || !addForm.slug || !addForm.label}
                style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Enregistrer
              </button>
              <button onClick={() => setAdding(false)} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textSecondary, fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </AdminCard>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {families.map((fam) => (
            <AdminCard key={fam.id}>
              {editingId === fam.id ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: "uppercase" }}>
                    Modifier : <code style={{ background: T.bg, padding: "1px 5px", borderRadius: 4 }}>{fam.slug}</code>
                  </div>
                  <FamilyFormFields form={editForm} setForm={setEditForm} isEdit />
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button
                      onClick={handleUpdate}
                      disabled={pending || !editForm.label}
                      style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Enregistrer
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textSecondary, fontSize: 13, cursor: "pointer" }}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    {fam.icon && <span style={{ fontSize: 24 }}>{fam.icon}</span>}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{fam.label}</span>
                        {!fam.active && (
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: T.dangerBg, color: T.danger, fontWeight: 600 }}>Inactif</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                        <code style={{ background: T.bg, padding: "1px 5px", borderRadius: 4 }}>{fam.slug}</code>
                        {fam.description && <span> · {fam.description}</span>}
                        <span style={{ marginLeft: 8 }}>ordre : {fam.sortOrder}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startEdit(fam)}
                      disabled={pending}
                      style={{ padding: "5px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textPrimary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(fam.id, fam.label)}
                      disabled={pending}
                      style={{ padding: "5px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger}`, background: T.dangerBg, color: T.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </AdminCard>
          ))}
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: T.textSecondary }}>
          Le slug est utilisé en base de données — il ne peut pas être modifié après création.
          Supprimer une famille ne supprime pas les produits associés.
        </p>
      </div>
    </div>
  );
}
