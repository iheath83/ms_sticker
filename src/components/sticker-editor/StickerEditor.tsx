"use client";

import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useState,
  type DragEvent,
} from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import { editorReducer, createInitialState } from "@/lib/sticker-editor/editor.reducer";
import { validateEditor, detectTransparency } from "@/lib/sticker-editor/validation.service";
import { fitImageToCanvas, computeDpi, mmToPx, computeScale } from "@/lib/sticker-editor/geometry.utils";
import { generateAlphaCutline, removeBackground } from "@/lib/sticker-editor/cutline.service";
import {
  shapeCodeToCutlineMethod,
  type EditorValidationOutput,
  type EditorImage,
} from "@/lib/sticker-editor/editor.types";
import type { StickerShape } from "@/db/schema";
// Konva chargé côté client uniquement (pas de SSR)
const EditorCanvasClient = dynamic(() => import("./EditorCanvasClient"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", aspectRatio: "1", background: "#F3F4F6", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#9CA3AF", fontSize: 14 }}>Chargement de l&apos;éditeur…</span>
    </div>
  ),
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  productName: string;
  widthMm: number;
  heightMm: number;
  onValidate: (output: EditorValidationOutput) => void;
  onClose: () => void;
  /**
   * Si false, le modal est masqué (display: none) mais le composant reste
   * monté → l'image et les paramètres sont préservés entre les ouvertures.
   * Défaut : true.
   */
  isOpen?: boolean;
  /** Formes configurées sur le produit (à la forme, carré, rond, arrondi…). */
  shapes: StickerShape[];
  /** Forme actuellement sélectionnée dans le configurateur produit. */
  selectedShapeId?: string | undefined;
  /** Callback : l'utilisateur change de forme dans l'éditeur → cocher la même
   * option dans le configurateur produit. */
  onShapeChange?: (shapeId: string) => void;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "application/pdf"];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.svg,.pdf";
const MAX_CANVAS_WIDTH = 520;

// ─── Composant principal ─────────────────────────────────────────────────────

