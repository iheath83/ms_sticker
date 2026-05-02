/**
 * Construction du path SVG de la *cut contour* en coordonnées **mm** (origine
 * top-left du sticker), pour toutes les méthodes de découpe :
 *  - `alpha`        : suit la silhouette → on part du path retourné par le
 *                     service Python (en pixels d'image originale) et on le
 *                     transforme dans le repère mm sticker (rotation
 *                     d'image incluse).
 *  - `bounding_box` : rectangle aligné aux axes englobant le contenu réel
 *                     (tight bbox) ou la bbox de l'image, élargi par
 *                     `offsetMm`.
 *  - `circle`       : cercle minimal englobant le contenu, élargi par
 *                     `offsetMm`. Si le contour n'est pas dispo, fallback
 *                     sur l'ellipse circonscrite à la bbox image.
 *  - `rounded`      : rectangle aux coins arrondis (rayon ≈ 12 % du plus
 *                     petit côté), aligné sur la tight bbox + offset.
 *
 * Toutes les sorties sont des paths SVG composés de M, L, C, Z — directement
 * convertibles en opérateurs PDF (cf. `pdf-export.ts`).
 */

import type { CutlineMethod, EditorImage } from "./editor.types";
import { computePathBounds, type PathBounds } from "./path-bounds";

/** Constante magique pour approximer un quart de cercle par un Bézier cubique. */
const KAPPA = 0.5522847498307936;

