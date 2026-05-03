"use client";

import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  type DragEvent,
  type Ref,
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
import { buildCutPathMm } from "@/lib/sticker-editor/cut-path-builder";
import type { StickerShape, StickerSize } from "@/db/schema";
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

/**
 * Méthodes impératives exposées via `ref`. Utile en mode `embedded` pour que
 * le parent (configurateur produit) déclenche l'export de l'aperçu au moment
 * de l'ajout au panier, sans qu'un bouton « Valider » ne soit nécessaire.
 */
export interface StickerEditorHandle {
  /**
   * Capture l'aperçu Konva, valide le state et retourne le résultat.
   * Renvoie `null` si l'éditeur n'a pas d'image ou si la validation échoue.
   */
  validate(): Promise<EditorValidationOutput | null>;
  /** True si une image est chargée dans l'éditeur. */
  hasImage(): boolean;
}

interface Props {
  productName: string;
  widthMm: number;
  heightMm: number;
  onValidate: (output: EditorValidationOutput) => void;
  onClose: () => void;
  /**
   * Si false, le modal est masqué (display: none) mais le composant reste
   * monté → l'image et les paramètres sont préservés entre les ouvertures.
   * Défaut : true. Ignoré en mode `embedded`.
   */
  isOpen?: boolean;
  /**
   * Si true, l'éditeur est rendu directement dans la page (pas d'overlay
   *  modal, pas de header avec bouton fermer, pas de footer Annuler/Valider).
   *  Le parent doit déclencher la validation via `ref.current.validate()`.
   */
  embedded?: boolean;
  /** Formes configurées sur le produit (à la forme, carré, rond, arrondi…). */
  shapes: StickerShape[];
  /** Forme actuellement sélectionnée dans le configurateur produit. */
  selectedShapeId?: string | undefined;
  /** Callback : l'utilisateur change de forme dans l'éditeur → cocher la même
   * option dans le configurateur produit. */
  onShapeChange?: (shapeId: string) => void;
  /** Autorise le redimensionnement manuel du visuel dans l'éditeur (poignées
   *  Transformer Konva). Activer uniquement quand le produit autorise une
   *  taille personnalisée — sinon le visuel doit s'adapter au format strict. */
  allowResize?: boolean;
  /** Affiche un bouton « Télécharger le PDF de production » (PDF 300 dpi
   *  sans fond avec cut contour spot magenta CMJN, 0,2 mm). Toggle back-office
   *  → utilisé pour faire des tests de sortie de fichier sans passer commande. */
  enableProductionDownload?: boolean;
  /** Tailles préréglées disponibles sur le produit (la sélection est
   *  synchronisée avec le configurateur via `onSizeChange`). */
  sizes?: StickerSize[];
  /** Id de la taille préréglée actuellement sélectionnée (mode preset). */
  selectedSizeId?: string | undefined;
  /** Mode courant : preset (taille standard) ou custom (taille personnalisée). */
  sizeMode?: "preset" | "custom";
  /** Callback lorsque l'utilisateur change de taille depuis l'éditeur — à
   *  brancher sur `dispatch({ type: "SELECT_SIZE", id })` côté configurateur. */
  onSizeChange?: (sizeId: string) => void;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "application/pdf"];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.svg,.pdf";
const MAX_CANVAS_WIDTH = 520;
// En mode embedded, le canvas dispose de plus d'espace dans la page produit.
const MAX_CANVAS_WIDTH_EMBEDDED = 760;

/**
 * Re-encode une image (PNG/JPG/SVG…) en PNG RGBA 8 bits standard via canvas.
 * Garantit que pdf-lib pourra l embedder (il ne supporte pas les PNG indexes
 * ou interlaces). Conserve la transparence.
 */
async function rasterizeImageToPng(url: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Impossible de charger l'image source."));
    el.src = url;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Dimensions image invalides.");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible.");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec d'export PNG."))),
      "image/png",
    );
  });
}

// ─── Composant principal ─────────────────────────────────────────────────────