export function StickerEditor({
  productName,
  widthMm,
  heightMm,
  onValidate,
  onClose,
  isOpen = true,
  shapes,
  selectedShapeId,
  onShapeChange,
}: Props) {
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => createInitialState(widthMm, heightMm),
  );

  // Forme courante (résolue depuis l'id) — pilote la méthode de découpe.
  const currentShape = shapes.find((s) => s.id === selectedShapeId) ?? shapes[0];

  // Synchronise la méthode de découpe interne avec la forme du produit
  // (parent → éditeur). Réagit aussi à un changement local côté éditeur.
  useEffect(() => {
    if (!currentShape) return;
    const method = shapeCodeToCutlineMethod(currentShape.code);
    if (method !== state.settings.cutline.method) {
      dispatch({ type: "SET_CUTLINE_METHOD", method });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShape?.id]);

  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(MAX_CANVAS_WIDTH);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingCutline, setIsGeneratingCutline] = useState(false);
  const [cutlineGenError, setCutlineGenError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemoveError, setBgRemoveError] = useState<string | null>(null);
  const [bgRemoveDone, setBgRemoveDone] = useState(false);

  // Mesure la largeur réelle du conteneur canvas
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? MAX_CANVAS_WIDTH;
      setContainerWidth(Math.min(w, MAX_CANVAS_WIDTH));
    });
    ro.observe(el);
    setContainerWidth(Math.min(el.clientWidth, MAX_CANVAS_WIDTH));
    return () => ro.disconnect();
  }, []);

  // Validation en temps réel
  useEffect(() => {
    const v = validateEditor(state);
    dispatch({ type: "SET_VALIDATION", validation: v });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.image, state.settings]);

  // ── Gestion fichier ──
  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      dispatch({ type: "SET_UPLOAD_ERROR", error: `Format non supporté. Utilisez : PNG, JPG, SVG ou PDF.` });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      dispatch({ type: "SET_UPLOAD_ERROR", error: "Fichier trop lourd (max 30 Mo)." });
      return;
    }

    dispatch({ type: "SET_UPLOADING", value: true });

    const objectUrl = URL.createObjectURL(file);
    const hasTransparency = await detectTransparency(file);

    const getImageDimensions = (): Promise<{ w: number; h: number }> =>
      new Promise((resolve) => {
        if (file.type === "application/pdf" || file.type === "image/svg+xml") {
          resolve({ w: 1000, h: 1000 });
          return;
        }
        const img = new window.Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 600, h: 600 });
        img.src = objectUrl;
      });

    const { w, h } = await getImageDimensions();
    const { widthMm: dispW, heightMm: dispH } = fitImageToCanvas(w, h, widthMm, heightMm);

    const image: EditorImage = {
      url: objectUrl,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      originalWidthPx: w,
      originalHeightPx: h,
      hasTransparency,
      widthMm: dispW,
      heightMm: dispH,
      xMm: widthMm / 2,
      yMm: heightMm / 2,
      rotationDeg: 0,
    };

    dispatch({ type: "SET_IMAGE", image });
  }, [widthMm, heightMm]);

  // ── Génération ligne de coupe alpha ──
  const handleGenerateCutline = useCallback(async () => {
    if (!state.image) return;
    dispatch({ type: "SET_CUTLINE_PATH", path: undefined, status: "generating" });
    setCutlineGenError(null);
    setIsGeneratingCutline(true);
    try {
      const scale = computeScale(containerWidth, widthMm);
      const displayW = mmToPx(state.image.widthMm, scale);
      const displayH = mmToPx(state.image.heightMm, scale);
      const offsetPx = mmToPx(state.settings.cutline.offsetMm, scale);

      const outcome = await generateAlphaCutline(state.image.url, displayW, displayH, offsetPx);

      if (outcome.ok) {
        dispatch({ type: "SET_CUTLINE_PATH", path: outcome.result.pathData, status: "generated" });
      } else {
        dispatch({ type: "SET_CUTLINE_PATH", path: undefined, status: "error" });
        setCutlineGenError(outcome.message);
        // Si pas de transparence → revenir automatiquement en bounding_box
        if (outcome.error === "no_transparency") {
          dispatch({ type: "SET_CUTLINE_METHOD", method: "bounding_box" });
        }
      }
    } catch {
      dispatch({ type: "SET_CUTLINE_PATH", path: undefined, status: "error" });
      setCutlineGenError("Erreur lors de la génération du contour.");
    } finally {
      setIsGeneratingCutline(false);
    }
  }, [state.image, state.settings.cutline.offsetMm, containerWidth, widthMm]);

  // ── Suppression de fond automatique (rembg côté serveur Python) ──
  const handleRemoveBackground = useCallback(async () => {
    if (!state.image || isRemovingBg) return;
    setBgRemoveError(null);
    setIsRemovingBg(true);
    try {
      const outcome = await removeBackground(state.image.url);
      if (!outcome.ok) {
        setBgRemoveError(outcome.message);
        return;
      }
      // Remplacer l'image courante par la version sans fond
      const img = new window.Image();
      img.onload = () => {
        if (!state.image) return;
        const updated: EditorImage = {
          ...state.image,
          url: outcome.url,
          filename: state.image.filename.replace(/\.[^.]+$/, "") + "-no-bg.png",
          mimeType: "image/png",
          sizeBytes: outcome.blob.size,
          originalWidthPx: img.naturalWidth,
          originalHeightPx: img.naturalHeight,
          hasTransparency: true,
        };
        dispatch({ type: "SET_IMAGE", image: updated });
        setBgRemoveDone(true);
      };
      img.onerror = () => setBgRemoveError("Impossible de charger l'image résultante.");
      img.src = outcome.url;
    } catch {
      setBgRemoveError("Erreur lors de la suppression du fond.");
    } finally {
      setIsRemovingBg(false);
    }
  }, [state.image, isRemovingBg]);

  // Réinitialiser l'état "fond supprimé" quand on charge une nouvelle image
  useEffect(() => {
    setBgRemoveDone(false);
    setBgRemoveError(null);
  }, [state.image?.filename]);

  // Déclencher automatiquement la génération quand on passe en mode alpha.
  // Debounce 600ms : si l'utilisateur fait glisser le slider de marge,
  // on attend qu'il s'arrête avant de régénérer (sinon on spam l'API et
  // on déclenche le rate limit).
  useEffect(() => {
    if (
      state.settings.cutline.method !== "alpha" ||
      !state.image ||
      state.settings.cutline.status !== "not_generated" ||
      isGeneratingCutline
    ) {
      return;
    }
    const t = setTimeout(() => {
      void handleGenerateCutline();
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.settings.cutline.method,
    state.image?.url,
    state.settings.cutline.status,
    state.settings.cutline.offsetMm,
  ]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Export et validation ──
  const handleValidate = async () => {
    const v = validateEditor(state);
    dispatch({ type: "SET_VALIDATION", validation: v });
    if (!v.isValid || !state.image) return;

    setIsExporting(true);

    let previewDataUrl = "";
    const stage = stageRef.current;
    if (stage) {
      // Cacher le Transformer pendant l'export pour qu'il ne soit pas
      // dessiné, et pour éviter le bug "drawImage on canvas with width 0"
      // (les handles invisibles peuvent créer des sub-canvas vides).
      const transformers = stage.find("Transformer");
      const wasVisible = transformers.map((t) => t.visible());
      transformers.forEach((t) => t.visible(false));
      stage.batchDraw();
      // Laisse Konva committer le redraw avant la capture
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );

      try {
        previewDataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
      } catch (err) {
        console.error("[StickerEditor] toDataURL failed:", err);
      } finally {
        transformers.forEach((t, i) => t.visible(wasVisible[i] ?? true));
        stage.batchDraw();
      }
    }

    const dpi = computeDpi(state.image.originalWidthPx, state.image.widthMm);

    setIsExporting(false);

    // Déduit le type de coupe à partir de la forme produit : la découpe à la
    // forme (die-cut) implique généralement une coupe pleine chair, les formes
    // géométriques (rond, carré, arrondi) restent en kiss-cut planché.
    const derivedCutType =
      state.settings.cutline.method === "alpha" ? "through_cut" : "kiss_cut";

    onValidate({
      previewDataUrl,
      editorConfig: {
        widthMm: state.image.widthMm,
        heightMm: state.image.heightMm,
        cutType: derivedCutType,
        cutlineOffsetMm: state.settings.cutline.offsetMm,
        bleedMm: state.settings.bleedMm,
        safetyMarginMm: state.settings.safetyMarginMm,
        originalFilename: state.image.filename,
        hasTransparency: state.image.hasTransparency,
        dpi,
      },
    });
  };

  // ── Dérivées ──
  const { image, settings, validation, isUploading, uploadError } = state;
  const cutlineColor =
    settings.cutline.cutType === "through_cut" ? "#00B3D8" : "#E91E8C";
  const cutlineLabel =
    settings.cutline.cutType === "through_cut" ? "Coupe pleine chair" : "Demi-chair (kiss cut)";

  const dpi = image ? computeDpi(image.originalWidthPx, image.widthMm) : 0;

  return (
    /* ── Overlay ── */
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,14,39,0.72)", backdropFilter: "blur(4px)",
        display: isOpen ? "flex" : "none",
        flexDirection: "column",
        overflow: "hidden",
      }}
      aria-hidden={!isOpen}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Modal ── */}
      <div
        style={{
          background: "#fff", borderRadius: 20, margin: "auto",
          width: "100%", maxWidth: 1100, maxHeight: "96vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 24px 80px rgba(10,14,39,0.32)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid #E5E7EB", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0A0E27" }}>
              Éditeur de sticker
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280", marginTop: 2 }}>
              {productName} — {widthMm} × {heightMm} mm
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'éditeur"
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "#6B7280", padding: "6px 10px", borderRadius: 8,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Corps ── */}
        <div style={{
          display: "flex", flex: 1, overflow: "hidden",
          flexDirection: "row",
          minHeight: 0,
        }}>
          {/* ── Zone canvas ── */}
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 24, background: "#F9FAFB",
              overflow: "auto", minWidth: 0,
            }}
          >
            {/* Upload zone ou canvas */}
            {!image ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                aria-label="Zone d'import de fichier"
                style={{
                  width: "100%", maxWidth: 480, aspectRatio: `${widthMm}/${heightMm}`,
                  maxHeight: 420,
                  border: `2px dashed ${isDraggingOver ? "#0A0E27" : "#D1D5DB"}`,
                  borderRadius: 16,
                  background: isDraggingOver ? "#F0F9FF" : "#fff",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 12, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 40 }}>🖼️</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>
                  {isUploading ? "Chargement…" : "Déposez votre fichier ici"}
                </span>
                <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                  PNG, JPG, SVG, PDF — max 30 Mo
                </span>
                {uploadError && (
                  <span style={{ fontSize: 13, color: "#DC2626", background: "#FEF2F2", padding: "6px 12px", borderRadius: 8 }}>
                    {uploadError}
                  </span>
                )}
              </div>
            ) : (
              <div>
                {/* Canvas Konva */}
                <div style={{
                  border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden",
                  boxShadow: "0 2px 12px rgba(10,14,39,0.08)",
                  background: "#fff",
                  display: "inline-block",
                }}>
                  <EditorCanvasClient
                    canvasWidthMm={widthMm}
                    canvasHeightMm={heightMm}
                    image={image}
                    settings={settings}
                    containerWidth={containerWidth}
                    stageRef={stageRef}
                    onImageChange={(patch) => dispatch({ type: "UPDATE_IMAGE", patch })}
                  />
                </div>

                {/* Légende des couleurs */}
                <Legend settings={settings} />

                {/* Infos image */}
                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  <InfoChip label={`${image.widthMm.toFixed(0)} × ${image.heightMm.toFixed(0)} mm`} />
                  <InfoChip label={`${dpi} DPI`} color={dpi < 150 ? "amber" : "green"} />
                  {image.hasTransparency && <InfoChip label="Fond transparent ✓" color="green" />}
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(image.url);
                      dispatch({ type: "CLEAR_IMAGE" });
                    }}
                    style={{
                      marginLeft: "auto", background: "none", border: "1px solid #E5E7EB",
                      borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                      fontSize: 12, color: "#6B7280",
                    }}
                  >
                    Changer de fichier
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>

          {/* ── Sidebar droite ── */}
          <div style={{
            width: 300, flexShrink: 0,
            borderLeft: "1px solid #E5E7EB",
            overflowY: "auto",
            padding: 20,
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {/* ── Import ── */}
            {!image && (
              <SideSection title="1. Importer un fichier">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={btnStyle("#0A0E27", "#fff")}
                >
                  Choisir un fichier
                </button>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                  Formats acceptés : PNG, JPG, SVG, PDF
                </p>
              </SideSection>
            )}

            {/* ── Forme du sticker (cochée aussi sur la fiche produit) ── */}
            {shapes.length > 0 && (
              <SideSection title={image ? "Forme du sticker" : "2. Forme du sticker"}>
                <ShapeSelector
                  shapes={shapes}
                  selectedShapeId={currentShape?.id}
                  hasTransparency={image?.hasTransparency ?? true}
                  status={settings.cutline.status}
                  isGenerating={isGeneratingCutline}
                  genError={cutlineGenError}
                  onChange={(id) => {
                    const shape = shapes.find((s) => s.id === id);
                    if (!shape) return;
                    dispatch({
                      type: "SET_CUTLINE_METHOD",
                      method: shapeCodeToCutlineMethod(shape.code),
                    });
                    onShapeChange?.(id);
                  }}
                  onRegenerate={handleGenerateCutline}
                />
              </SideSection>
            )}

            {/* ── Préparation de l'image ── */}
            {image && (
              <SideSection title="Préparer l'image">
                <BackgroundRemoveAction
                  isRemoving={isRemovingBg}
                  hasTransparency={image.hasTransparency}
                  done={bgRemoveDone}
                  error={bgRemoveError}
                  onRemove={handleRemoveBackground}
                />
              </SideSection>
            )}

            {/* ── Marges ── */}
            <SideSection title="Marge de coupe">
              <label style={labelStyle}>
                Marge autour du visuel
                <SliderWithValue
                  min={1} max={8} step={0.5}
                  value={settings.cutline.offsetMm}
                  unit="mm"
                  onChange={(v) => dispatch({ type: "SET_CUTLINE_OFFSET", offsetMm: v })}
                />
              </label>
            </SideSection>

            {/* ── Affichage guides ── */}
            <SideSection title="Affichage">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ToggleRow
                  label="Ligne de coupe"
                  color={cutlineColor}
                  checked={settings.showCutline}
                  onChange={() => dispatch({ type: "TOGGLE_SHOW_CUTLINE" })}
                />
                <ToggleRow
                  label="Grille"
                  color="#9CA3AF"
                  checked={settings.showGrid}
                  onChange={() => dispatch({ type: "TOGGLE_SHOW_GRID" })}
                />
              </div>
            </SideSection>

            {/* ── Positionnement ── */}
            {image && (
              <SideSection title="Positionnement">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "RESET_POSITION" })}
                  style={btnStyle("#F3F4F6", "#374151")}
                >
                  Recentrer le visuel
                </button>
              </SideSection>
            )}

            {/* ── Validation ── */}
            <ValidationPanel validation={validation} />

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexShrink: 0, background: "#fff",
        }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            {image ? (
              <span>
                <span style={{ color: cutlineColor, fontWeight: 700 }}>●</span>{" "}
                {currentShape?.name ?? "Forme"} · offset {settings.cutline.offsetMm} mm
              </span>
            ) : (
              "Importez un fichier pour commencer"
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={btnStyle("#F3F4F6", "#374151")}>
              Annuler
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!validation.isValid || isExporting}
              style={btnStyle(
                validation.isValid ? "#0A0E27" : "#D1D5DB",
                validation.isValid ? "#fff" : "#9CA3AF",
              )}
            >
              {isExporting ? "Génération…" : "Valider et continuer →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ShapeIcon({ code, active }: { code: string; active: boolean }) {
  const fill = active ? "#FFFFFF" : "#9CA3AF";
  const stroke = active ? "#FFFFFF" : "#9CA3AF";
  const k = (code ?? "").toLowerCase().replace(/-/g, "_");
  if (k === "die_cut" || k === "diecut" || k === "custom") {
    return (
      <svg width="28" height="22" viewBox="0 0 48 40" aria-hidden>
        <path d="M8 8 Q24 2 40 8 Q46 20 40 32 Q24 38 8 32 Q2 20 8 8z" fill={fill} />
      </svg>
    );
  }
  if (k === "round" || k === "circle" || k === "ellipse") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill={fill} />
      </svg>
    );
  }
  if (k === "rounded" || k === "rounded_square" || k === "rounded_rect") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="6" ry="6" fill={fill} />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="2" width="20" height="20" fill={fill} stroke={stroke} />
    </svg>
  );
}

