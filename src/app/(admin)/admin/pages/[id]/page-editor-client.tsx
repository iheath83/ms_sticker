"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Page } from "@/db/schema";
import type { PageSection, HeroSection, RichTextSection, FaqSection, FeaturesSection, CtaBannerSection, ContactFormSection, SeparatorSection } from "@/lib/page-sections";
import { SECTION_TYPES } from "@/lib/page-sections";
import { createPage, updatePage } from "@/lib/pages-actions";
import { PageRenderer } from "@/components/shop/page-renderer";

// ── Palette ───────────────────────────────────────────────────────────────────
const INK = "#0A0E27";
const RED = "#E8391E";
const GREY50 = "#F8F9FB";
const GREY100 = "#ECEEF2";
const GREY400 = "#9BA3AF";
const GREY600 = "#4B5563";
const WHITE = "#FFFFFF";
const BLUE = "#2563EB";
const FONT = "var(--font-archivo), system-ui, sans-serif";

const btn = (v: "primary" | "ghost" | "danger" | "success", ex?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
  border: "1.5px solid", borderRadius: 6, padding: "6px 14px", cursor: "pointer",
  ...(v === "primary" ? { background: INK, color: WHITE, borderColor: INK } : {}),
  ...(v === "ghost"   ? { background: WHITE, color: INK, borderColor: INK } : {}),
  ...(v === "danger"  ? { background: WHITE, color: RED, borderColor: RED } : {}),
  ...(v === "success" ? { background: BLUE, color: WHITE, borderColor: BLUE } : {}),
  ...ex,
});

const inp = (ex?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT, fontSize: 13, border: `1.5px solid ${GREY100}`, borderRadius: 6,
  padding: "7px 10px", width: "100%", boxSizing: "border-box" as const,
  outline: "none", background: WHITE, color: INK, ...ex,
});

const lbl = (): React.CSSProperties => ({
  display: "block", fontFamily: FONT, fontSize: 10, fontWeight: 700,
  letterSpacing: "0.07em", textTransform: "uppercase" as const, color: GREY400, marginBottom: 5,
});

// ── Section settings panels ───────────────────────────────────────────────────