function StickerEditorInner(
  {
    productName,
    widthMm,
    heightMm,
    onValidate,
    onClose,
    isOpen = true,
    embedded = false,
    shapes,
    selectedShapeId,
    onShapeChange,
    allowResize = false,
    enableProductionDownload = false,
    sizes = [],
    selectedSizeId,
    sizeMode = "preset",
    onSizeChange,
  }: Props,
  forwardedRef: Ref<StickerEditorHandle>,
) {
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

  // Synchronise la taille du canvas avec les dimensions choisies dans le
  // configurateur (preset OU saisie custom). Le reducer refit l'image et
  // recentre, et regenere la cutline alpha (path en px image inchange,
  // mais offset visuel et projection mm changent).
  useEffect(() => {
    dispatch({ type: "SET_CANVAS_SIZE", widthMm, heightMm });
  }, [widthMm, heightMm]);

  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const maxCanvasWidth = embedded ? MAX_CANVAS_WIDTH_EMBEDDED : MAX_CANVAS_WIDTH;
  const [containerWidth, setContainerWidth] = useState(maxCanvasWidth);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingCutline, setIsGeneratingCutline] = useState(false);
  const [cutlineGenError, setCutlineGenError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemoveError, setBgRemoveError] = useState<string | null>(null);
  const [bgRemoveDone, setBgRemoveDone] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);

  // Mesure la largeur réelle du conteneur canvas
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? maxCanvasWidth;
      setContainerWidth(Math.min(w, maxCanvasWidth));
    });
    ro.observe(el);
    setContainerWidth(Math.min(el.clientWidth, maxCanvasWidth));
    return () => ro.disconnect();
  }, [maxCanvasWidth]);

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

  // ── Téléchargement du PDF de production (QA back-office) ──
  const handleDownloadPdf = useCallback(async () => {
    if (!state.image || isExportingPdf) return;
    setPdfExportError(null);

    const { image, settings } = state;
    const cutPathMm = buildCutPathMm({
      method: settings.cutline.method,
      image,
      offsetMm: settings.cutline.offsetMm,
      alphaPath: settings.cutline.alphaCutlinePath,
    });
    if (!cutPathMm) {
      setPdfExportError(
        settings.cutline.method === "alpha"
          ? "Le contour à la forme n'est pas encore généré."
          : "Impossible de calculer le contour de découpe.",
      );
      return;
    }

    setIsExportingPdf(true);
    try {
      // Re-encode l'image en PNG standard (RGBA 8 bits, non-interlacé) via
      // canvas pour eviter les soucis de PNG indexes / interlaces / palettes
      // que pdf-lib ne supporte pas. Garantit aussi qu'un SVG / PDF importe
      // est rasterise proprement avant l envoi.
      const imgBlob = await rasterizeImageToPng(image.url);

      const form = new FormData();
      form.append("file", imgBlob, image.filename.replace(/\.[^.]+$/, "") + ".png");
      form.append("width_mm", String(widthMm));
      form.append("height_mm", String(heightMm));
      form.append("image_center_x_mm", String(image.xMm));
      form.append("image_center_y_mm", String(image.yMm));
      form.append("image_width_mm", String(image.widthMm));
      form.append("image_height_mm", String(image.heightMm));
      form.append("image_rotation_deg", String(image.rotationDeg));
      form.append("cut_path_mm", cutPathMm);
      form.append("product_name", productName);

      const res = await fetch("/api/sticker-editor/export-pdf", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erreur ${res.status}`);
      }
      const pdfBlob = await res.blob();
      const url = URL.createObjectURL(pdfBlob);
      const safeName = (image.filename || "sticker").replace(/\.[^.]+$/, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-prod.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setPdfExportError(`Échec du téléchargement : ${msg}`);
    } finally {
      setIsExportingPdf(false);
    }
  }, [state, widthMm, heightMm, productName, isExportingPdf]);

  // Déclencher automatiquement la génération du contour alpha :
  //  - Mode "À la forme" → le path est utilisé pour le rendu de la cutline
  //  - Modes géométriques (rond / carré / arrondi) avec image transparente
  //    → le path sert à calculer la *tight bbox* du contenu pour serrer la
  //      forme géométrique au plus près du visuel (ignore les marges
  //      transparentes du fichier).
  // Debounce 600ms pour éviter de spammer l'API quand l'utilisateur fait
  // glisser le slider de marge.
  useEffect(() => {
    if (
      !state.image ||
      state.settings.cutline.status !== "not_generated" ||
      isGeneratingCutline
    ) {
      return;
    }
    // Génération uniquement si transparence détectée (sinon le service
    // refuse l'image et l'aspect géométrique fallback sur la bbox image).
    const needsAlphaPath =
      state.settings.cutline.method === "alpha" || state.image.hasTransparency;
    if (!needsAlphaPath) return;

    const t = setTimeout(() => {
      void handleGenerateCutline();
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.settings.cutline.method,
    state.image?.url,
    state.image?.hasTransparency,
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
  const buildEditorOutput = useCallback(async (): Promise<EditorValidationOutput | null> => {
    const v = validateEditor(state);
    dispatch({ type: "SET_VALIDATION", validation: v });
    if (!v.isValid || !state.image) return null;

    setIsExporting(true);

    let previewDataUrl = "";
    const stage = stageRef.current;
    if (stage) {
      const transformers = stage.find("Transformer");
      const wasVisible = transformers.map((t) => t.visible());
      transformers.forEach((t) => t.visible(false));
      stage.batchDraw();
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

    const derivedCutType =
      state.settings.cutline.method === "alpha" ? "through_cut" : "kiss_cut";

    return {
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
    };
  }, [state]);

  const handleValidate = async () => {
    const output = await buildEditorOutput();
    if (output) onValidate(output);
  };

  // Expose la validation au parent (utile en mode embedded — le configurateur
  // déclenche l'export Konva au clic « Ajouter au panier »).
  useImperativeHandle(
    forwardedRef,
    () => ({
      validate: buildEditorOutput,
      hasImage: () => !!state.image,
    }),
    [buildEditorOutput, state.image],
  );

  // ── Dérivées ──
  const { image, settings, validation, isUploading, uploadError } = state;
  const cutlineColor =
    settings.cutline.cutType === "through_cut" ? "#00B3D8" : "#E91E8C";
  const cutlineLabel =
    settings.cutline.cutType === "through_cut" ? "Coupe pleine chair" : "Demi-chair (kiss cut)";

  const dpi = image ? computeDpi(image.originalWidthPx, image.widthMm) : 0;

  // Body de l'éditeur (canvas + sidebar). Réutilisé en modal et en embedded.
  const editorBody = (
    <div style={{
      display: "flex",
      flex: 1,
      overflow: embedded ? "visible" : "hidden",
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
              overflow: embedded ? "visible" : "auto", minWidth: 0,
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
                    allowResize={allowResize}
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

            {/* ── Taille du sticker (cochée aussi sur la fiche produit) ── */}
            {sizes.length > 0 && (
              <SideSection title="Taille du sticker">
                <SizeSelector
                  sizes={sizes}
                  selectedSizeId={selectedSizeId}
                  sizeMode={sizeMode}
                  currentWidthMm={widthMm}
                  currentHeightMm={heightMm}
                  onChange={(id) => onSizeChange?.(id)}
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

            {/* ── PDF de production (QA back-office) ── */}
            {image && enableProductionDownload && (
              <SideSection title="Test de sortie fichier">
                <ProductionPdfDownload
                  isExporting={isExportingPdf}
                  error={pdfExportError}
                  onDownload={handleDownloadPdf}
                  cutlineReady={
                    state.settings.cutline.method !== "alpha" ||
                    state.settings.cutline.status === "generated"
                  }
                />
              </SideSection>
            )}

            {/* ── Validation ──
                En mode embedded, la validation est silencieuse : aucun bouton
                « Valider » manuel, les avertissements éventuels sont affichés
                par le configurateur produit (uploadError + canOrder). */}
            {!embedded && <ValidationPanel validation={validation} />}

          </div>
    </div>
  );

  // ─── Mode embedded : rendu inline dans la page produit ────────────────────
  if (embedded) {
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #E5E7EB",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 540,
        }}
      >
        {editorBody}
      </div>
    );
  }

  // ─── Mode modal ───────────────────────────────────────────────────────────
  return (
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
      <div
        style={{
          background: "#fff", borderRadius: 20, margin: "auto",
          width: "100%", maxWidth: 1100, maxHeight: "96vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 24px 80px rgba(10,14,39,0.32)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

        {editorBody}

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

export const StickerEditor = forwardRef<StickerEditorHandle, Props>(StickerEditorInner);
StickerEditor.displayName = "StickerEditor";

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

function SizeSelector({
  sizes,
  selectedSizeId,
  sizeMode,
  currentWidthMm,
  currentHeightMm,
  onChange,
}: {
  sizes: StickerSize[];
  selectedSizeId: string | undefined;
  sizeMode: "preset" | "custom";
  currentWidthMm: number;
  currentHeightMm: number;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sizes.map((size) => {
        const isActive = sizeMode === "preset" && size.id === selectedSizeId;
        return (
          <button
            key={size.id}
            type="button"
            onClick={() => onChange(size.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              border: `2px solid ${isActive ? "#0A0E27" : "#E5E7EB"}`,
              background: isActive ? "#0A0E27" : "#fff",
              color: isActive ? "#fff" : "#0A0E27",
              cursor: "pointer",
              transition: "all 0.15s",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <span>{size.label}</span>
            <span style={{ opacity: 0.7, fontSize: 12, fontWeight: 500 }}>
              {size.widthMm} × {size.heightMm} mm
            </span>
          </button>
        );
      })}
      {sizeMode === "custom" && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "2px dashed #BFDBFE",
            background: "#EFF6FF",
            color: "#1D4ED8",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ✎ Taille personnalisée : {currentWidthMm} × {currentHeightMm} mm
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748B", fontWeight: 400 }}>
            Modifiable depuis la page produit.
          </p>
        </div>
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

function ProductionPdfDownload({
  isExporting,
  error,
  onDownload,
  cutlineReady,
}: {
  isExporting: boolean;
  error: string | null;
  onDownload: () => void;
  cutlineReady: boolean;
}) {
  const disabled = isExporting || !cutlineReady;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>
        PDF 300 dpi sans fond, cut contour <strong>spot magenta CMJN</strong>{" "}
        (CutContour, 0,2 mm), à la taille exacte choisie.
      </p>
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "#E5E7EB" : "#0B3D91",
          color: disabled ? "#9CA3AF" : "#FFFFFF",
          border: "none",
          transition: "background 120ms",
        }}
      >
        {isExporting ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>
              ⏳
            </span>
            Génération du PDF…
          </>
        ) : (
          <>↓ Télécharger le PDF de production</>
        )}
      </button>
      {!cutlineReady && (
        <p style={{ margin: 0, fontSize: 11, color: "#B45309" }}>
          Le contour à la forme doit être généré avant l&apos;export.
        </p>
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