function ShapeSelector({
  shapes,
  selectedShapeId,
  hasTransparency,
  status,
  isGenerating,
  genError,
  onChange,
  onRegenerate,
}: {
  shapes: StickerShape[];
  selectedShapeId: string | undefined;
  hasTransparency: boolean;
  status: import("@/lib/sticker-editor/editor.types").CutlineStatus;
  isGenerating: boolean;
  genError: string | null;
  onChange: (id: string) => void;
  onRegenerate: () => void;
}) {
  const selected = shapes.find((s) => s.id === selectedShapeId);
  const selectedMethod = shapeCodeToCutlineMethod(selected?.code);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shapes.map((shape) => {
        const method = shapeCodeToCutlineMethod(shape.code);
        const requiresAlpha = method === "alpha";
        const disabled = requiresAlpha && !hasTransparency;
        const isActive = shape.id === selectedShapeId && !disabled;
        return (
          <button
            key={shape.id}
            type="button"
            onClick={() => !disabled && onChange(shape.id)}
            disabled={disabled}
            style={{
              textAlign: "left", padding: "10px 14px", borderRadius: 10,
              border: `2px solid ${isActive ? "#0A0E27" : "#E5E7EB"}`,
              background: isActive ? "#0A0E27" : disabled ? "#F9FAFB" : "#fff",
              color: isActive ? "#fff" : disabled ? "#9CA3AF" : "#0A0E27",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.55 : 1,
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShapeIcon code={shape.code} active={isActive} />
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{shape.name}</span>
              {isActive && method === "alpha" && status === "generated" && (
                <span style={{ fontSize: 11, color: "#86EFAC", fontWeight: 600 }}>✓ Calculé</span>
              )}
              {isActive && method === "alpha" && status === "generating" && (
                <span style={{ fontSize: 11, color: "#BFDBFE" }}>⏳</span>
              )}
            </div>
            {shape.description && (
              <p style={{
                margin: "4px 0 0 32px", fontSize: 11,
                color: isActive ? "rgba(255,255,255,0.7)" : "#6B7280",
                lineHeight: 1.35,
              }}>
                {shape.description}
              </p>
            )}
            {disabled && (
              <p style={{ margin: "4px 0 0 32px", fontSize: 11, color: "#B45309" }}>
                Fond transparent requis (PNG avec alpha)
              </p>
            )}
          </button>
        );
      })}

      {/* Erreur de génération + bouton régénérer (uniquement pour la découpe à la forme) */}
      {selectedMethod === "alpha" && (
        <>
          {genError && (
            <div style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 12,
              background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626",
            }}>
              {genError}
            </div>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              ...btnStyle(isGenerating ? "#E5E7EB" : "#EFF6FF", isGenerating ? "#9CA3AF" : "#1D4ED8"),
              fontSize: 12, padding: "8px 14px",
            }}
          >
            {isGenerating ? "⏳ Calcul en cours…" : "↺ Régénérer le contour"}
          </button>
        </>
      )}
    </div>
  );
}

