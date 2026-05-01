/**
 * Génération de ligne de coupe kiss cut via enveloppe convexe (convex hull).
 *
 * Approche délibérément grossière : pour un sticker kiss cut on veut
 * UN SEUL contour approximatif autour de l'ensemble du design.
 *
 * Pipeline :
 *  1. Canvas offscreen basse résolution (60×60)
 *  2. Masque binaire alpha
 *  3. Marching squares → segments de tous les contours (y compris pièces disjointes)
 *  4. Enveloppe convexe (convex hull) de l'ensemble des points de contour
 *     → garantit un seul polygone qui englobe tout, logo + texte
 *  5. Mise à l'échelle display
 *  6. Expansion par offset polygonal bevel join
 *  7. Lissage
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

const GRID_SIZE       = 60;
const ALPHA_THRESHOLD = 15;
const SMOOTH_PASSES   = 3;
const BEVEL_THRESHOLD = 1.4;

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

  // 2. Canvas offscreen basse résolution
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

  const fraction = opaquePixels / (GRID_SIZE * GRID_SIZE);
  if (fraction > 0.96) {
    return {
      ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme.",
    };
  }
  if (opaquePixels < 4) {
    return { ok: false, error: "no_contour", message: "Image trop peu opaque." };
  }

  // 4. Marching squares sur le masque brut
  const segments = marchingSquares(mask, GRID_SIZE, GRID_SIZE);
  if (!segments.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour détecté." };
  }

  // 5. Enveloppe convexe de TOUS les points de tous les segments
  //    → garantit un seul polygone englobant toute la forme (logo + texte)
  const allPts: Point[] = [];
  for (const [a, b] of segments) { allPts.push(a, b); }

  const hull = convexHull(allPts);
  if (hull.length < 3) {
    return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };
  }

  // 6. Mise à l'échelle vers la taille d'affichage
  const sx = displayW / GRID_SIZE, sy = displayH / GRID_SIZE;
  const scaled = hull.map((p) => ({ x: p.x * sx, y: p.y * sy }));

  // 7. Offset polygonal bevel join (pas de spikes sur les angles)
  const expanded = offsetPx > 0 ? normalBevelOffset(scaled, offsetPx) : scaled;

  // 8. Lissage (3 passes → contour bien arrondi, style kiss cut)
  const smoothed = smoothPolygon(expanded, SMOOTH_PASSES);

  return { ok: true, result: { pathData: toSvgPath(smoothed), pointCount: smoothed.length } };
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

// ─── Marching squares (segments bruts) ───────────────────────────────────────

const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [], [[3,2]], [[2,1]], [[3,1]],
  [[0,1]], [[3,0],[1,2]], [[0,2]], [[3,0]],
  [[0,3]], [[0,2]], [[0,1],[3,2]], [[0,1]],
  [[3,1]], [[2,1]], [[3,2]], [],
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
      const c = (mask[cy * w + cx]         === 1 ? 8 : 0)
              | (mask[cy * w + cx + 1]     === 1 ? 4 : 0)
              | (mask[(cy+1) * w + cx + 1] === 1 ? 2 : 0)
              | (mask[(cy+1) * w + cx]     === 1 ? 1 : 0);
      for (const [e1, e2] of MS_TABLE[c]!)
        segs.push([edgeMid(cx, cy, e1), edgeMid(cx, cy, e2)]);
    }
  }
  return segs;
}

// ─── Enveloppe convexe (Andrew's monotone chain) ─────────────────────────────

function convexHull(pts: Point[]): Point[] {
  if (pts.length < 3) return pts;

  // Dédoublonner puis trier par x (puis y)
  const unique = dedup(pts);
  if (unique.length < 3) return unique;
  unique.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  const cross = (O: Point, A: Point, B: Point) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

  // Chaîne inférieure
  const lower: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }

  // Chaîne supérieure
  const upper: Point[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }

  // Fusionner (enlever les points en double aux extrémités)
  upper.pop(); lower.pop();
  return [...lower, ...upper];
}

/** Retire les points dupliqués (à 0.5 px près) */
function dedup(pts: Point[]): Point[] {
  const seen = new Set<string>();
  return pts.filter((p) => {
    const k = `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ─── Offset bevel join ────────────────────────────────────────────────────────

function normalBevelOffset(pts: Point[], dist: number): Point[] {
  if (!dist || pts.length < 3) return pts;
  const r1 = _off(pts, dist,  1);
  const r2 = _off(pts, dist, -1);
  return polyArea(r1) >= polyArea(r2) ? r1 : r2;
}

function _off(pts: Point[], dist: number, s: 1 | -1): Point[] {
  const n = pts.length, res: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!, cur = pts[i]!, next = pts[(i + 1) % n]!;
    const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
    const e2x = next.x - cur.x, e2y = next.y - cur.y;
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    const n1x = s * e1y / l1, n1y = s * (-e1x) / l1;
    const n2x = s * e2y / l2, n2y = s * (-e2x) / l2;
    const bx = n1x + n2x, by = n1y + n2y, bl = Math.hypot(bx, by);
    if (bl < 0.01) { res.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist }); continue; }
    const m = dist * 2 / bl;
    if (m > dist * BEVEL_THRESHOLD) {
      res.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist });
      res.push({ x: cur.x + n2x * dist, y: cur.y + n2y * dist });
    } else {
      res.push({ x: cur.x + (bx / bl) * m, y: cur.y + (by / bl) * m });
    }
  }
  return res;
}

function polyArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// ─── Lissage ──────────────────────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let c = pts;
  for (let p = 0; p < passes; p++) {
    const n = c.length;
    c = c.map((pt, i) => ({
      x: c[(i-1+n)%n]!.x * 0.25 + pt.x * 0.5 + c[(i+1)%n]!.x * 0.25,
      y: c[(i-1+n)%n]!.y * 0.25 + pt.y * 0.5 + c[(i+1)%n]!.y * 0.25,
    }));
  }
  return c;
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ") + " Z";
}
