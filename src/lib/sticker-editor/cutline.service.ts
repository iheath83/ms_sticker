/**
 * Génération de ligne de coupe à la forme (alpha channel) via canvas HTML5.
 *
 * Pipeline :
 *  1. Dessin de l'image sur canvas offscreen haute résolution
 *  2. Extraction du masque binaire (canal alpha)
 *  3. Légère dilatation (2px) pour combler le sous-pixel et les micro-gaps
 *  4. Marching squares → segments
 *  5. Connexion des segments → polygones (par index de segment)
 *  6. Sélection de TOUS les polygones significatifs (pas seulement le plus grand)
 *  7. Douglas-Peucker par polygone
 *  8. Mise à l'échelle vers la taille d'affichage
 *  9. Offset polygonal par bevel join (sans spikes sur les angles aigus)
 * 10. Lissage léger
 * 11. Compound SVG path (M…Z M…Z …) réunissant tous les polygones
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

const GRID_SIZE          = 300;   // résolution d'analyse (px)
const ALPHA_THRESHOLD    = 15;    // pixel "dedans" si alpha > seuil
const DILATE_RADIUS      = 2;     // px grille : lisse le sous-pixel seulement
const SIMPLIFY_TOLERANCE = 0.6;   // Douglas-Peucker (unités grille)
const SMOOTH_PASSES      = 1;     // passes de lissage
/** Seuil d'inclusion : polygones > X % du plus grand (0.008 = 0.8 %) */
const AREA_MIN_FRACTION  = 0.008;
/** Bevel join si le miter dépasserait BEVEL × dist */
const BEVEL_THRESHOLD    = 1.4;

// ─── API publique ─────────────────────────────────────────────────────────────

export interface CutlineResult { pathData: string; pointCount: number; }
export type CutlineError = "no_transparency" | "no_contour" | "load_failed";
export interface CutlineSuccess { ok: true; result: CutlineResult; }
export interface CutlineFailure { ok: false; error: CutlineError; message: string; }
export type CutlineOutcome = CutlineSuccess | CutlineFailure;

export async function generateAlphaCutline(
  imageUrl: string,
  displayW: number,
  displayH: number,
  offsetPx: number,
): Promise<CutlineOutcome> {

  // 1. Charger l'image
  let img: HTMLImageElement;
  try { img = await loadImageElement(imageUrl); }
  catch { return { ok: false, error: "load_failed", message: "Impossible de charger l'image." }; }

  // 2. Canvas offscreen
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE; canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_contour", message: "Canvas non disponible." };
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

  // 3. Masque binaire
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  let opaquePixels = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const alpha = data[i * 4 + 3] ?? 0;
    if (alpha > ALPHA_THRESHOLD) { mask[i] = 1; opaquePixels++; }
  }

  const opaqueFraction = opaquePixels / (GRID_SIZE * GRID_SIZE);
  if (opaqueFraction > 0.96) {
    return {
      ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme.",
    };
  }

  // 4. Légère dilatation (lisse le sous-pixel et micro-gaps entre lettres proches)
  const dilated = morphDilateSep(mask, GRID_SIZE, GRID_SIZE, DILATE_RADIUS);

  // 5. Marching squares
  const segments = marchingSquares(dilated, GRID_SIZE, GRID_SIZE);
  if (!segments.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour détecté dans l'image." };
  }

  // 6. Connexion en polygones
  const polygons = connectSegments(segments);
  if (!polygons.length) {
    return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };
  }

  // 7. Sélection de tous les polygones significatifs
  //    On calcule l'aire de chacun et on garde ceux > AREA_MIN_FRACTION × max
  //    pour inclure chaque lettre, emblem, etc.
  const withAreas = polygons
    .map((pts) => ({ pts, area: polygonArea(pts) }))
    .sort((a, b) => b.area - a.area);

  const maxArea = withAreas[0]?.area ?? 0;
  if (!maxArea) return { ok: false, error: "no_contour", message: "Contour invalide." };

  const significant = withAreas.filter((e) => e.area > maxArea * AREA_MIN_FRACTION && e.pts.length >= 6);

  // 8-10. Traitement de chaque polygone : simplifier → scaler → offset → lisser
  const scaleX = displayW / GRID_SIZE, scaleY = displayH / GRID_SIZE;

  const pathParts = significant.map(({ pts }) => {
    const simplified = douglasPeucker(pts, SIMPLIFY_TOLERANCE);
    const scaled     = simplified.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
    const expanded   = offsetPx > 0 ? normalBevelOffset(scaled, offsetPx) : scaled;
    const smoothed   = smoothPolygon(expanded, SMOOTH_PASSES);
    return toSvgPath(smoothed);
  });

  if (!pathParts.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour utilisable." };
  }

  // 11. Compound path
  const pathData   = pathParts.join(" ");
  const pointCount = pathParts.reduce((n, p) => n + p.split(" ").length, 0);

  return { ok: true, result: { pathData, pointCount } };
}

// ─── Chargement image ─────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

// ─── Dilatation morphologique séparable ──────────────────────────────────────

function morphDilateSep(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      for (let nx = x0; nx <= x1 && !found; nx++) if (src[y * w + nx] === 1) found = true;
      tmp[y * w + x] = found ? 1 : 0;
    }
  }
  const out = new Uint8Array(src.length) as Uint8Array<ArrayBuffer>;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let ny = y0; ny <= y1 && !found; ny++) if (tmp[ny * w + x] === 1) found = true;
      out[y * w + x] = found ? 1 : 0;
    }
  }
  return out;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  [[3, 0], [1, 2]],
  [[0, 2]],
  [[3, 0]],
  [[0, 3]],
  [[0, 2]],
  [[0, 1], [3, 2]],
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  [],
];

