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

interface SubPath {
  points: Array<[number, number]>;
  closed: boolean;
}

/**
 * Découpe le path alpha (M/L/Z, en pixels d image) en sous-paths cycliques
 * et les projette en mm sticker en appliquant la rotation Konva. Chaque
 * sous-path est ensuite lisse via Catmull-Rom -> Bezier cubique pour eviter
 * les segments anguleux visibles dans le PDF (l aperçu Konva les masque
 * avec le pointille, le PDF les rend en trait continu).
 */
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
    const mx = baseX + px * sx;
    const my = baseY + py * sy;
    if (image.rotationDeg === 0) return [mx, my];
    const dx = mx - cx;
    const dy = my - cy;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return [cx + rx, cy + ry];
  };

  // 1. Tokenize → sous-paths
  const tokenRegex = /([MLmlZz])\s*([-\d.eE+]*)\s*,?\s*([-\d.eE+]*)/g;
  const subs: SubPath[] = [];
  let current: SubPath | null = null;
  let cursorPxX = 0;
  let cursorPxY = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(svgPath)) !== null) {
    const cmd = match[1];
    const a = parseFloat(match[2] ?? "");
    const b = parseFloat(match[3] ?? "");
    if (cmd === "M") {
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX = a;
      cursorPxY = b;
      current = { points: [project(cursorPxX, cursorPxY)], closed: false };
      subs.push(current);
    } else if (cmd === "m") {
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX += a;
      cursorPxY += b;
      current = { points: [project(cursorPxX, cursorPxY)], closed: false };
      subs.push(current);
    } else if (cmd === "L") {
      if (!current || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX = a;
      cursorPxY = b;
      current.points.push(project(cursorPxX, cursorPxY));
    } else if (cmd === "l") {
      if (!current || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      cursorPxX += a;
      cursorPxY += b;
      current.points.push(project(cursorPxX, cursorPxY));
    } else if (cmd === "Z" || cmd === "z") {
      if (current) current.closed = true;
    }
  }

  // 2. Lissage Catmull-Rom -> Bezier
  return subs.map((s) => smoothToBezierPath(dedupe(s.points), s.closed)).join(" ");
}

/** Supprime les points consécutifs identiques (eps 1e-3 mm). */
function dedupe(pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const eps = 1e-3;
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > eps || Math.abs(last[1] - p[1]) > eps) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Catmull-Rom uniform (tension = 0.5) -> Bezier cubique.
 * Pour 4 points consecutifs P0..P3, la courbe entre P1 et P2 est :
 *   B0 = P1
 *   B1 = P1 + (P2 - P0) / 6
 *   B2 = P2 - (P3 - P1) / 6
 *   B3 = P2
 */
function smoothToBezierPath(pts: Array<[number, number]>, closed: boolean): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${fmt(pts[0]![0])} ${fmt(pts[0]![1])}`;
  if (n === 2) {
    return [
      `M ${fmt(pts[0]![0])} ${fmt(pts[0]![1])}`,
      `L ${fmt(pts[1]![0])} ${fmt(pts[1]![1])}`,
      closed ? "Z" : "",
    ].filter(Boolean).join(" ");
  }

  const get = (i: number): [number, number] => {
    if (closed) {
      const k = ((i % n) + n) % n;
      return pts[k]!;
    }
    return pts[Math.max(0, Math.min(n - 1, i))]!;
  };

  const out: string[] = [];
  out.push(`M ${fmt(pts[0]![0])} ${fmt(pts[0]![1])}`);
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    out.push(
      `C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`,
    );
  }
  if (closed) out.push("Z");
  return out.join(" ");
}

function fmt(n: number): string {
  // 4 décimales suffisent à 1/100 mm de précision après conversion en pt.
  return Number.isFinite(n) ? n.toFixed(4) : "0";
}
