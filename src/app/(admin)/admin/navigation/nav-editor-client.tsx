"use client";

import { useState, useTransition } from "react";
import type { NavItemWithChildren } from "@/lib/nav-actions";
import {
  createNavItem,
  updateNavItem,
  deleteNavItem,
  reorderNavItems,
  seedDefaultNav,
} from "@/lib/nav-actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type EditForm = {
  id?: string;
  parentId?: string | null;
  label: string;
  href: string;
  icon: string;
  description: string;
  badge: string;
  openInNewTab: boolean;
  active: boolean;
};

const emptyForm = (): EditForm => ({
  label: "", href: "/", icon: "", description: "",
  badge: "", openInNewTab: false, active: true,
});

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = "var(--font-archivo), system-ui, sans-serif";
const INK = "#0A0E27";
const RED = "#E8391E";
const GREY50 = "#F8F9FB";
const GREY100 = "#ECEEF2";
const GREY400 = "#9BA3AF";
const GREY600 = "#4B5563";
const BLUE = "#2563EB";
const WHITE = "#FFFFFF";

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: WHITE,
  border: `2px solid ${INK}`,
  borderRadius: 10,
  boxShadow: "4px 4px 0 0 " + INK,
  ...extra,
});

const btn = (variant: "primary" | "ghost" | "danger" | "success", extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  border: "1.5px solid",
  borderRadius: 6,
  padding: "6px 14px",
  cursor: "pointer",
  transition: "all .15s",
  ...(variant === "primary"  ? { background: INK,   color: WHITE,    borderColor: INK   } : {}),
  ...(variant === "ghost"    ? { background: WHITE, color: INK,     borderColor: INK   } : {}),
  ...(variant === "danger"   ? { background: WHITE, color: RED,     borderColor: RED   } : {}),
  ...(variant === "success"  ? { background: BLUE,  color: WHITE,   borderColor: BLUE  } : {}),
  ...extra,
});

const input = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT,
  fontSize: 13,
  border: `1.5px solid ${GREY100}`,
  borderRadius: 6,
  padding: "8px 10px",
  width: "100%",
  boxSizing: "border-box" as const,
  outline: "none",
  background: WHITE,
  color: INK,
  ...extra,
});

const label = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: GREY400,
  display: "block",
  marginBottom: 4,
  ...extra,
});

// ── Form panel ────────────────────────────────────────────────────────────────

