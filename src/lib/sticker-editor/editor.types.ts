// ─── Métier ───────────────────────────────────────────────────────────────────

export type CutType = "kiss_cut" | "through_cut";

/**
 * Méthode de découpe rendue par le canvas.
 * - `bounding_box` : rectangle simple (forme « carré » du produit)
 * - `alpha`        : suit le motif (forme « à la forme / die-cut » du produit)
 * - `circle`       : ellipse (forme « rond » du produit)
 * - `rounded`      : rectangle aux coins arrondis (forme « arrondi » du produit)
 */
export type CutlineMethod = "bounding_box" | "alpha" | "circle" | "rounded";

/**
 * Convertit le `code` d'une forme produit (`stickerShapes.code`) en méthode de
 * découpe utilisée par l'éditeur visuel. Les codes sont insensibles aux tirets
 * (`die-cut` ↔ `die_cut`) pour absorber les variantes historiques.
 */
export function shapeCodeToCutlineMethod(code: string | null | undefined): CutlineMethod {
  const k = (code ?? "").toLowerCase().replace(/-/g, "_");
  if (k === "die_cut" || k === "diecut" || k === "custom") return "alpha";
  if (k === "round" || k === "circle" || k === "ellipse") return "circle";
  if (k === "rounded" || k === "rounded_square" || k === "rounded_rect") return "rounded";
  return "bounding_box";
}

export type CutlineStatus = "not_generated" | "generating" | "generated" | "error";

// ─── Image ────────────────────────────────────────────────────────────────────

export interface EditorImage {
  /** Object URL (blob) ou data URL */
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  originalWidthPx: number;
  originalHeightPx: number;
  hasTransparency: boolean;
  /** Taille affichée en mm */
  widthMm: number;
  heightMm: number;
  /** Position centre en mm depuis le coin haut-gauche du canvas */
  xMm: number;
  yMm: number;
  rotationDeg: number;
}

// ─── Paramètres de coupe ──────────────────────────────────────────────────────

export interface CutlineSettings {
  enabled: boolean;
  cutType: CutType;
  method: CutlineMethod;
  /** Marge autour du visuel en mm */
  offsetMm: number;
  status: CutlineStatus;
  /** Chemin SVG du contour alpha (relatif au coin haut-gauche de l'image affichée) */
  alphaCutlinePath: string | undefined;
}

// ─── Paramètres globaux ───────────────────────────────────────────────────────

export interface EditorSettings {
  cutline: CutlineSettings;
  bleedMm: number;
  safetyMarginMm: number;
  showBleed: boolean;
  showSafety: boolean;
  showCutline: boolean;
  showGrid: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationMessage {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface EditorValidation {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

// ─── État principal ───────────────────────────────────────────────────────────

export interface StickerEditorState {
  /** Dimensions du canvas produit en mm */
  canvasWidthMm: number;
  canvasHeightMm: number;
  image: EditorImage | null;
  settings: EditorSettings;
  isUploading: boolean;
  uploadError: string | null;
  validation: EditorValidation;
  isDirty: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type EditorAction =
  | { type: "SET_IMAGE"; image: EditorImage }
  | { type: "CLEAR_IMAGE" }
  | { type: "UPDATE_IMAGE"; patch: Partial<EditorImage> }
  | { type: "SET_UPLOADING"; value: boolean }
  | { type: "SET_UPLOAD_ERROR"; error: string | null }
  | { type: "SET_CUT_TYPE"; cutType: CutType }
  | { type: "SET_CUTLINE_METHOD"; method: CutlineMethod }
  | { type: "SET_CUTLINE_OFFSET"; offsetMm: number }
  | { type: "SET_CUTLINE_PATH"; path: string | undefined; status: CutlineStatus }
  | { type: "SET_BLEED"; bleedMm: number }
  | { type: "SET_SAFETY_MARGIN"; safetyMarginMm: number }
  | { type: "TOGGLE_SHOW_BLEED" }
  | { type: "TOGGLE_SHOW_SAFETY" }
  | { type: "TOGGLE_SHOW_CUTLINE" }
  | { type: "TOGGLE_SHOW_GRID" }
  | { type: "SET_VALIDATION"; validation: EditorValidation }
  | { type: "RESET_POSITION" };

// ─── Props de sortie (onValidate) ─────────────────────────────────────────────

export interface EditorValidationOutput {
  previewDataUrl: string;
  editorConfig: {
    widthMm: number;
    heightMm: number;
    cutType: CutType;
    cutlineOffsetMm: number;
    bleedMm: number;
    safetyMarginMm: number;
    originalFilename: string;
    hasTransparency: boolean;
    dpi: number;
  };
}
