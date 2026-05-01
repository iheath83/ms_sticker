"use client";

import { useState, useTransition } from "react";
import { AdminTopbar, AdminCard, T } from "@/components/admin/admin-ui";
import type { StickerShape, StickerSize, StickerMaterial, StickerLamination } from "@/db/schema";
import {
  createStickerShape, updateStickerShape, deleteStickerShape,
  createStickerSize, updateStickerSize, deleteStickerSize,
  createStickerMaterial, updateStickerMaterial, deleteStickerMaterial,
  createStickerLamination, updateStickerLamination, deleteStickerLamination,
} from "@/lib/sticker-catalog-actions";
import { useRouter } from "next/navigation";

type Tab = "shapes" | "sizes" | "materials" | "laminations";

const TABS: { id: Tab; label: string }[] = [
  { id: "shapes",     label: "Formes" },
  { id: "sizes",      label: "Tailles" },
  { id: "materials",  label: "Matières" },
  { id: "laminations",label: "Laminations" },
];

const iS: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 14, color: T.textPrimary, background: "#fff", boxSizing: "border-box",
};
const lS: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: T.textSecondary,
  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4,
};

type ModType = "none" | "fixed" | "percentage" | "multiplier";

function ModifierRow({ type, value, onType, onValue }: {
  type: ModType; value: number;
  onType: (t: ModType) => void; onValue: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={type} onChange={(e) => onType(e.target.value as ModType)} style={{ ...iS, maxWidth: 180 }}>
        <option value="none">Aucun modificateur</option>
        <option value="multiplier">Multiplicateur (×)</option>
        <option value="percentage">Pourcentage (+%)</option>
        <option value="fixed">Fixe (+ € cts)</option>
      </select>
      {type !== "none" && (
        <input type="number" step="0.01" value={value}
          onChange={(e) => onValue(parseFloat(e.target.value) || 0)}
          style={{ ...iS, maxWidth: 100 }}
          placeholder={type === "multiplier" ? "1.15" : type === "percentage" ? "10" : "500"} />
      )}
    </div>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: active ? T.successBg : T.dangerBg, color: active ? T.success : T.danger }}>
      {active ? "Actif" : "Inactif"}
    </span>
  );
}

function Btn({ onClick, danger, disabled, children }: {
  onClick: () => void; danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "5px 12px", borderRadius: T.radiusSm,
      border: `1.5px solid ${danger ? T.danger : T.border}`,
      background: danger ? T.dangerBg : "#fff",
      color: danger ? T.danger : T.textPrimary,
      fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

function SaveBtn({ onClick, disabled, children = "Enregistrer" }: { onClick: () => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "7px 16px", borderRadius: T.radiusSm, border: "none",
      background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  );
}

// ─── Shapes Tab ──────────────────────────────────────────────────────────────

type ShapeForm = {
  code: string; name: string; description: string;
  isStandardShape: boolean; requiresCutPath: boolean;
  priceModifierType: ModType; priceModifierValue: number;
  isActive: boolean; position: number;
};

const EMPTY_SHAPE: ShapeForm = {
  code: "", name: "", description: "", isStandardShape: true, requiresCutPath: false,
  priceModifierType: "none", priceModifierValue: 1, isActive: true, position: 0,
};

function ShapeFormFields({ form, setForm, isEdit }: {
  form: ShapeForm;
  setForm: (fn: (f: ShapeForm) => ShapeForm) => void;
  isEdit?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {!isEdit && (
        <div>
          <label style={lS}>Code (ex: round)</label>
          <input style={iS} value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
            placeholder="round" />
        </div>
      )}
      <div>
        <label style={lS}>Nom</label>
        <input style={iS} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rond" />
      </div>
      <div style={{ gridColumn: isEdit ? "span 1" : "span 2" }}>
        <label style={lS}>Description</label>
        <input style={iS} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={lS}>Modificateur de prix</label>
        <ModifierRow type={form.priceModifierType} value={form.priceModifierValue}
          onType={(t) => setForm((f) => ({ ...f, priceModifierType: t }))}
          onValue={(v) => setForm((f) => ({ ...f, priceModifierValue: v }))} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.requiresCutPath}
            onChange={(e) => setForm((f) => ({ ...f, requiresCutPath: e.target.checked }))} />
          Tracé de découpe requis
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.isStandardShape}
            onChange={(e) => setForm((f) => ({ ...f, isStandardShape: e.target.checked }))} />
          Forme standard
        </label>
        {isEdit && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Actif
          </label>
        )}
      </div>
      <div>
        <label style={lS}>Ordre</label>
        <input type="number" style={iS} value={form.position}
          onChange={(e) => setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))} />
      </div>
    </div>
  );
}

