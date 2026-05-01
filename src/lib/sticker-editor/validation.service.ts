import type {
  StickerEditorState,
  EditorValidation,
  ValidationMessage,
} from "./editor.types";
import { computeDpi, isLowResolution } from "./geometry.utils";

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

export function validateEditor(state: StickerEditorState): EditorValidation {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  if (!state.image) {
    errors.push({
      code: "NO_FILE",
      severity: "error",
      message: "Veuillez importer votre fichier avant de continuer.",
    });
    return { isValid: false, errors, warnings };
  }

  const { image, settings } = state;

  // Taille fichier
  if (image.sizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push({
      code: "FILE_TOO_LARGE",
      severity: "error",
      message: `Fichier trop lourd (${(image.sizeBytes / 1024 / 1024).toFixed(1)} Mo). Maximum : 30 Mo.`,
    });
  }

  // Résolution
  const dpi = computeDpi(image.originalWidthPx, image.widthMm);
  if (isLowResolution(dpi)) {
    warnings.push({
      code: "LOW_RES",
      severity: "warning",
      message: `Résolution faible (${dpi} DPI). Recommandé : 300 DPI minimum pour une impression nette.`,
    });
  }

  // Transparence
  if (
    !image.hasTransparency &&
    image.mimeType !== "image/svg+xml" &&
    image.mimeType !== "application/pdf"
  ) {
    warnings.push({
      code: "NO_TRANSPARENCY",
      severity: "warning",
      message:
        "Votre image n'a pas de fond transparent. La découpe suivra le contour rectangulaire.",
    });
  }

  // Ligne de coupe
  if (!settings.cutline.enabled) {
    warnings.push({
      code: "NO_CUTLINE",
      severity: "warning",
      message: "Aucune ligne de coupe activée. Le sticker sera découpé au format de la planche.",
    });
  }

  // Image dans les limites du canvas
  const halfW = image.widthMm / 2;
  const halfH = image.heightMm / 2;
  const outOfBounds =
    image.xMm - halfW < -settings.bleedMm ||
    image.yMm - halfH < -settings.bleedMm ||
    image.xMm + halfW > state.canvasWidthMm + settings.bleedMm ||
    image.yMm + halfH > state.canvasHeightMm + settings.bleedMm;

  if (outOfBounds) {
    warnings.push({
      code: "OUT_OF_BOUNDS",
      severity: "warning",
      message: "Une partie de votre visuel dépasse les bords de la zone d'impression.",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Détecte si une image PNG a de la transparence via un canvas off-screen.
 * Retourne false si le navigateur ne supporte pas l'API.
 */
export async function detectTransparency(
  file: File,
): Promise<boolean> {
  if (file.type === "image/svg+xml") return true;
  if (file.type !== "image/png") return false;

  return new Promise<boolean>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const sampleSize = Math.min(img.width, img.height, 200);
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(false); return; }
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        for (let i = 3; i < imageData.data.length; i += 4) {
          if ((imageData.data[i] ?? 255) < 255) { resolve(true); return; }
        }
        resolve(false);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}