function HeroSettings({ section, onChange }: { section: HeroSection; onChange: (s: HeroSection) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></div>
      <div><span style={lbl()}>Sous-titre</span><textarea style={{ ...inp(), minHeight: 80, resize: "vertical" }} value={section.subtitle} onChange={(e) => onChange({ ...section, subtitle: e.target.value })} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><span style={lbl()}>Texte du bouton</span><input style={inp()} value={section.ctaLabel} onChange={(e) => onChange({ ...section, ctaLabel: e.target.value })} /></div>
        <div><span style={lbl()}>Lien du bouton</span><input style={inp()} value={section.ctaHref} onChange={(e) => onChange({ ...section, ctaHref: e.target.value })} /></div>
      </div>
      <div>
        <span style={lbl()}>Couleur de fond</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ink", "white", "red"] as const).map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...section, bgColor: c })}
              style={{ padding: "6px 14px", border: `2px solid ${section.bgColor === c ? INK : GREY100}`, borderRadius: 6, background: c === "ink" ? INK : c === "red" ? RED : WHITE, color: c === "white" ? INK : WHITE, fontFamily: FONT, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              {c === "ink" ? "Sombre" : c === "red" ? "Rouge" : "Blanc"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RichTextSettings({ section, onChange }: { section: RichTextSection; onChange: (s: RichTextSection) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre (optionnel)</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} placeholder="Laissez vide pour masquer" /></div>
      <div><span style={lbl()}>Contenu</span><textarea style={{ ...inp(), minHeight: 160, resize: "vertical" }} value={section.content} onChange={(e) => onChange({ ...section, content: e.target.value })} /></div>
      <div>
        <span style={lbl()}>Alignement</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["left", "center"] as const).map((a) => (
            <button key={a} onClick={() => onChange({ ...section, align: a })} style={{ ...btn(section.align === a ? "primary" : "ghost"), padding: "5px 12px" }}>
              {a === "left" ? "Gauche" : "Centré"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqSettings({ section, onChange }: { section: FaqSection; onChange: (s: FaqSection) => void }) {
  const addItem = () => onChange({ ...section, items: [...section.items, { id: crypto.randomUUID(), question: "Nouvelle question ?", answer: "Réponse ici..." }] });
  const removeItem = (id: string) => onChange({ ...section, items: section.items.filter((i) => i.id !== id) });
  const updateItem = (id: string, field: "question" | "answer", val: string) =>
    onChange({ ...section, items: section.items.map((i) => i.id === id ? { ...i, [field]: val } : i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre de la section</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {section.items.map((item, i) => (
          <div key={item.id} style={{ background: GREY50, border: `1px solid ${GREY100}`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: GREY400 }}>Question {i + 1}</span>
              <button onClick={() => removeItem(item.id)} style={btn("danger", { padding: "2px 8px", fontSize: 10 })}>✕</button>
            </div>
            <div style={{ marginBottom: 8 }}><span style={lbl()}>Question</span><input style={inp()} value={item.question} onChange={(e) => updateItem(item.id, "question", e.target.value)} /></div>
            <div><span style={lbl()}>Réponse</span><textarea style={{ ...inp(), minHeight: 70, resize: "vertical" }} value={item.answer} onChange={(e) => updateItem(item.id, "answer", e.target.value)} /></div>
          </div>
        ))}
      </div>
      <button style={btn("ghost")} onClick={addItem}>+ Ajouter une question</button>
    </div>
  );
}

function FeaturesSettings({ section, onChange }: { section: FeaturesSection; onChange: (s: FeaturesSection) => void }) {
  const addItem = () => onChange({ ...section, items: [...section.items, { id: crypto.randomUUID(), icon: "⭐", title: "Avantage", description: "Description" }] });
  const removeItem = (id: string) => onChange({ ...section, items: section.items.filter((i) => i.id !== id) });
  const updateItem = (id: string, field: "icon" | "title" | "description", val: string) =>
    onChange({ ...section, items: section.items.map((i) => i.id === id ? { ...i, [field]: val } : i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre de la section</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></div>
      <div>
        <span style={lbl()}>Colonnes</span>
        <div style={{ display: "flex", gap: 8 }}>
          {([2, 3, 4] as const).map((c) => (
            <button key={c} onClick={() => onChange({ ...section, columns: c })} style={{ ...btn(section.columns === c ? "primary" : "ghost"), padding: "5px 12px" }}>{c} col.</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {section.items.map((item, i) => (
          <div key={item.id} style={{ background: GREY50, border: `1px solid ${GREY100}`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: GREY400 }}>Avantage {i + 1}</span>
              <button onClick={() => removeItem(item.id)} style={btn("danger", { padding: "2px 8px", fontSize: 10 })}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, marginBottom: 8 }}>
              <div><span style={lbl()}>Icône</span><input style={inp({ textAlign: "center", fontSize: 20 })} value={item.icon} onChange={(e) => updateItem(item.id, "icon", e.target.value)} maxLength={4} /></div>
              <div><span style={lbl()}>Titre</span><input style={inp()} value={item.title} onChange={(e) => updateItem(item.id, "title", e.target.value)} /></div>
            </div>
            <div><span style={lbl()}>Description</span><input style={inp()} value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} /></div>
          </div>
        ))}
      </div>
      <button style={btn("ghost")} onClick={addItem}>+ Ajouter un avantage</button>
    </div>
  );
}

function CtaBannerSettings({ section, onChange }: { section: CtaBannerSection; onChange: (s: CtaBannerSection) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></div>
      <div><span style={lbl()}>Sous-titre</span><input style={inp()} value={section.subtitle} onChange={(e) => onChange({ ...section, subtitle: e.target.value })} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><span style={lbl()}>Texte bouton</span><input style={inp()} value={section.buttonLabel} onChange={(e) => onChange({ ...section, buttonLabel: e.target.value })} /></div>
        <div><span style={lbl()}>Lien bouton</span><input style={inp()} value={section.buttonHref} onChange={(e) => onChange({ ...section, buttonHref: e.target.value })} /></div>
      </div>
      <div>
        <span style={lbl()}>Variante</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["dark", "light", "red"] as const).map((v) => (
            <button key={v} onClick={() => onChange({ ...section, variant: v })} style={{ ...btn(section.variant === v ? "primary" : "ghost"), padding: "5px 12px" }}>
              {v === "dark" ? "Sombre" : v === "light" ? "Clair" : "Rouge"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactFormSettings({ section, onChange }: { section: ContactFormSection; onChange: (s: ContactFormSection) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre</span><input style={inp()} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></div>
      <div><span style={lbl()}>Sous-titre</span><input style={inp()} value={section.subtitle} onChange={(e) => onChange({ ...section, subtitle: e.target.value })} /></div>
    </div>
  );
}

function SeparatorSettings({ section, onChange }: { section: SeparatorSection; onChange: (s: SeparatorSection) => void }) {
  return (
    <div>
      <span style={lbl()}>Espacement</span>
      <div style={{ display: "flex", gap: 8 }}>
        {(["sm", "md", "lg"] as const).map((s) => (
          <button key={s} onClick={() => onChange({ ...section, spacing: s })} style={{ ...btn(section.spacing === s ? "primary" : "ghost"), padding: "5px 12px" }}>
            {s === "sm" ? "Petit" : s === "md" ? "Moyen" : "Grand"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionSettings({ section, onChange }: { section: PageSection; onChange: (s: PageSection) => void }) {
  switch (section.type) {
    case "hero":         return <HeroSettings section={section} onChange={onChange} />;
    case "richtext":     return <RichTextSettings section={section} onChange={onChange} />;
    case "faq":          return <FaqSettings section={section} onChange={onChange} />;
    case "features":     return <FeaturesSettings section={section} onChange={onChange} />;
    case "cta_banner":   return <CtaBannerSettings section={section} onChange={onChange} />;
    case "contact_form": return <ContactFormSettings section={section} onChange={onChange} />;
    case "separator":    return <SeparatorSettings section={section} onChange={onChange} />;
  }
}

// ── Add section menu ──────────────────────────────────────────────────────────

function AddSectionMenu({ onAdd, onClose }: { onAdd: (s: PageSection) => void; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: WHITE, border: `2px solid ${INK}`, borderRadius: 12, padding: 24, width: 480, boxShadow: `8px 8px 0 0 ${INK}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 16, color: INK }}>Ajouter une section</span>
          <button style={btn("ghost", { padding: "4px 10px" })} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SECTION_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => { onAdd(t.create()); onClose(); }}
              style={{ background: GREY50, border: `1.5px solid ${GREY100}`, borderRadius: 8, padding: "12px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "border-color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = INK)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = GREY100)}
            >
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page metadata form ────────────────────────────────────────────────────────

function MetaPanel({
  title, setTitle, slug, setSlug, metaTitle, setMetaTitle, metaDesc, setMetaDesc, published, setPublished, isNew,
}: {
  title: string; setTitle: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  metaTitle: string; setMetaTitle: (v: string) => void;
  metaDesc: string; setMetaDesc: (v: string) => void;
  published: boolean; setPublished: (v: boolean) => void;
  isNew: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={lbl()}>Titre de la page *</span><input style={inp()} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon titre" /></div>
      <div>
        <span style={lbl()}>Slug (URL) *</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: FONT, fontSize: 12, color: GREY400 }}>/</span>
          <input style={inp()} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="mon-url" disabled={!isNew} />
        </div>
        {!isNew && <div style={{ fontFamily: FONT, fontSize: 10, color: GREY400, marginTop: 4 }}>Le slug ne peut pas être modifié après création.</div>}
      </div>
      <div><span style={lbl()}>Meta title (SEO)</span><input style={inp()} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} /></div>
      <div><span style={lbl()}>Meta description (SEO)</span><textarea style={{ ...inp(), minHeight: 70, resize: "vertical" }} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} /></div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 500 }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Page publiée (visible sur le site)
      </label>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

type TabType = "sections" | "meta";

export function PageEditorClient({ page }: { page: (Omit<Page, "sections"> & { sections: PageSection[] }) | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Meta state
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [metaTitle, setMetaTitle] = useState(page?.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(page?.metaDescription ?? "");
  const [published, setPublished] = useState(page?.published ?? true);

  // Sections state
  const [sections, setSections] = useState<PageSection[]>(page?.sections ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [tab, setTab] = useState<TabType>("sections");
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSave = () => {
    if (!title.trim() || !slug.trim()) { showToast("Titre et slug obligatoires"); return; }
    startTransition(async () => {
      if (!page) {
        const p = await createPage({ slug, title, metaTitle: metaTitle || undefined, metaDescription: metaDesc || undefined });
        await updatePage(p.id, { sections, published });
        setSaved(true);
        showToast("Page créée ✓");
        router.push(`/admin/pages/${p.id}`);
      } else {
        await updatePage(page.id, { title, sections, published, metaTitle: metaTitle || null, metaDescription: metaDesc || null });
        setSaved(true);
        showToast("Page sauvegardée ✓");
      }
    });
  };

  const updateSection = (updated: PageSection) => {
    setSections((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setSaved(false);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    setSaved(false);
  };

  const addSection = (s: PageSection) => {
    setSections((prev) => [...prev, s]);
    setSelectedId(s.id);
    setSaved(false);
  };

  const moveSection = (id: string, dir: "up" | "down") => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = [...sections];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
    setSections(next);
    setSaved(false);
  };

  const SECTION_ICONS: Record<string, string> = Object.fromEntries(SECTION_TYPES.map((t) => [t.type, t.icon]));
  const SECTION_LABELS: Record<string, string> = Object.fromEntries(SECTION_TYPES.map((t) => [t.type, t.label]));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: FONT }}>
      {/* Top bar */}
      <div style={{ background: INK, color: WHITE, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <button onClick={() => router.push("/admin/pages")} style={{ ...btn("ghost", { fontSize: 11, padding: "5px 10px", color: "rgba(255,255,255,.7)", borderColor: "rgba(255,255,255,.2)", background: "transparent" }) }}>← Pages</button>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, flex: 1 }}>{title || "Nouvelle page"}</span>
        {!saved && <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>● Non sauvegardé</span>}
        {toast && <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>{toast}</span>}
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
          <input type="checkbox" checked={published} onChange={(e) => { setPublished(e.target.checked); setSaved(false); }} />
          Publié
        </label>
        {page && (
          <a href={`/${page.slug}`} target="_blank" style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textDecoration: "none", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4, padding: "4px 8px" }}>
            Voir ↗
          </a>
        )}
        <button onClick={handleSave} disabled={isPending} style={btn("success", { padding: "8px 20px" })}>
          {isPending ? "Sauvegarde…" : "💾 Sauvegarder"}
        </button>
      </div>

      {/* Main 3-panel layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: sections list ── */}
        <div style={{ width: 220, background: "#16192E", borderRight: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            {(["sections", "meta"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ flex: 1, padding: "10px 0", border: "none", background: tab === t ? "#0A0E27" : "transparent", color: tab === t ? WHITE : "rgba(255,255,255,.5)", fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer", borderBottom: tab === t ? `2px solid ${RED}` : "2px solid transparent" }}
              >
                {t === "sections" ? "SECTIONS" : "MÉTA"}
              </button>
            ))}
          </div>

          {tab === "sections" ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
              {sections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 8px", color: "rgba(255,255,255,.3)", fontSize: 12, fontFamily: FONT }}>
                  Aucune section.<br />Ajoutez-en une ci-dessous.
                </div>
              ) : (
                sections.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 2,
                      background: selectedId === s.id ? "rgba(255,255,255,.12)" : "transparent",
                      border: `1.5px solid ${selectedId === s.id ? "rgba(255,255,255,.25)" : "transparent"}`,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{SECTION_ICONS[s.type] ?? "📄"}</span>
                    <span style={{ flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {SECTION_LABELS[s.type]}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "up"); }} disabled={i === 0} style={{ border: "none", background: "transparent", color: i === 0 ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.5)", cursor: i === 0 ? "default" : "pointer", fontSize: 9, padding: "1px 3px" }}>▲</button>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "down"); }} disabled={i === sections.length - 1} style={{ border: "none", background: "transparent", color: i === sections.length - 1 ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.5)", cursor: i === sections.length - 1 ? "default" : "pointer", fontSize: 9, padding: "1px 3px" }}>▼</button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeSection(s.id); }} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,.3)", cursor: "pointer", fontSize: 12, padding: "1px 3px" }}>✕</button>
                  </div>
                ))
              )}
              <button
                onClick={() => setShowAddMenu(true)}
                style={{ width: "100%", marginTop: 8, padding: "8px 0", background: "rgba(255,255,255,.06)", border: "1px dashed rgba(255,255,255,.15)", borderRadius: 6, color: "rgba(255,255,255,.5)", fontFamily: FONT, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                + Ajouter une section
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              <MetaPanel
                title={title} setTitle={(v) => { setTitle(v); setSaved(false); }}
                slug={slug} setSlug={(v) => { setSlug(v); setSaved(false); }}
                metaTitle={metaTitle} setMetaTitle={(v) => { setMetaTitle(v); setSaved(false); }}
                metaDesc={metaDesc} setMetaDesc={(v) => { setMetaDesc(v); setSaved(false); }}
                published={published} setPublished={(v) => { setPublished(v); setSaved(false); }}
                isNew={!page}
              />
            </div>
          )}
        </div>

        {/* ── MIDDLE: section settings ── */}
        <div style={{ width: 360, background: WHITE, borderRight: `2px solid ${GREY100}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {selected ? (
            <>
              <div style={{ padding: "14px 16px", borderBottom: `1.5px solid ${GREY100}`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{SECTION_ICONS[selected.type]}</span>
                <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK }}>{SECTION_LABELS[selected.type]}</span>
                <button onClick={() => setSelectedId(null)} style={{ marginLeft: "auto", ...btn("ghost", { padding: "3px 8px", fontSize: 11 }) }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <SectionSettings section={selected} onChange={(s) => { updateSection(s); setSaved(false); }} />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: GREY400, textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👈</div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Sélectionnez une section</div>
              <div style={{ fontFamily: FONT, fontSize: 12 }}>Cliquez sur une section dans la liste pour en modifier le contenu</div>
            </div>
          )}
        </div>

        {/* ── RIGHT: live preview ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#F0F2F7" }}>
          <div style={{ minHeight: "100%" }}>
            {sections.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400, color: GREY400, textAlign: "center", padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: INK, marginBottom: 8 }}>Page vide</div>
                <div style={{ fontFamily: FONT, fontSize: 14, marginBottom: 24 }}>Ajoutez des sections pour construire votre page</div>
                <button onClick={() => setShowAddMenu(true)} style={btn("primary", { fontSize: 14, padding: "10px 24px" })}>+ Ajouter une section</button>
              </div>
            ) : (
              <div style={{ background: WHITE, minHeight: "100%" }}>
                <div style={{ background: GREY50, borderBottom: `1px solid ${GREY100}`, padding: "6px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: GREY400 }}>APERÇU</span>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: GREY400 }}>/{slug || "..."}</span>
                </div>
                <PageRenderer sections={sections} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddMenu && <AddSectionMenu onAdd={addSection} onClose={() => setShowAddMenu(false)} />}
    </div>
  );
}
