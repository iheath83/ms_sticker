"use client";

import { useState, useTransition } from "react";
import {
  AdminTopbar,
  AdminCard,
  T,
} from "@/components/admin/admin-ui";
import type {
  StickerShape,
  StickerSize,
  StickerMaterial,
  StickerLamination,
  StickerCutType,
} from "@/db/schema";
import {
  createStickerShape, updateStickerShape, deleteStickerShape,
  createStickerSize, updateStickerSize, deleteStickerSize,
  createStickerMaterial, updateStickerMaterial, deleteStickerMaterial,
  createStickerLamination, updateStickerLamination, deleteStickerLamination,
  createStickerCutType, updateStickerCutType, deleteStickerCutType,
} from "@/lib/sticker-catalog-actions";
import { useRouter } from "next/navigation";

type Tab = "shapes" | "sizes" | "materials" | "laminations" | "cut_types";

const TABS: { id: Tab; label: string }[] = [
  { id: "shapes", label: "Formes" },
  { id: "sizes", label: "Tailles" },
  { id: "materials", label: "Matières" },
  { id: "laminations", label: "Laminations" },
  { id: "cut_types", label: "Types de découpe" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm,
  fontSize: 14,
  color: T.textPrimary,
  background: "#fff",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 4,
};

type ModType = "none" | "fixed" | "percentage" | "multiplier";

function ModifierRow({
  type,
  value,
  onType,
  onValue,
}: {
  type: ModType;
  value: number;
  onType: (t: ModType) => void;
  onValue: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select
        value={type}
        onChange={(e) => onType(e.target.value as ModType)}
        style={{ ...inputStyle, maxWidth: 160 }}
      >
        <option value="none">Aucun modificateur</option>
        <option value="multiplier">Multiplicateur (×)</option>
        <option value="percentage">Pourcentage (+%)</option>
        <option value="fixed">Fixe (+ € cts)</option>
      </select>
      {type !== "none" && (
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onValue(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, maxWidth: 100 }}
          placeholder={type === "multiplier" ? "1.15" : type === "percentage" ? "10" : "500"}
        />
      )}
    </div>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: active ? T.successBg : T.dangerBg,
        color: active ? T.success : T.danger,
      }}
    >
      {active ? "Actif" : "Inactif"}
    </span>
  );
}