function ShapesTab({ items }: { items: StickerShape[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<ShapeForm>(EMPTY_SHAPE);
  const [editForm, setEditForm] = useState<ShapeForm>(EMPTY_SHAPE);

  function startEdit(item: StickerShape) {
    setEditingId(item.id);
    setEditForm({
      code: item.code, name: item.name, description: item.description ?? "",
      isStandardShape: item.isStandardShape, requiresCutPath: item.requiresCutPath,
      priceModifierType: item.priceModifierType as ModType,
      priceModifierValue: item.priceModifierValue, isActive: item.isActive, position: item.position,
    });
  }

  function handleAdd() {
    startTransition(async () => {
      await createStickerShape({ ...addForm, description: addForm.description || null, iconSvg: null });
      router.refresh(); setAdding(false); setAddForm(EMPTY_SHAPE);
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    startTransition(async () => {
      await updateStickerShape(editingId, { ...editForm, description: editForm.description || null });
      router.refresh(); setEditingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    startTransition(async () => { await deleteStickerShape(id); router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn onClick={() => setAdding(!adding)}>+ Ajouter une forme</SaveBtn>
      </div>

      {adding && (
        <AdminCard>
          <ShapeFormFields form={addForm} setForm={setAddForm} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <SaveBtn onClick={handleAdd} disabled={pending || !addForm.code || !addForm.name}>Enregistrer</SaveBtn>
            <Btn onClick={() => setAdding(false)}>Annuler</Btn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <AdminCard key={item.id}>
            {editingId === item.id ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: "uppercase" }}>
                  Modifier : {item.code}
                </div>
                <ShapeFormFields form={editForm} setForm={setEditForm} isEdit />
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <SaveBtn onClick={handleUpdate} disabled={pending || !editForm.name}>Enregistrer</SaveBtn>
                  <Btn onClick={() => setEditingId(null)}>Annuler</Btn>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
                    <Badge active={item.isActive} />
                    {item.requiresCutPath && (
                      <span style={{ fontSize: 11, padding: "2px 6px", background: T.warningBg, color: T.warning, borderRadius: 10, fontWeight: 600 }}>Tracé requis</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>{item.code}</span>
                  {item.description && <span style={{ fontSize: 12, color: T.textSecondary }}> · {item.description}</span>}
                  {item.priceModifierType !== "none" && (
                    <span style={{ fontSize: 12, color: T.info, marginLeft: 8 }}>
                      {item.priceModifierType === "multiplier" ? "×" : "+"}
                      {item.priceModifierValue} ({item.priceModifierType})
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => startEdit(item)} disabled={pending}>Modifier</Btn>
                  <Btn danger onClick={() => handleDelete(item.id, item.name)} disabled={pending}>Supprimer</Btn>
                </div>
              </div>
            )}
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

// ─── Sizes Tab ───────────────────────────────────────────────────────────────

type SizeForm = { label: string; widthMm: number; heightMm: number; isActive: boolean; position: number; priceCents: string };
const EMPTY_SIZE: SizeForm = { label: "", widthMm: 50, heightMm: 50, isActive: true, position: 0, priceCents: "" };

function SizesTab({ items }: { items: StickerSize[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<SizeForm>(EMPTY_SIZE);
  const [editForm, setEditForm] = useState<SizeForm>(EMPTY_SIZE);

  function startEdit(item: StickerSize) {
    setEditingId(item.id);
    setEditForm({
      label: item.label, widthMm: item.widthMm, heightMm: item.heightMm,
      isActive: item.isActive, position: item.position,
      priceCents: item.priceCents != null ? (item.priceCents / 100).toFixed(2) : "",
    });
  }

  function parsePriceCents(val: string): number | null {
    const n = parseFloat(val);
    return val.trim() === "" || isNaN(n) ? null : Math.round(n * 100);
  }

  function handleAdd() {
    startTransition(async () => {
      await createStickerSize({
        ...addForm, isPreset: true,
        label: addForm.label || `${addForm.widthMm / 10} × ${addForm.heightMm / 10} cm`,
        priceCents: parsePriceCents(addForm.priceCents),
      });
      router.refresh(); setAdding(false); setAddForm(EMPTY_SIZE);
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    startTransition(async () => {
      await updateStickerSize(editingId, { ...editForm, priceCents: parsePriceCents(editForm.priceCents) });
      router.refresh(); setEditingId(null);
    });
  }

  function SizeFields({ form, setForm }: { form: SizeForm; setForm: (fn: (f: SizeForm) => SizeForm) => void }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={lS}>Largeur (mm)</label>
          <input type="number" style={iS} value={form.widthMm} onChange={(e) => setForm((f) => ({ ...f, widthMm: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <label style={lS}>Hauteur (mm)</label>
          <input type="number" style={iS} value={form.heightMm} onChange={(e) => setForm((f) => ({ ...f, heightMm: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <label style={lS}>Label</label>
          <input style={iS} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder={`${form.widthMm / 10} × ${form.heightMm / 10} cm`} />
        </div>
        <div>
          <label style={lS}>Prix fixe HT (€)</label>
          <input type="number" step="0.01" min="0" style={iS} value={form.priceCents}
            onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
            placeholder="Laisser vide = calcul auto" />
          <p style={{ fontSize: 10, color: "#9CA3AF", margin: "3px 0 0" }}>Prioritaire sur le mode cm² / unitaire</p>
        </div>
        <div>
          <label style={lS}>Ordre</label>
          <input type="number" style={iS} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn onClick={() => setAdding(!adding)}>+ Ajouter une taille</SaveBtn>
      </div>

      {adding && (
        <AdminCard>
          <SizeFields form={addForm} setForm={setAddForm} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <SaveBtn onClick={handleAdd} disabled={pending || addForm.widthMm <= 0 || addForm.heightMm <= 0}>Enregistrer</SaveBtn>
            <Btn onClick={() => setAdding(false)}>Annuler</Btn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <AdminCard key={item.id}>
            {editingId === item.id ? (
              <>
                <SizeFields form={editForm} setForm={setEditForm} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 10 }}>
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  Actif
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <SaveBtn onClick={handleUpdate} disabled={pending}>Enregistrer</SaveBtn>
                  <Btn onClick={() => setEditingId(null)}>Annuler</Btn>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</span>
                    <Badge active={item.isActive} />
                  </div>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>
                    {item.widthMm} × {item.heightMm} mm · ordre {item.position}
                    {item.priceCents != null && (
                      <> · <span style={{ color: "#059669", fontWeight: 600 }}>Prix fixe : {(item.priceCents / 100).toFixed(2)} €</span></>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => startEdit(item)} disabled={pending}>Modifier</Btn>
                  <Btn danger onClick={() => {
                    if (!confirm(`Supprimer "${item.label}" ?`)) return;
                    startTransition(async () => { await deleteStickerSize(item.id); router.refresh(); });
                  }} disabled={pending}>Supprimer</Btn>
                </div>
              </div>
            )}
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

// ─── Generic catalog tab (materials, laminations, cut types) ─────────────────

interface GenericItem {
  id: string; code: string; name: string; description?: string | null;
  priceModifierType: string; priceModifierValue: number; isActive: boolean;
}

type GenericForm = {
  code: string; name: string; description: string;
  priceModifierType: ModType; priceModifierValue: number;
  isActive: boolean; position: number;
  [key: string]: unknown;
};

const EMPTY_GENERIC: GenericForm = {
  code: "", name: "", description: "", priceModifierType: "none",
  priceModifierValue: 1, isActive: true, position: 0,
};

function GenericFormFields({ form, setForm, isEdit, extraFields }: {
  form: GenericForm;
  setForm: (fn: (f: GenericForm) => GenericForm) => void;
  isEdit?: boolean;
  extraFields?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {!isEdit && (
        <div>
          <label style={lS}>Code</label>
          <input style={iS} value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))} />
        </div>
      )}
      <div>
        <label style={lS}>Nom</label>
        <input style={iS} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div style={{ gridColumn: isEdit ? "span 1" : "span 2" }}>
        <label style={lS}>Description</label>
        <input style={iS} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={lS}>Modificateur de prix</label>
        <ModifierRow type={form.priceModifierType} value={form.priceModifierValue}
          onType={(t) => setForm((f) => ({ ...f, priceModifierType: t }))}
          onValue={(v) => setForm((f) => ({ ...f, priceModifierValue: v }))} />
      </div>
      <div>
        <label style={lS}>Ordre</label>
        <input type="number" style={iS} value={form.position as number}
          onChange={(e) => setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))} />
      </div>
      {isEdit && (
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Actif
          </label>
        </div>
      )}
      {extraFields}
    </div>
  );
}

function GenericCatalogTab<T extends GenericItem>({
  items, entityLabel, codePlaceholder, namePlaceholder,
  extraFields,
  onCreate, onUpdate, onDelete, pending,
}: {
  items: T[];
  entityLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
  extraFields?: (form: GenericForm, setForm: (fn: (f: GenericForm) => GenericForm) => void) => React.ReactNode;
  onCreate: (data: GenericForm) => Promise<void>;
  onUpdate: (id: string, data: Partial<GenericForm>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  pending: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<GenericForm>({ ...EMPTY_GENERIC, code: codePlaceholder.toLowerCase().replace(/\s/g, "_") });
  const [editForm, setEditForm] = useState<GenericForm>(EMPTY_GENERIC);

  function startEdit(item: T) {
    setEditingId(item.id);
    setEditForm({
      ...EMPTY_GENERIC,
      code: item.code, name: item.name, description: item.description ?? "",
      priceModifierType: item.priceModifierType as ModType,
      priceModifierValue: item.priceModifierValue, isActive: item.isActive,
      position: (item as { position?: number }).position ?? 0,
      // spread any extra fields from the item
      ...Object.fromEntries(
        Object.entries(item).filter(([k]) => !["id","code","name","description","priceModifierType","priceModifierValue","isActive","position","createdAt","updatedAt"].includes(k))
      ),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn onClick={() => { setAdding(!adding); setAddForm({ ...EMPTY_GENERIC }); }}>
          + Ajouter {entityLabel}
        </SaveBtn>
      </div>

      {adding && (
        <AdminCard>
          <GenericFormFields
            form={addForm}
            setForm={setAddForm}
            extraFields={extraFields ? extraFields(addForm, setAddForm) : undefined}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <SaveBtn onClick={() => onCreate(addForm).then(() => { setAdding(false); setAddForm({ ...EMPTY_GENERIC }); })}
              disabled={pending || !addForm.code || !addForm.name}>
              Enregistrer
            </SaveBtn>
            <Btn onClick={() => setAdding(false)}>Annuler</Btn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <AdminCard key={item.id}>
            {editingId === item.id ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: "uppercase" }}>
                  Modifier : <code style={{ background: T.bg, padding: "1px 5px", borderRadius: 4 }}>{item.code}</code>
                </div>
                <GenericFormFields
                  form={editForm}
                  setForm={setEditForm}
                  isEdit
                  extraFields={extraFields ? extraFields(editForm, setEditForm) : undefined}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <SaveBtn onClick={() => onUpdate(item.id, editForm).then(() => setEditingId(null))}
                    disabled={pending || !editForm.name}>
                    Enregistrer
                  </SaveBtn>
                  <Btn onClick={() => setEditingId(null)}>Annuler</Btn>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
                    <Badge active={item.isActive} />
                  </div>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>{item.code}</span>
                  {item.description && <span style={{ fontSize: 12, color: T.textSecondary }}> · {item.description}</span>}
                  {item.priceModifierType !== "none" && (
                    <span style={{ fontSize: 12, color: T.info, marginLeft: 8 }}>
                      {item.priceModifierType === "multiplier" ? "×" : "+"}{item.priceModifierValue} ({item.priceModifierType})
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => startEdit(item)} disabled={pending}>Modifier</Btn>
                  <Btn danger onClick={() => {
                    if (!confirm(`Supprimer "${item.name}" ?`)) return;
                    onDelete(item.id);
                  }} disabled={pending}>Supprimer</Btn>
                </div>
              </div>
            )}
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function StickerCatalogClient({ shapes, sizes, materials, laminations }: {
  shapes: StickerShape[]; sizes: StickerSize[];
  materials: StickerMaterial[]; laminations: StickerLamination[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("shapes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function wrap<T>(fn: (arg: T) => Promise<unknown>) {
    return (arg: T) => new Promise<void>((resolve) =>
      startTransition(async () => { await fn(arg); router.refresh(); resolve(); })
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <AdminTopbar title="Catalogue sticker" subtitle="Formes, tailles, matières, laminations, types de découpe" />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: T.surface, borderRadius: T.radius, padding: 4, border: `1.5px solid ${T.border}` }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "8px 0", borderRadius: T.radiusSm, border: "none",
              background: activeTab === tab.id ? T.brand : "transparent",
              color: activeTab === tab.id ? "#fff" : T.textSecondary,
              fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "shapes" && <ShapesTab items={shapes} />}
        {activeTab === "sizes" && <SizesTab items={sizes} />}

        {activeTab === "materials" && (
          <GenericCatalogTab
            items={materials} entityLabel="une matière"
            codePlaceholder="vinyl_white" namePlaceholder="Vinyle blanc"
            onCreate={(data) => wrap((d: typeof data) =>
              createStickerMaterial(d as Parameters<typeof createStickerMaterial>[0]))(data)}
            onUpdate={(id, data) => wrap(([i, d]: [string, typeof data]) =>
              updateStickerMaterial(i, d as Parameters<typeof updateStickerMaterial>[1]))([id, data])}
            onDelete={wrap((id: string) => deleteStickerMaterial(id))}
            pending={pending}
            extraFields={(form, setForm) => (
              <div style={{ gridColumn: "span 2", display: "flex", gap: 16, flexWrap: "wrap" }}>
                {(["isWaterproof", "isOutdoorCompatible", "isTransparent", "isPremium"] as const).map((key) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={!!form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                    {key === "isWaterproof" ? "Imperméable" : key === "isOutdoorCompatible" ? "Usage extérieur" : key === "isTransparent" ? "Transparent" : "Premium"}
                  </label>
                ))}
              </div>
            )}
          />
        )}

        {activeTab === "laminations" && (
          <GenericCatalogTab
            items={laminations} entityLabel="une lamination"
            codePlaceholder="matte" namePlaceholder="Mat"
            onCreate={(data) => wrap((d: typeof data) =>
              createStickerLamination(d as Parameters<typeof createStickerLamination>[0]))(data)}
            onUpdate={(id, data) => wrap(([i, d]: [string, typeof data]) =>
              updateStickerLamination(i, d as Parameters<typeof updateStickerLamination>[1]))([id, data])}
            onDelete={wrap((id: string) => deleteStickerLamination(id))}
            pending={pending}
          />
        )}

      </div>
    </div>
  );
}
