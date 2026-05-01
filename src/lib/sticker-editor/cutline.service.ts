/**
 * Génération de ligne de coupe à la forme (alpha channel) via canvas HTML5.
 *
 * Pipeline :
 *  1. Dessin de l'image sur canvas offscreen à haute résolution
 *  2. Extraction du masque binaire depuis le canal alpha
 *  3. Légère dilatation morphologique (1px pour combler les artefacts de sous-pixel)
 *  4. Marching squares → segments de contour
 *  5. Connexion des segments en polygone(s)
 *  6. Douglas-Peucker (tolerance basse pour garder la précision)
 *  7. Mise à l'échelle vers la taille d'affichage
 *  8. Offset par normales aux arêtes (bisectrices) — précis sur les concavités
 *  9. Lissage léger (1 passe)
 * 10. Conversion en SVG path
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

/** Résolution d'analyse interne. Plus c'est élevé, plus le contour est précis. */
const GRID_SIZE = 280;
/** Seuil alpha : pixel "dedans" si alpha > valeur */
const ALPHA_THRESHOLD = 15;
/** Tolérance Douglas-Peucker en unités grille. Faible = beaucoup de points = précis. */
const SIMPLIFY_TOLERANCE = 0.4;
/** Passes de lissage (1 suffit pour adoucir les artefacts marching squares) */
const SMOOTH_PASSES = 1;
/** Facteur max de miter pour éviter les pointes aux angles très aigus */
const MAX_MITER_FACTOR = 3.5;

// ─── API publique ─────────────────────────────────────────────────────────────

export interface CutlineResult {
  /** SVG path data, avec (0,0) = coin haut-gauche de l'image affichée */
  pathData: string;
  pointCount: number;
}

export type CutlineError =
  | "no_transparency"   // PNG sans canal alpha significatif
  | "no_contour"        // Impossible de tracer un contour
  | "load_failed";      // Erreur de chargement image

export interface CutlineSuccess { ok: true; result: CutlineResult; }
export interface CutlineFailure { ok: false; error: CutlineError; message: string; }
export type CutlineOutcome = CutlineSuccess | CutlineFailure;

/**
 * Génère un chemin SVG de découpe à la forme à partir du canal alpha d'une image.
 */
export async function generateAlphaCutline(
  imageUrl: string,
  displayW: number,
  displayH: number,
  offsetPx: number,
): Promise<CutlineOutcome> {
  // 1. Charger l'image
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(imageUrl);
  } catch {
    return { ok: false, error: "load_failed", message: "Impossible de charger l'image." };
  }

  // 2. Canvas offscreen à haute résolution
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_contour", message: "Canvas non disponible." };
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

  // 3. Masque binaire depuis alpha
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  let opaquePixels = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const alpha = data[i * 4 + 3] ?? 0;
    if (alpha > ALPHA_THRESHOLD) { mask[i] = 1; opaquePixels++; }
  }

  // Vérifier qu'il y a de la transparence utile
  const opaqueFraction = opaquePixels / (GRID_SIZE * GRID_SIZE);
  if (opaqueFraction > 0.96) {
    return {
      ok: false,
      error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme.",
    };
  }

  // 4. Dilatation légère (1px) pour combler les pixels de sous-pixel
  const dilated = morphDilate(mask, GRID_SIZE, GRID_SIZE, 1) as Uint8Array<ArrayBuffer>;

  // 5. Marching squares → segments
  const segments = marchingSquares(dilated, GRID_SIZE, GRID_SIZE);
  if (!segments.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour détecté dans l'image." };
  }

  // 6. Connexion en polygone(s)
  const polygons = connectSegments(segments);
  if (!polygons.length) {
    return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };
  }

  // 7. Polygone le plus grand (contour principal)
  const raw = polygons.sort((a, b) => polygonArea(b) - polygonArea(a))[0] ?? [];
  if (raw.length < 6) {
    return { ok: false, error: "no_contour", message: "Contour trop petit ou invalide." };
  }

  // 8. Simplification (basse tolérance = précis)
  const simplified = douglasPeucker(raw, SIMPLIFY_TOLERANCE);

  // 9. Mise à l'échelle vers la taille d'affichage
  const scaleX = displayW / GRID_SIZE;
  const scaleY = displayH / GRID_SIZE;
  const scaled = simplified.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

  // 10. Offset par normales aux arêtes (précis sur les concavités)
  const expanded = offsetPx > 0 ? normalBisectorOffset(scaled, offsetPx) : scaled;

  // 11. Lissage léger
  const smoothed = smoothPolygon(expanded, SMOOTH_PASSES);

  // 12. SVG path
  const pathData = toSvgPath(smoothed);

  return { ok: true, result: { pathData, pointCount: smoothed.length } };
}

// ─── Chargement image ─────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

// ─── Dilatation morphologique ─────────────────────────────────────────────────

function morphDilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && mask[ny * w + nx] === 1) {
            found = true; break outer;
          }
        }
      }
      out[y * w + x] = found ? 1 : 0;
    }
  }
  return out;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

/**
 * Table des paires d'arêtes par case.
 * Case = (tl<<3)|(tr<<2)|(br<<1)|(bl<<0)
 * Arêtes : 0=haut, 1=droite, 2=bas, 3=gauche
 */