function SliderWithValue({
  min, max, step, value, unit, onChange,
}: {
  min: number; max: number; step: number;
  value: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: "#0A0E27" }}
      />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E27", minWidth: 48, textAlign: "right" }}>
        {value} {unit}
      </span>
    </div>
  );
}

function ToggleRow({ label, color, checked, onChange }: {
  label: string; color: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
      <span style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: color }} />
    </label>
  );
}

function Legend({ settings }: { settings: import("@/lib/sticker-editor/editor.types").EditorSettings }) {
  const items = [
    { label: "Ligne de coupe", color: settings.cutline.cutType === "through_cut" ? "#00B3D8" : "#E91E8C", visible: settings.showCutline },
  ].filter((i) => i.visible);

  if (!items.length) return null;

  return (
    <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B7280" }}>
          <span style={{ width: 12, height: 2, background: i.color, display: "inline-block" }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function ValidationPanel({ validation }: { validation: import("@/lib/sticker-editor/editor.types").EditorValidation }) {
  if (!validation.errors.length && !validation.warnings.length) return null;

  return (
    <SideSection title="Vérifications">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {validation.errors.map((e) => (
          <div key={e.code} style={{
            padding: "8px 10px", borderRadius: 8, fontSize: 12,
            background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626",
          }}>
            ❌ {e.message}
          </div>
        ))}
        {validation.warnings.map((w) => (
          <div key={w.code} style={{
            padding: "8px 10px", borderRadius: 8, fontSize: 12,
            background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309",
          }}>
            ⚠️ {w.message}
          </div>
        ))}
      </div>
    </SideSection>
  );
}

function InfoChip({ label, color = "default" }: { label: string; color?: "default" | "green" | "amber" }) {
  const bg: Record<string, string> = { default: "#F3F4F6", green: "#F0FDF4", amber: "#FFFBEB" };
  const fg: Record<string, string> = { default: "#374151", green: "#15803D", amber: "#B45309" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 8px",
      borderRadius: 6, background: bg[color], color: fg[color],
    }}>
      {label}
    </span>
  );
}

function BackgroundRemoveAction({
  isRemoving,
  hasTransparency,
  done,
  error,
  onRemove,
}: {
  isRemoving: boolean;
  hasTransparency: boolean;
  done: boolean;
  error: string | null;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.4 }}>
        {hasTransparency
          ? "Votre image a déjà un fond transparent. Vous pouvez raffiner la transparence si besoin."
          : "Votre image a un fond. Cliquez pour le supprimer automatiquement (IA)."}
      </p>

      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: isRemoving ? "wait" : "pointer",
          background: isRemoving ? "#E5E7EB" : "#111827",
          color: isRemoving ? "#9CA3AF" : "#FFFFFF",
          border: "none",
          transition: "background 120ms",
        }}
      >
        {isRemoving ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>
              ⏳
            </span>
            Suppression en cours…
          </>
        ) : done ? (
          <>↺ Supprimer à nouveau</>
        ) : (
          <>✨ Supprimer le fond automatiquement</>
        )}
      </button>

      {done && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#047857",
          }}
        >
          ✓ Fond supprimé. Vous pouvez utiliser la découpe à la forme.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Styles partagés ─────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2,
  fontSize: 12, color: "#6B7280", fontWeight: 500,
};

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: "none", borderRadius: 10,
    padding: "10px 18px", fontWeight: 700, fontSize: 14,
    cursor: bg === "#D1D5DB" ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    whiteSpace: "nowrap",
  };
}