interface BoundingBoxMm {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface BuildArgs {
  method: CutlineMethod;
  image: EditorImage;
  /** Marge de coupe en mm (offset autour du contenu). */
  offsetMm: number;
  /** Path alpha SVG retourné par le service Python (px image), ou undefined. */
  alphaPath: string | undefined;
}

/**
 * Construit le path SVG de la cut contour en mm sticker.
 * Retourne `null` si la donnée n'est pas suffisante (ex: alpha sans path).
 */
export function buildCutPathMm({
  method,
  image,
  offsetMm,
  alphaPath,
}: BuildArgs): string | null {
  if (method === "alpha") {
    if (!alphaPath) return null;
    return transformAlphaPathToMm(alphaPath, image);
  }

  // Modes géométriques : on cherche d'abord la tight bbox du contenu.
  const tight = alphaPath ? computePathBounds(alphaPath) : null;
  const baseMm = tight
    ? tightBoundsToMm(tight, image)
    : imageBboxMm(image);

  if (method === "bounding_box") {
    return rectPath(expandBbox(baseMm, offsetMm));
  }
  if (method === "rounded") {
    const rect = expandBbox(baseMm, offsetMm);
    const r = Math.min(rect.maxX - rect.minX, rect.maxY - rect.minY) * 0.12;
    return roundedRectPath(rect, Math.max(0, r));
  }
  if (method === "circle") {
    if (tight) {
      // Cercle parfait centré sur le contenu réel.
      const cx = (tight.minX + tight.maxX) / 2;
      const cy = (tight.minY + tight.maxY) / 2;
      const sx = image.widthMm / Math.max(1, image.originalWidthPx);
      const sy = image.heightMm / Math.max(1, image.originalHeightPx);
      const cxMm = image.xMm - image.widthMm / 2 + cx * sx;
      const cyMm = image.yMm - image.heightMm / 2 + cy * sy;
      const rMm = Math.max(tight.radius * sx, tight.radius * sy) + offsetMm;
      return ellipsePath(cxMm, cyMm, rMm, rMm);
    }
    // Fallback : ellipse circonscrite à la bbox image (× √2).
    const cx = image.xMm;
    const cy = image.yMm;
    const rx = (image.widthMm / 2) * Math.SQRT2 + offsetMm;
    const ry = (image.heightMm / 2) * Math.SQRT2 + offsetMm;
    return ellipsePath(cx, cy, rx, ry);
  }

  return null;
}

// ─── Helpers : conversions image px ↔ sticker mm ─────────────────────────────

function imageBboxMm(image: EditorImage): BoundingBoxMm {
  const minX = image.xMm - image.widthMm / 2;
  const minY = image.yMm - image.heightMm / 2;
  return {
    minX,
    minY,
    maxX: minX + image.widthMm,
    maxY: minY + image.heightMm,
  };
}

function tightBoundsToMm(b: PathBounds, image: EditorImage): BoundingBoxMm {
  const sx = image.widthMm / Math.max(1, image.originalWidthPx);
  const sy = image.heightMm / Math.max(1, image.originalHeightPx);
  const baseX = image.xMm - image.widthMm / 2;
  const baseY = image.yMm - image.heightMm / 2;
  return {
    minX: baseX + b.minX * sx,
    minY: baseY + b.minY * sy,
    maxX: baseX + b.maxX * sx,
    maxY: baseY + b.maxY * sy,
  };
}

function expandBbox(b: BoundingBoxMm, off: number): BoundingBoxMm {
  return {
    minX: b.minX - off,
    minY: b.minY - off,
    maxX: b.maxX + off,
    maxY: b.maxY + off,
  };
}

// ─── Helpers : génération de paths SVG (en mm) ───────────────────────────────

function rectPath(b: BoundingBoxMm): string {
  return [
    `M ${fmt(b.minX)} ${fmt(b.minY)}`,
    `L ${fmt(b.maxX)} ${fmt(b.minY)}`,
    `L ${fmt(b.maxX)} ${fmt(b.maxY)}`,
    `L ${fmt(b.minX)} ${fmt(b.maxY)}`,
    "Z",
  ].join(" ");
}

function roundedRectPath(b: BoundingBoxMm, r: number): string {
  const x = b.minX;
  const y = b.minY;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const rr = Math.min(r, w / 2, h / 2);
  if (rr <= 0) return rectPath(b);
  const k = KAPPA * rr;
  return [
    `M ${fmt(x + rr)} ${fmt(y)}`,
    `L ${fmt(x + w - rr)} ${fmt(y)}`,
    `C ${fmt(x + w - rr + k)} ${fmt(y)}, ${fmt(x + w)} ${fmt(y + rr - k)}, ${fmt(x + w)} ${fmt(y + rr)}`,
    `L ${fmt(x + w)} ${fmt(y + h - rr)}`,
    `C ${fmt(x + w)} ${fmt(y + h - rr + k)}, ${fmt(x + w - rr + k)} ${fmt(y + h)}, ${fmt(x + w - rr)} ${fmt(y + h)}`,
    `L ${fmt(x + rr)} ${fmt(y + h)}`,
    `C ${fmt(x + rr - k)} ${fmt(y + h)}, ${fmt(x)} ${fmt(y + h - rr + k)}, ${fmt(x)} ${fmt(y + h - rr)}`,
    `L ${fmt(x)} ${fmt(y + rr)}`,
    `C ${fmt(x)} ${fmt(y + rr - k)}, ${fmt(x + rr - k)} ${fmt(y)}, ${fmt(x + rr)} ${fmt(y)}`,
    "Z",
  ].join(" ");
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  return [
    `M ${fmt(cx - rx)} ${fmt(cy)}`,
    `C ${fmt(cx - rx)} ${fmt(cy - ky)}, ${fmt(cx - kx)} ${fmt(cy - ry)}, ${fmt(cx)} ${fmt(cy - ry)}`,
    `C ${fmt(cx + kx)} ${fmt(cy - ry)}, ${fmt(cx + rx)} ${fmt(cy - ky)}, ${fmt(cx + rx)} ${fmt(cy)}`,
    `C ${fmt(cx + rx)} ${fmt(cy + ky)}, ${fmt(cx + kx)} ${fmt(cy + ry)}, ${fmt(cx)} ${fmt(cy + ry)}`,
    `C ${fmt(cx - kx)} ${fmt(cy + ry)}, ${fmt(cx - rx)} ${fmt(cy + ky)}, ${fmt(cx - rx)} ${fmt(cy)}`,
    "Z",
  ].join(" ");
}

// ─── Conversion alpha SVG (px image) → mm sticker, avec rotation ─────────────

function transformAlphaPathToMm(svgPath: string, image: EditorImage): string {
  const sx = image.widthMm / Math.max(1, image.originalWidthPx);
  const sy = image.heightMm / Math.max(1, image.originalHeightPx);
  const baseX = image.xMm - image.widthMm / 2;
  const baseY = image.yMm - image.heightMm / 2;
  const cx = image.xMm;
  const cy = image.yMm;
  const theta = (image.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const project = (px: number, py: number): [number, number] => {
    // px image → mm relatif → mm sticker (sans rotation)
    const mx = baseX + px * sx;
    const my = baseY + py * sy;
    if (image.rotationDeg === 0) return [mx, my];
    // Rotation horaire (Konva) autour du centre image (cx, cy)
    const dx = mx - cx;
    const dy = my - cy;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return [cx + rx, cy + ry];
  };

  // Tokenize : M/L absolus (le service Python) — couvre aussi m/l/Z/z
  // par défensivité.
  const tokenRegex = /([MLmlZz])\s*([-\d.eE+]*)\s*,?\s*([-\d.eE+]*)/g;
  const out: string[] = [];
  let cursorPxX = 0;
  let cursorPxY = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(svgPath)) !== null) {
    const cmd = match[1];
    const a = parseFloat(match[2] ?? "");
    const b = parseFloat(match[3] ?? "");
    if (cmd === "M" || cmd === "L") {
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX = a;
      cursorPxY = b;
      const [mx, my] = project(cursorPxX, cursorPxY);
      out.push(`${cmd} ${fmt(mx)} ${fmt(my)}`);
    } else if (cmd === "m" || cmd === "l") {
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX += a;
      cursorPxY += b;
      const [mx, my] = project(cursorPxX, cursorPxY);
      out.push(`${cmd === "m" ? "M" : "L"} ${fmt(mx)} ${fmt(my)}`);
    } else if (cmd === "Z" || cmd === "z") {
      out.push("Z");
    }
  }
  return out.join(" ");
}

function fmt(n: number): string {
  // 4 décimales suffisent à 1/100 mm de précision après conversion en pt.
  return Number.isFinite(n) ? n.toFixed(4) : "0";
}