const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [],                  // 0  rien
  [[3, 2]],            // 1  BL seul
  [[2, 1]],            // 2  BR seul
  [[3, 1]],            // 3  BL+BR
  [[0, 1]],            // 4  TR seul
  [[3, 0], [1, 2]],    // 5  TR+BL saddle
  [[0, 2]],            // 6  TR+BR
  [[3, 0]],            // 7  TR+BR+BL
  [[0, 3]],            // 8  TL seul
  [[0, 2]],            // 9  TL+BL
  [[0, 1], [3, 2]],    // 10 TL+BR saddle
  [[0, 1]],            // 11 TL+BL+BR
  [[3, 1]],            // 12 TL+TR
  [[2, 1]],            // 13 TL+TR+BL
  [[3, 2]],            // 14 TL+TR+BR
  [],                  // 15 tout dedans
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
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      for (const [e1, e2] of MS_TABLE[c]!) {
        segs.push([edgeMid(cx, cy, e1), edgeMid(cx, cy, e2)]);
      }
    }
  }
  return segs;
}

// ─── Connexion en polygone ────────────────────────────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x * 8)},${Math.round(p.y * 8)}`;

function connectSegments(segments: [Point, Point][]): Point[][] {
  const adj = new Map<string, { p: Point; to: Point[] }>();

  for (const [a, b] of segments) {
    const ka = ptKey(a), kb = ptKey(b);
    if (!adj.has(ka)) adj.set(ka, { p: a, to: [] });
    if (!adj.has(kb)) adj.set(kb, { p: b, to: [] });
    adj.get(ka)!.to.push(b);
    adj.get(kb)!.to.push(a);
  }

  const visited = new Set<string>();
  const polygons: Point[][] = [];

  for (const [startKey, { p: startPt }] of adj) {
    if (visited.has(startKey)) continue;
    void startPt; // used implicitly

    const poly: Point[] = [];
    let curKey = startKey;
    let prevKey = "";

    for (let guard = 0; guard < 80_000; guard++) {
      if (visited.has(curKey)) {
        if (curKey === startKey && poly.length > 2) break;
        break;
      }
      visited.add(curKey);
      const node = adj.get(curKey);
      if (!node) break;
      poly.push(node.p);

      const next = node.to.find((n) => ptKey(n) !== prevKey);
      if (!next) break;
      prevKey = curKey;
      curKey = ptKey(next);
    }

    if (poly.length >= 8) polygons.push(poly);
  }
  return polygons;
}

// ─── Aire polygonale (shoelace) ───────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return Math.abs(area) / 2;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0, maxIdx = 0;
  const first = pts[0]!, last = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tol) {
    const L = douglasPeucker(pts.slice(0, maxIdx + 1), tol);
    const R = douglasPeucker(pts.slice(maxIdx), tol);
    return [...L.slice(0, -1), ...R];
  }
  return [first, last];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / len;
}

// ─── Offset par normales aux arêtes (bisectrices) ────────────────────────────

/**
 * Expanse le polygone vers l'extérieur en déplaçant chaque point
 * le long de la bissectrice des normales des deux arêtes adjacentes.
 * Fonctionne correctement sur les formes concaves.
 *
 * Stratégie : on calcule pour les deux sens de normale (+1 et -1),
 * et on garde celui qui produit le polygone le plus grand (expansion).
 */
function normalBisectorOffset(pts: Point[], dist: number): Point[] {
  if (!dist || pts.length < 3) return pts;

  const r1 = _applyBisectorOffset(pts, dist, 1);
  const r2 = _applyBisectorOffset(pts, dist, -1);

  // Choisir le résultat avec la plus grande aire (expansion)
  return polygonArea(r1) > polygonArea(r2) ? r1 : r2;
}

function _applyBisectorOffset(pts: Point[], dist: number, sign: 1 | -1): Point[] {
  const n = pts.length;
  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;

    // Vecteurs des arêtes
    const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
    const e2x = next.x - curr.x, e2y = next.y - curr.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;

    // Normales (droite : (ey, -ex) / l)
    const n1x = sign * e1y / l1, n1y = sign * (-e1x) / l1;
    const n2x = sign * e2y / l2, n2y = sign * (-e2x) / l2;

    // Bissectrice
    const bx = n1x + n2x, by = n1y + n2y;
    const bl = Math.hypot(bx, by);

    if (bl < 0.01) {
      result.push({ x: curr.x + n1x * dist, y: curr.y + n1y * dist });
      continue;
    }

    // Longueur miter = dist / sin(θ/2), approximée par 2*dist/bl
    // Plafonnée pour éviter les pointes extrêmes sur les angles aigus
    const miter = Math.min(dist * 2 / bl, dist * MAX_MITER_FACTOR);

    result.push({ x: curr.x + (bx / bl) * miter, y: curr.y + (by / bl) * miter });
  }

  return result;
}

// ─── Lissage (moyenne mobile) ─────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const n = cur.length;
    cur = cur.map((pt, i) => ({
      x: (cur[(i - 1 + n) % n]!.x * 0.25 + pt.x * 0.5 + cur[(i + 1) % n]!.x * 0.25),
      y: (cur[(i - 1 + n) % n]!.y * 0.25 + pt.y * 0.5 + cur[(i + 1) % n]!.y * 0.25),
    }));
  }
  return cur;
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ") + " Z";
}
