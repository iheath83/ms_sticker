export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

export function pxToMm(px: number, pxPerMm: number): number {
  return px / pxPerMm;
}

/**
 * Calcule le facteur d'échelle pour afficher dimensionMm dans containerPx.
 * Retourne px par mm.
 */
export function computeScale(containerPx: number, dimensionMm: number): number {
  return containerPx / dimensionMm;
}

/**
 * Calcule le DPI effectif en fonction de la taille d'affichage.
 */
export function computeDpi(
  originalWidthPx: number,
  displayWidthMm: number,
): number {
  if (!displayWidthMm) return 0;
  const inches = displayWidthMm / 25.4;
  return Math.round(originalWidthPx / inches);
}

/**
 * Retourne true si la résolution est insuffisante pour impression (< 150 DPI).
 */
export function isLowResolution(dpi: number): boolean {
  return dpi > 0 && dpi < 150;
}

/**
 * Calcule la taille initiale d'affichage de l'image sur le canvas,
 * en respectant le ratio et en remplissant au maximum les dimensions du canvas.
 */
export function fitImageToCanvas(
  imageWidthPx: number,
  imageHeightPx: number,
  canvasWidthMm: number,
  canvasHeightMm: number,
  maxFillRatio = 0.7,
): { widthMm: number; heightMm: number } {
  const ratio = imageWidthPx / imageHeightPx;
  const maxW = canvasWidthMm * maxFillRatio;
  const maxH = canvasHeightMm * maxFillRatio;

  let w = maxW;
  let h = w / ratio;

  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }

  return { widthMm: w, heightMm: h };
}