function ActionBtn({
  onClick,
  danger,
  children,
  disabled,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 12px",
        borderRadius: T.radiusSm,
        border: `1.5px solid ${danger ? T.danger : T.border}`,
        background: danger ? T.dangerBg : "#fff",
        color: danger ? T.danger : T.textPrimary,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ─── Shapes Tab ──────────────────────────────────────────────────────────────

function ShapesTab({ items }: { items: StickerShape[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    isStandardShape: true,
    requiresCutPath: false,
    priceModifierType: "none" as ModType,
    priceModifierValue: 1,
    isActive: true,
    position: 0,
  });

  async function handleAdd() {
    startTransition(async () => {
      await createStickerShape({ ...form, description: form.description || null, iconSvg: null });
      router.refresh();
      setAdding(false);
      setForm({ code: "", name: "", description: "", isStandardShape: true, requiresCutPath: false, priceModifierType: "none", priceModifierValue: 1, isActive: true, position: 0 });
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette forme ?")) return;
    startTransition(async () => {
      await deleteStickerShape(id);
      router.refresh();
    });
  }

  async function handleToggle(item: StickerShape) {
    startTransition(async () => {
      await updateStickerShape(item.id, { isActive: !item.isActive });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setAdding(!adding)}
          style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Ajouter une forme
        </button>
      </div>

      {adding && (
        <AdminCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Code (ex: round)</label>
              <input style={inputStyle} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") }))} placeholder="round" />
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rond" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Modificateur de prix</label>
              <ModifierRow
                type={form.priceModifierType}
                value={form.priceModifierValue}
                onType={(t) => setForm((f) => ({ ...f, priceModifierType: t }))}
                onValue={(v) => setForm((f) => ({ ...f, priceModifierValue: v }))}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Options</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={form.requiresCutPath} onChange={(e) => setForm((f) => ({ ...f, requiresCutPath: e.target.checked }))} />
                Nécessite tracé de découpe
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={form.isStandardShape} onChange={(e) => setForm((f) => ({ ...f, isStandardShape: e.target.checked }))} />
                Forme standard
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleAdd}
              disabled={pending || !form.code || !form.name}
              style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Enregistrer
            </button>
            <ActionBtn onClick={() => setAdding(false)}>Annuler</ActionBtn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <AdminCard key={item.id}>
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
                    ×{item.priceModifierValue} ({item.priceModifierType})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn onClick={() => handleToggle(item)} disabled={pending}>
                  {item.isActive ? "Désactiver" : "Activer"}
                </ActionBtn>
                <ActionBtn danger onClick={() => handleDelete(item.id)} disabled={pending}>
                  Supprimer
                </ActionBtn>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

// ─── Sizes Tab ───────────────────────────────────────────────────────────────

function SizesTab({ items }: { items: StickerSize[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", widthMm: 50, heightMm: 50, isActive: true, position: 0 });

  async function handleAdd() {
    startTransition(async () => {
      await createStickerSize({ ...form, isPreset: true });
      router.refresh();
      setAdding(false);
      setForm({ label: "", widthMm: 50, heightMm: 50, isActive: true, position: 0 });
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette taille ?")) return;
    startTransition(async () => {
      await deleteStickerSize(id);
      router.refresh();
    });
  }

  async function handleToggle(item: StickerSize) {
    startTransition(async () => {
      await updateStickerSize(item.id, { isActive: !item.isActive });
      router.refresh();
    });
  }

  const autoLabel = `${form.widthMm / 10} × ${form.heightMm / 10} cm`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setAdding(!adding)}
          style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Ajouter une taille
        </button>
      </div>

      {adding && (
        <AdminCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Largeur (mm)</label>
              <input type="number" style={inputStyle} value={form.widthMm} onChange={(e) => setForm((f) => ({ ...f, widthMm: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={labelStyle}>Hauteur (mm)</label>
              <input type="number" style={inputStyle} value={form.heightMm} onChange={(e) => setForm((f) => ({ ...f, heightMm: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={labelStyle}>Label (optionnel)</label>
              <input style={inputStyle} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={autoLabel} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleAdd}
              disabled={pending || form.widthMm <= 0 || form.heightMm <= 0}
              style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Enregistrer
            </button>
            <ActionBtn onClick={() => setAdding(false)}>Annuler</ActionBtn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: T.surface,
              border: `1.5px solid ${T.border}`,
              borderRadius: T.radius,
              padding: "12px 16px",
              minWidth: 140,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: item.isActive ? 1 : 0.5,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>{item.widthMm} × {item.heightMm} mm</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <ActionBtn onClick={() => handleToggle(item)} disabled={pending}>
                {item.isActive ? "Off" : "On"}
              </ActionBtn>
              <ActionBtn danger onClick={async () => {
                if (!confirm("Supprimer ?")) return;
                startTransition(async () => { await deleteStickerSize(item.id); router.refresh(); });
              }} disabled={pending}>
                ✕
              </ActionBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic catalog tab (materials, laminations, cut types) ─────────────────

interface GenericItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceModifierType: string;
  priceModifierValue: number;
  isActive: boolean;
}

function GenericCatalogTab<T extends GenericItem>({
  items,
  entityLabel,
  codePlaceholder,
  namePlaceholder,
  extraFields,
  onCreate,
  onToggle,
  onDelete,
  pending,
}: {
  items: T[];
  entityLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
  extraFields?: (form: Record<string, unknown>, setForm: (fn: (f: Record<string, unknown>) => Record<string, unknown>) => void) => React.ReactNode;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onToggle: (item: T) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  pending: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({
    code: "",
    name: "",
    description: "",
    priceModifierType: "none",
    priceModifierValue: 1,
    isActive: true,
    position: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setAdding(!adding)}
          style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Ajouter {entityLabel}
        </button>
      </div>

      {adding && (
        <AdminCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Code</label>
              <input style={inputStyle} value={form.code as string} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") }))} placeholder={codePlaceholder} />
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input style={inputStyle} value={form.name as string} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={namePlaceholder} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={form.description as string} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Modificateur de prix</label>
              <ModifierRow
                type={form.priceModifierType as ModType}
                value={form.priceModifierValue as number}
                onType={(t) => setForm((f) => ({ ...f, priceModifierType: t }))}
                onValue={(v) => setForm((f) => ({ ...f, priceModifierValue: v }))}
              />
            </div>
            {extraFields && extraFields(form, setForm)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onCreate(form).then(() => { setAdding(false); setForm({ code: "", name: "", description: "", priceModifierType: "none", priceModifierValue: 1, isActive: true, position: 0 }); })}
              disabled={pending || !(form.code as string) || !(form.name as string)}
              style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.brand, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Enregistrer
            </button>
            <ActionBtn onClick={() => setAdding(false)}>Annuler</ActionBtn>
          </div>
        </AdminCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <AdminCard key={item.id}>
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
                    ×{item.priceModifierValue} ({item.priceModifierType})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn onClick={() => onToggle(item)} disabled={pending}>
                  {item.isActive ? "Désactiver" : "Activer"}
                </ActionBtn>
                <ActionBtn danger onClick={() => {
                  if (!confirm(`Supprimer "${item.name}" ?`)) return;
                  onDelete(item.id);
                }} disabled={pending}>
                  Supprimer
                </ActionBtn>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function StickerCatalogClient({
  shapes,
  sizes,
  materials,
  laminations,
  cutTypes,
}: {
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
  cutTypes: StickerCutType[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("shapes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <AdminTopbar title="Catalogue sticker" subtitle="Gérez globalement les formes, tailles, matières, laminations et types de découpe" />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: T.surface, borderRadius: T.radius, padding: 4, border: `1.5px solid ${T.border}` }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: T.radiusSm,
                border: "none",
                background: activeTab === tab.id ? T.brand : "transparent",
                color: activeTab === tab.id ? "#fff" : T.textSecondary,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "shapes" && <ShapesTab items={shapes} />}
        {activeTab === "sizes" && <SizesTab items={sizes} />}
        {activeTab === "materials" && (
          <GenericCatalogTab
            items={materials}
            entityLabel="une matière"
            codePlaceholder="vinyl_white"
            namePlaceholder="Vinyle blanc"
            onCreate={(data) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await createStickerMaterial(data as Parameters<typeof createStickerMaterial>[0]);
                  router.refresh();
                  resolve();
                })
              )
            }
            onToggle={(item) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await updateStickerMaterial(item.id, { isActive: !item.isActive });
                  router.refresh();
                  resolve();
                })
              )
            }
            onDelete={(id) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await deleteStickerMaterial(id);
                  router.refresh();
                  resolve();
                })
              )
            }
            pending={pending}
            extraFields={(form, setForm) => (
              <div style={{ gridColumn: "span 2", display: "flex", gap: 16 }}>
                {(["isWaterproof", "isOutdoorCompatible", "isTransparent", "isPremium"] as const).map((key) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={!!form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                    {key === "isWaterproof" ? "Imperméable" : key === "isOutdoorCompatible" ? "Usage extérieur" : key === "isTransparent" ? "Transparent" : "Premium"}
                  </label>
                ))}
              </div>
            )}
          />
        )}
        {activeTab === "laminations" && (
          <GenericCatalogTab
            items={laminations}
            entityLabel="une lamination"
            codePlaceholder="matte"
            namePlaceholder="Mat"
            onCreate={(data) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await createStickerLamination(data as Parameters<typeof createStickerLamination>[0]);
                  router.refresh();
                  resolve();
                })
              )
            }
            onToggle={(item) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await updateStickerLamination(item.id, { isActive: !item.isActive });
                  router.refresh();
                  resolve();
                })
              )
            }
            onDelete={(id) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await deleteStickerLamination(id);
                  router.refresh();
                  resolve();
                })
              )
            }
            pending={pending}
          />
        )}
        {activeTab === "cut_types" && (
          <GenericCatalogTab
            items={cutTypes}
            entityLabel="un type de découpe"
            codePlaceholder="die_cut"
            namePlaceholder="Découpe à la forme"
            onCreate={(data) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await createStickerCutType(data as Parameters<typeof createStickerCutType>[0]);
                  router.refresh();
                  resolve();
                })
              )
            }
            onToggle={(item) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await updateStickerCutType(item.id, { isActive: !item.isActive });
                  router.refresh();
                  resolve();
                })
              )
            }
            onDelete={(id) =>
              new Promise<void>((resolve) =>
                startTransition(async () => {
                  await deleteStickerCutType(id);
                  router.refresh();
                  resolve();
                })
              )
            }
            pending={pending}
            extraFields={(form, setForm) => (
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={!!form.requiresCutPath} onChange={(e) => setForm((f) => ({ ...f, requiresCutPath: e.target.checked }))} />
                  Nécessite tracé de découpe
                </label>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