function FormPanel({
  form,
  parentOptions,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  form: EditForm;
  parentOptions: { id: string; label: string }[];
  onChange: (f: Partial<EditForm>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div style={card({ padding: 24, marginBottom: 20 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK }}>
          {form.id ? "✏️ Modifier le lien" : "➕ Nouveau lien"}
        </span>
        <button style={btn("ghost", { fontSize: 11 })} onClick={onCancel}>Annuler</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Libellé */}
        <div>
          <span style={label()}>Libellé *</span>
          <input style={input()} value={form.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Ex : Produits" />
        </div>
        {/* Lien */}
        <div>
          <span style={label()}>URL *</span>
          <input style={input()} value={form.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="Ex : /products" />
        </div>
        {/* Icône */}
        <div>
          <span style={label()}>Icône (emoji)</span>
          <input style={input()} value={form.icon} onChange={(e) => onChange({ icon: e.target.value })} placeholder="🏷️" maxLength={4} />
        </div>
        {/* Badge */}
        <div>
          <span style={label()}>Badge</span>
          <input style={input()} value={form.badge} onChange={(e) => onChange({ badge: e.target.value })} placeholder="NOUVEAU" />
        </div>
        {/* Description */}
        <div style={{ gridColumn: "span 2" }}>
          <span style={label()}>Description (sous-menu)</span>
          <input style={input()} value={form.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Courte description visible dans le mega-menu" />
        </div>
        {/* Parent */}
        <div>
          <span style={label()}>Parent (sous-lien de...)</span>
          <select
            style={input()}
            value={form.parentId ?? ""}
            onChange={(e) => onChange({ parentId: e.target.value || null })}
          >
            <option value="">— Aucun (niveau racine) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end", paddingBottom: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 500 }}>
            <input type="checkbox" checked={form.openInNewTab} onChange={(e) => onChange({ openInNewTab: e.target.checked })} />
            Ouvrir dans un nouvel onglet
          </label>
          {form.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => onChange({ active: e.target.checked })} />
              Lien actif (visible)
            </label>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={btn("primary")} onClick={onSave} disabled={isPending}>
          {isPending ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer le lien"}
        </button>
      </div>
    </div>
  );
}

// ── Mega-menu preview ─────────────────────────────────────────────────────────

function MegaMenuPreview({ tree }: { tree: NavItemWithChildren[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={card({ padding: 20, marginBottom: 20 })}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: GREY400, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
        Aperçu navigation
      </div>

      <div style={{ background: INK, borderRadius: 8, padding: "12px 24px", display: "flex", gap: 24, alignItems: "center", position: "relative" }}>
        {/* Logo placeholder */}
        <div style={{ width: 32, height: 32, borderRadius: 6, background: RED, display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, fontWeight: 800, fontSize: 12, fontFamily: FONT, flexShrink: 0 }}>MS</div>

        {/* Nav items */}
        <div style={{ display: "flex", gap: 4 }}>
          {tree.filter((n) => n.active).map((node) => (
            <div key={node.id} style={{ position: "relative" }} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}>
              <div style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 600, color: WHITE,
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                background: hovered === node.id && node.children.length > 0 ? "rgba(255,255,255,.1)" : "transparent",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {node.icon && <span>{node.icon}</span>}
                {node.label}
                {node.children.length > 0 && <span style={{ fontSize: 8 }}>▾</span>}
              </div>

              {/* Megamenu dropdown */}
              {hovered === node.id && node.children.filter((c) => c.active).length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0,
                  background: WHITE, border: `2px solid ${INK}`, borderRadius: 10,
                  padding: 12, minWidth: 260, zIndex: 99,
                  boxShadow: `6px 6px 0 0 ${INK}`,
                }}>
                  {node.children.filter((c) => c.active).map((child) => (
                    <div key={child.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "8px 10px", borderRadius: 6,
                      background: "transparent",
                    }}>
                      {child.icon && (
                        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{child.icon}</span>
                      )}
                      <div>
                        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
                          {child.label}
                          {child.badge && (
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", background: RED, color: WHITE, padding: "2px 5px", borderRadius: 4 }}>
                              {child.badge}
                            </span>
                          )}
                        </div>
                        {child.description && (
                          <div style={{ fontFamily: FONT, fontSize: 11, color: GREY600, marginTop: 2 }}>{child.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right side placeholder */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,.15)" }} />
          <div style={{ width: 60, height: 28, borderRadius: 6, background: "rgba(255,255,255,.15)" }} />
        </div>
      </div>
    </div>
  );
}

// ── Nav item row ──────────────────────────────────────────────────────────────

function NavItemRow({
  node,
  index,
  total,
  onEdit,
  onDelete,
  onMove,
  onAddChild,
}: {
  node: NavItemWithChildren;
  index: number;
  total: number;
  onEdit: (n: NavItemWithChildren | (typeof node.children)[0], parentId?: string | null) => void;
  onDelete: (id: string, label: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onAddChild: (parentId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Root row */}
      <div style={{
        background: node.active ? WHITE : "#FAFAFA",
        border: `2px solid ${INK}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: node.active ? 1 : 0.55,
      }}>
        {/* Reorder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button disabled={index === 0} style={btn("ghost", { padding: "2px 6px", fontSize: 10, opacity: index === 0 ? 0.3 : 1 })} onClick={() => onMove(node.id, "up")}>▲</button>
          <button disabled={index === total - 1} style={btn("ghost", { padding: "2px 6px", fontSize: 10, opacity: index === total - 1 ? 0.3 : 1 })} onClick={() => onMove(node.id, "down")}>▼</button>
        </div>

        {/* Expand toggle */}
        <button style={{ ...btn("ghost", { padding: "4px 8px", fontSize: 11, minWidth: 28 }), visibility: node.children.length > 0 ? "visible" : "hidden" }} onClick={() => setOpen(!open)}>
          {open ? "−" : "+"}
        </button>

        {/* Icon & label */}
        {node.icon && <span style={{ fontSize: 18 }}>{node.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, display: "flex", alignItems: "center", gap: 8 }}>
            {node.label}
            {!node.active && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", background: GREY100, color: GREY400, padding: "2px 6px", borderRadius: 4 }}>MASQUÉ</span>}
            {node.badge && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", background: RED, color: WHITE, padding: "2px 5px", borderRadius: 4 }}>{node.badge}</span>}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: GREY400, marginTop: 2 }}>{node.href}</div>
        </div>

        {/* Children count */}
        <span style={{ fontFamily: FONT, fontSize: 11, color: GREY600, background: GREY50, border: `1px solid ${GREY100}`, borderRadius: 4, padding: "2px 8px" }}>
          {node.children.length} sous-lien{node.children.length !== 1 ? "s" : ""}
        </span>

        {/* Actions */}
        <button style={btn("ghost", { fontSize: 11 })} onClick={() => onAddChild(node.id)}>+ Sous-lien</button>
        <button style={btn("ghost", { fontSize: 11 })} onClick={() => onEdit(node, null)}>✏️</button>
        <button style={btn("danger", { fontSize: 11 })} onClick={() => onDelete(node.id, node.label)}>✕</button>
      </div>

      {/* Children */}
      {open && node.children.length > 0 && (
        <div style={{ marginLeft: 40, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
          {node.children.map((child, ci) => (
            <div key={child.id} style={{
              background: child.active ? GREY50 : "#FAFAFA",
              border: `1.5px solid ${GREY100}`,
              borderLeft: `3px solid ${INK}`,
              borderRadius: 6,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: child.active ? 1 : 0.55,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button
                  disabled={ci === 0}
                  style={btn("ghost", { padding: "1px 5px", fontSize: 9, opacity: ci === 0 ? 0.3 : 1 })}
                  onClick={() => onMove(child.id, "up")}
                >▲</button>
                <button
                  disabled={ci === node.children.length - 1}
                  style={btn("ghost", { padding: "1px 5px", fontSize: 9, opacity: ci === node.children.length - 1 ? 0.3 : 1 })}
                  onClick={() => onMove(child.id, "down")}
                >▼</button>
              </div>

              {child.icon && <span style={{ fontSize: 16 }}>{child.icon}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
                  {child.label}
                  {!child.active && <span style={{ fontSize: 9, fontWeight: 800, background: GREY100, color: GREY400, padding: "2px 6px", borderRadius: 4 }}>MASQUÉ</span>}
                  {child.badge && <span style={{ fontSize: 9, fontWeight: 800, background: RED, color: WHITE, padding: "2px 5px", borderRadius: 4 }}>{child.badge}</span>}
                </div>
                {child.description && <div style={{ fontFamily: FONT, fontSize: 11, color: GREY600, marginTop: 1 }}>{child.description}</div>}
                <div style={{ fontFamily: FONT, fontSize: 10, color: GREY400, marginTop: 1 }}>{child.href}</div>
              </div>
              <button style={btn("ghost", { fontSize: 11 })} onClick={() => onEdit(child, child.parentId)}>✏️</button>
              <button style={btn("danger", { fontSize: 11 })} onClick={() => onDelete(child.id, child.label)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function NavEditorClient({ initialTree }: { initialTree: NavItemWithChildren[] }) {
  const [tree, setTree] = useState<NavItemWithChildren[]>(initialTree);
  const [form, setForm] = useState<EditForm | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Flatten all root items for parent selector (exclude item being edited)
  const parentOptions = tree
    .filter((n) => !n.parentId)
    .filter((n) => !form?.id || n.id !== form.id)
    .map((n) => ({ id: n.id, label: n.label }));

  const openNew = (parentId?: string | null) =>
    setForm({ ...emptyForm(), parentId: parentId ?? null });

  const openEdit = (item: { id: string; label: string; href: string; icon?: string | null; description?: string | null; badge?: string | null; openInNewTab: boolean; active: boolean; parentId?: string | null }) => {
    setForm({
      id: item.id,
      parentId: item.parentId ?? null,
      label: item.label,
      href: item.href,
      icon: item.icon ?? "",
      description: item.description ?? "",
      badge: item.badge ?? "",
      openInNewTab: item.openInNewTab,
      active: item.active,
    });
  };

  const handleSave = () => {
    if (!form) return;
    if (!form.label.trim()) { showToast("Le libellé est obligatoire"); return; }

    startTransition(async () => {
      if (form.id) {
        await updateNavItem(form.id, {
          label: form.label,
          href: form.href,
          icon: form.icon || null,
          description: form.description || null,
          badge: form.badge || null,
          openInNewTab: form.openInNewTab,
          active: form.active,
        });
      } else {
        await createNavItem({
          parentId: form.parentId,
          label: form.label,
          href: form.href,
          icon: form.icon || undefined,
          description: form.description || undefined,
          badge: form.badge || undefined,
          openInNewTab: form.openInNewTab,
        });
      }
      // Re-fetch tree from server (use window.location.reload as we don't have router here)
      const fresh = await (await import("@/lib/nav-actions")).getNavTreeAdmin();
      setTree(fresh);
      setForm(null);
      showToast(form.id ? "Lien mis à jour ✓" : "Lien créé ✓");
    });
  };

  const handleDelete = (id: string, lbl: string) => {
    if (!confirm(`Supprimer "${lbl}" ?`)) return;
    startTransition(async () => {
      await deleteNavItem(id);
      const fresh = await (await import("@/lib/nav-actions")).getNavTreeAdmin();
      setTree(fresh);
      showToast("Lien supprimé");
    });
  };

  const handleMove = (id: string, dir: "up" | "down") => {
    startTransition(async () => {
      // Find the item in flat list
      const allItems = [
        ...tree.map((n, i) => ({ id: n.id, parentId: null as string | null, sortOrder: i })),
        ...tree.flatMap((n) => n.children.map((c, ci) => ({ id: c.id, parentId: n.id, sortOrder: ci }))),
      ];
      const idx = allItems.findIndex((a) => a.id === id);
      if (idx < 0) return;
      const item = allItems[idx];
      const siblings = allItems.filter((a) => a.parentId === item.parentId);
      const sibIdx = siblings.findIndex((s) => s.id === id);
      if (dir === "up" && sibIdx === 0) return;
      if (dir === "down" && sibIdx === siblings.length - 1) return;
      const swap = siblings[dir === "up" ? sibIdx - 1 : sibIdx + 1];
      await reorderNavItems([
        { id: item.id, sortOrder: swap.sortOrder },
        { id: swap.id, sortOrder: item.sortOrder },
      ]);
      const fresh = await (await import("@/lib/nav-actions")).getNavTreeAdmin();
      setTree(fresh);
    });
  };

  const handleSeed = () => {
    if (!confirm("Initialiser la navigation par défaut ? Cela ne fonctionne que si la navigation est vide.")) return;
    startTransition(async () => {
      const res = await seedDefaultNav();
      const fresh = await (await import("@/lib/nav-actions")).getNavTreeAdmin();
      setTree(fresh);
      showToast(res.ok ? "Navigation initialisée ✓" : res.message ?? "Déjà configuré");
    });
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: INK }}>Navigation</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: GREY600 }}>Editez les liens et le méga-menu de votre site</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tree.length === 0 && (
            <button style={btn("success")} onClick={handleSeed} disabled={isPending}>
              ⚡ Initialiser la nav par défaut
            </button>
          )}
          <button style={btn("primary")} onClick={() => openNew(null)} disabled={isPending}>
            + Ajouter un lien
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#ECFDF5", border: "1.5px solid #10B981", borderRadius: 8, fontWeight: 600, fontSize: 13, color: "#065F46" }}>
          {toast}
        </div>
      )}

      {/* Live preview */}
      {tree.length > 0 && <MegaMenuPreview tree={tree} />}

      {/* Edit / create form */}
      {form && (
        <FormPanel
          form={form}
          parentOptions={parentOptions}
          onChange={(f) => setForm((prev) => prev ? { ...prev, ...f } : null)}
          onSave={handleSave}
          onCancel={() => setForm(null)}
          isPending={isPending}
        />
      )}

      {/* Tree list */}
      {tree.length === 0 ? (
        <div style={card({ padding: 40, textAlign: "center" })}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧭</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: INK, marginBottom: 6 }}>Navigation vide</div>
          <div style={{ fontSize: 13, color: GREY600, marginBottom: 20 }}>Aucun lien configuré. Initialisez avec les valeurs par défaut ou ajoutez-en manuellement.</div>
          <button style={btn("success")} onClick={handleSeed} disabled={isPending}>⚡ Initialiser la nav par défaut</button>
        </div>
      ) : (
        <div>
          {tree.map((node, i) => (
            <NavItemRow
              key={node.id}
              node={node}
              index={i}
              total={tree.length}
              onEdit={(item) => openEdit(item)}
              onDelete={handleDelete}
              onMove={handleMove}
              onAddChild={(parentId) => openNew(parentId)}
            />
          ))}

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button style={btn("ghost")} onClick={() => openNew(null)} disabled={isPending}>
              + Ajouter un lien racine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