function edgeMid(cx: number, cy: number, edge: 0 | 1 | 2 | 3): Point {
  switch (edge) {
    case 0: return { x: cx + 0.5, y: cy };
    case 1: return { x: cx + 1,   y: cy + 0.5 };
    case 2: return { x: cx + 0.5, y: cy + 1 };
    case 3: return { x: cx,       y: cy + 0.5 };
  }
}

function marchingSquares(mask: Uint8Array, w: number, h: number): [Point, Point][] {
  const segs: [Point, Point][] = [];
  for (let cy = 0; cy < h - 1; cy++) {
    for (let cx = 0; cx < w - 1; cx++) {
      const tl = mask[cy * w + cx] === 1;
      const tr = mask[cy * w + cx + 1] === 1;
      const br = mask[(cy + 1) * w + cx + 1] === 1;
      const bl = mask[(cy + 1) * w + cx] === 1;
      const c  = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      for (const [e1, e2] of MS_TABLE[c]!)
        segs.push([edgeMid(cx, cy, e1), edgeMid(cx, cy, e2)]);
    }
  }
  return segs;
}

// ─── Connexion en polygones (par index de segment) ────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;

function connectSegments(segs: [Point, Point][]): Point[][] {
  if (!segs.length) return [];

  type Entry = { segIdx: number; other: Point };
  const adj = new Map<string, Entry[]>();

  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i]!;
    const ka = ptKey(a!), kb = ptKey(b!);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ segIdx: i, other: b! });
    adj.get(kb)!.push({ segIdx: i, other: a! });
  }

  const used = new Uint8Array(segs.length);
  const polygons: Point[][] = [];

  for (let startIdx = 0; startIdx < segs.length; startIdx++) {
    if (used[startIdx]) continue;
    const poly: Point[] = [];
    let segIdx = startIdx;
    let curPt   = segs[startIdx]![0]!;

    for (let guard = 0; guard < 150_000; guard++) {
      if (used[segIdx]) break;
      used[segIdx] = 1;
      poly.push(curPt);

      const [sa, sb] = segs[segIdx]!;
      const nextPt   = ptKey(sa!) === ptKey(curPt) ? sb! : sa!;
      const next     = adj.get(ptKey(nextPt))?.find((e) => !used[e.segIdx]);
      if (!next) { poly.push(nextPt); break; }
      segIdx = next.segIdx;
      curPt  = nextPt;
    }

    if (poly.length >= 6) polygons.push(poly);
  }
  return polygons;
}

// ─── Aire polygonale ──────────────────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  const a = pts[0]!, b = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, a, b);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    return [...douglasPeucker(pts.slice(0, maxI + 1), tol).slice(0, -1),
             ...douglasPeucker(pts.slice(maxI), tol)];
  }
  return [a, b];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / len;
}

// ─── Offset polygonal avec bevel join ────────────────────────────────────────
//
// Stratégie "pick larger" : on calcule l'offset dans les deux sens normaux
// et on garde le polygone avec la plus grande aire (= expansion vers l'extérieur).
// Bevel join : quand le miter dépasserait BEVEL_THRESHOLD × dist, on pose
// deux points (aplat) au lieu d'une pointe, pour éviter les spikes.

function normalBevelOffset(pts: Point[], dist: number): Point[] {
  if (!dist || pts.length < 3) return pts;
  const r1 = _offset(pts, dist,  1);
  const r2 = _offset(pts, dist, -1);
  return polygonArea(r1) >= polygonArea(r2) ? r1 : r2;
}

function _offset(pts: Point[], dist: number, sign: 1 | -1): Point[] {
  const n = pts.length;
  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;

    const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
    const e2x = next.x - curr.x, e2y = next.y - curr.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;

    // Normale droite : (ey, -ex) / l  — sens contrôlé par sign
    const n1x = sign * e1y / l1, n1y = sign * (-e1x) / l1;
    const n2x = sign * e2y / l2, n2y = sign * (-e2x) / l2;

    const bx = n1x + n2x, by = n1y + n2y;
    const bl = Math.hypot(bx, by);

    if (bl < 0.01) {
      result.push({ x: curr.x + n1x * dist, y: curr.y + n1y * dist });
      continue;
    }

    const rawMiter = dist * 2 / bl;

    if (rawMiter > dist * BEVEL_THRESHOLD) {
      // Bevel join : deux points aplatis
      result.push({ x: curr.x + n1x * dist, y: curr.y + n1y * dist });
      result.push({ x: curr.x + n2x * dist, y: curr.y + n2y * dist });
    } else {
      result.push({ x: curr.x + (bx / bl) * rawMiter, y: curr.y + (by / bl) * rawMiter });
    }
  }
  return result;
}

// ─── Lissage (moyenne mobile) ─────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const n = cur.length;
    cur = cur.map((pt, i) => ({
      x: cur[(i - 1 + n) % n]!.x * 0.25 + pt.x * 0.5 + cur[(i + 1) % n]!.x * 0.25,
      y: cur[(i - 1 + n) % n]!.y * 0.25 + pt.y * 0.5 + cur[(i + 1) % n]!.y * 0.25,
    }));
  }
  return cur;
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ") + " Z";
}
